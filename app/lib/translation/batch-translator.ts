import { TranslationConfig, TranslationResult } from "./translator";
import { TranslatorFactory } from "./translator-factory";

export interface BatchTranslationItem {
  key: string;
  value: string;
  id: string;
}

export interface BatchTranslationResult {
  id: string;
  key: string;
  success: boolean;
  translatedValue: string;
  error?: string;
}

export interface BatchProgress {
  completed: number;
  total: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  itemsPerSecond: number;
  estimatedTimeRemaining: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  maxConcurrentRequests: number;
  maxBatchSize: number;
}

export class BatchTranslator {
  private config: TranslationConfig;
  private rateLimitConfig: RateLimitConfig;
  private requestQueue: Array<() => Promise<void>> = [];
  private activeRequests = 0;
  private lastRequestTime = 0;
  private requestTimes: number[] = [];
  private cache = new Map<string, string>();
  private startTime = 0;
  private completedCount = 0;

  constructor(config: TranslationConfig, rateLimitConfig?: RateLimitConfig) {
    this.config = config;
    this.rateLimitConfig =
      rateLimitConfig || this.getDefaultRateLimits(config.provider);
  }

  private getDefaultRateLimits(provider: string): RateLimitConfig {
    switch (provider.toLowerCase()) {
      case "openai":
        return {
          requestsPerMinute: 500, // Conservative for most tiers
          maxConcurrentRequests: 10,
          maxBatchSize: 20, // Keys per request
        };
      case "anthropic":
        return {
          requestsPerMinute: 300, // Conservative for most tiers
          maxConcurrentRequests: 8,
          maxBatchSize: 15, // Keys per request
        };
      default:
        return {
          requestsPerMinute: 100,
          maxConcurrentRequests: 5,
          maxBatchSize: 10,
        };
    }
  }

  private getCacheKey(
    value: string,
    targetLang: string,
    sourceLang?: string,
  ): string {
    return `${sourceLang || "auto"}->${targetLang}:${value}`;
  }

  private groupItemsIntoBatches(
    items: BatchTranslationItem[],
  ): BatchTranslationItem[][] {
    const batches: BatchTranslationItem[][] = [];
    const maxBatchSize = this.rateLimitConfig.maxBatchSize;

    // Group similar keys together for better context
    const sortedItems = [...items].sort((a, b) => {
      const aPrefix = a.key.split(".")[0] || a.key.split("[")[0];
      const bPrefix = b.key.split(".")[0] || b.key.split("[")[0];
      return aPrefix.localeCompare(bPrefix);
    });

    for (let i = 0; i < sortedItems.length; i += maxBatchSize) {
      batches.push(sortedItems.slice(i, i + maxBatchSize));
    }

    return batches;
  }

  private async processBatch(
    batch: BatchTranslationItem[],
  ): Promise<BatchTranslationResult[]> {
    const translator = TranslatorFactory.createTranslator(this.config);
    const results: BatchTranslationResult[] = [];

    // Check cache first
    const uncachedItems: BatchTranslationItem[] = [];
    for (const item of batch) {
      const cacheKey = this.getCacheKey(
        item.value,
        this.config.targetLanguage,
        this.config.sourceLanguage,
      );
      const cached = this.cache.get(cacheKey);

      if (cached) {
        results.push({
          id: item.id,
          key: item.key,
          success: true,
          translatedValue: cached,
        });
      } else {
        uncachedItems.push(item);
      }
    }

    if (uncachedItems.length === 0) {
      return results;
    }

    // Create optimized batch prompt
    const batchPrompt = this.createBatchPrompt(uncachedItems);

    try {
      const batchResult = await translator.translateKey("batch", batchPrompt);

      if (batchResult.success) {
        const translations = this.parseBatchResponse(
          batchResult.translatedValue,
          uncachedItems,
        );

        for (let i = 0; i < uncachedItems.length; i++) {
          const item = uncachedItems[i];
          const translation = translations[i];

          if (translation) {
            // Cache the result
            const cacheKey = this.getCacheKey(
              item.value,
              this.config.targetLanguage,
              this.config.sourceLanguage,
            );
            this.cache.set(cacheKey, translation);

            results.push({
              id: item.id,
              key: item.key,
              success: true,
              translatedValue: translation,
            });
          } else {
            results.push({
              id: item.id,
              key: item.key,
              success: false,
              translatedValue: "",
              error: "Failed to parse batch translation result",
            });
          }
        }
      } else {
        // Fallback to individual translations
        for (const item of uncachedItems) {
          const individualResult = await translator.translateKey(
            item.key,
            item.value,
          );

          if (individualResult.success) {
            const cacheKey = this.getCacheKey(
              item.value,
              this.config.targetLanguage,
              this.config.sourceLanguage,
            );
            this.cache.set(cacheKey, individualResult.translatedValue);
          }

          results.push({
            id: item.id,
            key: item.key,
            success: individualResult.success,
            translatedValue: individualResult.translatedValue,
            error: individualResult.error,
          });
        }
      }
    } catch (error) {
      // Fallback to individual translations on batch failure
      for (const item of uncachedItems) {
        try {
          const individualResult = await translator.translateKey(
            item.key,
            item.value,
          );

          if (individualResult.success) {
            const cacheKey = this.getCacheKey(
              item.value,
              this.config.targetLanguage,
              this.config.sourceLanguage,
            );
            this.cache.set(cacheKey, individualResult.translatedValue);
          }

          results.push({
            id: item.id,
            key: item.key,
            success: individualResult.success,
            translatedValue: individualResult.translatedValue,
            error: individualResult.error,
          });
        } catch (itemError) {
          results.push({
            id: item.id,
            key: item.key,
            success: false,
            translatedValue: "",
            error:
              itemError instanceof Error
                ? itemError.message
                : "Translation failed",
          });
        }
      }
    }

    return results;
  }

  private createBatchPrompt(items: BatchTranslationItem[]): string {
    const itemsText = items
      .map((item, index) => `${index + 1}. "${item.value}"`)
      .join("\n");

    return `Translate the following ${items.length} text strings to ${this.config.targetLanguage}. Return ONLY the translations in the same order, numbered 1-${items.length}, one per line:

${itemsText}

Translations:`;
  }

  private parseBatchResponse(
    response: string,
    items: BatchTranslationItem[],
  ): string[] {
    const lines = response.split("\n").filter((line) => line.trim());
    const translations: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const expectedPrefix = `${i + 1}.`;
      let translation = "";

      // Find the line that starts with the expected number
      const line = lines.find((l) => l.trim().startsWith(expectedPrefix));
      if (line) {
        translation = line.replace(expectedPrefix, "").trim();
        // Remove quotes if present
        translation = translation.replace(/^["']|["']$/g, "");
      }

      translations.push(translation);
    }

    return translations;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = (60 * 1000) / this.rateLimitConfig.requestsPerMinute;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    this.requestTimes.push(this.lastRequestTime);

    // Keep only requests from the last minute
    const oneMinuteAgo = this.lastRequestTime - 60000;
    this.requestTimes = this.requestTimes.filter((time) => time > oneMinuteAgo);
  }

  private calculateProgress(
    completed: number,
    total: number,
    currentBatch: number,
    totalBatches: number,
  ): BatchProgress {
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const itemsPerSecond = elapsed > 0 ? completed / elapsed : 0;
    const remaining = total - completed;
    const estimatedTimeRemaining =
      itemsPerSecond > 0 ? remaining / itemsPerSecond : 0;

    return {
      completed,
      total,
      percentage,
      currentBatch,
      totalBatches,
      itemsPerSecond,
      estimatedTimeRemaining,
    };
  }

  async translateBatch(
    items: BatchTranslationItem[],
    onProgress?: (progress: BatchProgress) => void,
    onBatchComplete?: (results: BatchTranslationResult[]) => void,
  ): Promise<BatchTranslationResult[]> {
    this.startTime = Date.now();
    this.completedCount = 0;

    const batches = this.groupItemsIntoBatches(items);
    const allResults: BatchTranslationResult[] = [];

    const processNextBatch = async (): Promise<void> => {
      if (batches.length === 0) return;

      const batch = batches.shift()!;

      await this.waitForRateLimit();

      try {
        this.activeRequests++;
        const results = await this.processBatch(batch);
        allResults.push(...results);
        this.completedCount += batch.length;

        if (onBatchComplete) {
          onBatchComplete(results);
        }

        if (onProgress) {
          const progress = this.calculateProgress(
            this.completedCount,
            items.length,
            batches.length + 1,
            this.groupItemsIntoBatches(items).length,
          );
          onProgress(progress);
        }
      } finally {
        this.activeRequests--;
      }

      // Continue processing if there are more batches and we're under the concurrent limit
      if (
        batches.length > 0 &&
        this.activeRequests < this.rateLimitConfig.maxConcurrentRequests
      ) {
        processNextBatch();
      }
    };

    // Start initial batch processing up to the concurrent limit
    const initialBatches = Math.min(
      batches.length,
      this.rateLimitConfig.maxConcurrentRequests,
    );
    const promises: Promise<void>[] = [];

    for (let i = 0; i < initialBatches; i++) {
      promises.push(processNextBatch());
    }

    await Promise.all(promises);

    // Wait for any remaining batches to complete
    while (this.activeRequests > 0 || batches.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (
        batches.length > 0 &&
        this.activeRequests < this.rateLimitConfig.maxConcurrentRequests
      ) {
        processNextBatch();
      }
    }

    return allResults;
  }

  // Utility method to estimate translation time
  estimateTranslationTime(itemCount: number): number {
    const batchCount = Math.ceil(itemCount / this.rateLimitConfig.maxBatchSize);
    const parallelBatches = Math.ceil(
      batchCount / this.rateLimitConfig.maxConcurrentRequests,
    );
    const requestInterval = 60 / this.rateLimitConfig.requestsPerMinute;

    return parallelBatches * requestInterval;
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Could be implemented with hit/miss tracking
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }
}
