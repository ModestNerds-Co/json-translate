import { TranslationConfig, TranslationResult } from "./translator";
import { TranslatorFactory } from "./translator-factory";

export interface ParallelTranslationItem {
  key: string;
  value: string;
  id: string;
}

export interface ParallelTranslationResult {
  id: string;
  key: string;
  success: boolean;
  translatedValue: string;
  error?: string;
}

export interface ParallelProgress {
  completed: number;
  total: number;
  percentage: number;
  itemsPerSecond: number;
  estimatedTimeRemaining: number;
  activeRequests: number;
}

export interface ParallelRateLimitConfig {
  requestsPerMinute: number;
  maxConcurrentRequests: number;
}

export class ParallelTranslator {
  private config: TranslationConfig;
  private rateLimitConfig: ParallelRateLimitConfig;
  private requestQueue: ParallelTranslationItem[] = [];
  private activeRequests = 0;
  private completedCount = 0;
  private startTime = 0;
  private cache = new Map<string, string>();
  private requestTimes: number[] = [];
  private lastRequestTime = 0;
  private cancelled = false;

  constructor(config: TranslationConfig, rateLimitConfig?: ParallelRateLimitConfig) {
    this.config = config;
    this.rateLimitConfig = rateLimitConfig || this.getDefaultRateLimits(config.provider);
  }

  private getDefaultRateLimits(provider: string): ParallelRateLimitConfig {
    switch (provider.toLowerCase()) {
      case "openai":
        return {
          requestsPerMinute: 500,
          maxConcurrentRequests: 12, // Slightly higher for individual requests
        };
      case "anthropic":
        return {
          requestsPerMinute: 300,
          maxConcurrentRequests: 10,
        };
      default:
        return {
          requestsPerMinute: 100,
          maxConcurrentRequests: 5,
        };
    }
  }

  private getCacheKey(value: string, targetLang: string, sourceLang?: string): string {
    return `${sourceLang || "auto"}->${targetLang}:${value}`;
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

  private async processItem(item: ParallelTranslationItem): Promise<ParallelTranslationResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(
      item.value,
      this.config.targetLanguage,
      this.config.sourceLanguage
    );
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return {
        id: item.id,
        key: item.key,
        success: true,
        translatedValue: cached,
      };
    }

    // Wait for rate limit
    await this.waitForRateLimit();

    if (this.cancelled) {
      return {
        id: item.id,
        key: item.key,
        success: false,
        translatedValue: "",
        error: "Translation cancelled",
      };
    }

    try {
      const translator = TranslatorFactory.createTranslator(this.config);
      const result = await translator.translateKey(item.key, item.value);

      if (result.success) {
        // Cache the successful translation
        this.cache.set(cacheKey, result.translatedValue);
      }

      return {
        id: item.id,
        key: item.key,
        success: result.success,
        translatedValue: result.translatedValue,
        error: result.error,
      };
    } catch (error) {
      return {
        id: item.id,
        key: item.key,
        success: false,
        translatedValue: "",
        error: error instanceof Error ? error.message : "Translation failed",
      };
    }
  }

  private calculateProgress(completed: number, total: number): ParallelProgress {
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    const elapsed = (Date.now() - this.startTime) / 1000;
    const itemsPerSecond = elapsed > 0 ? completed / elapsed : 0;
    const remaining = total - completed;
    const estimatedTimeRemaining = itemsPerSecond > 0 ? remaining / itemsPerSecond : 0;

    return {
      completed,
      total,
      percentage,
      itemsPerSecond,
      estimatedTimeRemaining,
      activeRequests: this.activeRequests,
    };
  }

  async translateParallel(
    items: ParallelTranslationItem[],
    onProgress?: (progress: ParallelProgress) => void,
    onItemComplete?: (result: ParallelTranslationResult) => void
  ): Promise<ParallelTranslationResult[]> {
    this.startTime = Date.now();
    this.completedCount = 0;
    this.cancelled = false;
    this.requestQueue = [...items];

    const results: ParallelTranslationResult[] = [];
    const promises: Promise<void>[] = [];

    // Process items with controlled concurrency
    const processNext = async (): Promise<void> => {
      while (this.requestQueue.length > 0 && !this.cancelled) {
        if (this.activeRequests >= this.rateLimitConfig.maxConcurrentRequests) {
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 50));
          continue;
        }

        const item = this.requestQueue.shift();
        if (!item) break;

        this.activeRequests++;

        try {
          const result = await this.processItem(item);
          results.push(result);
          this.completedCount++;

          if (onItemComplete) {
            onItemComplete(result);
          }

          if (onProgress) {
            const progress = this.calculateProgress(this.completedCount, items.length);
            onProgress(progress);
          }
        } finally {
          this.activeRequests--;
        }
      }
    };

    // Start multiple workers up to the concurrent limit
    const workerCount = Math.min(
      this.rateLimitConfig.maxConcurrentRequests,
      items.length
    );

    for (let i = 0; i < workerCount; i++) {
      promises.push(processNext());
    }

    await Promise.all(promises);

    return results.sort((a, b) => {
      // Sort results back to original order
      const aIndex = items.findIndex(item => item.id === a.id);
      const bIndex = items.findIndex(item => item.id === b.id);
      return aIndex - bIndex;
    });
  }

  // Cancel ongoing translations
  cancel(): void {
    this.cancelled = true;
  }

  // Retry only failed items
  async retryFailed(
    previousResults: ParallelTranslationResult[],
    onProgress?: (progress: ParallelProgress) => void,
    onItemComplete?: (result: ParallelTranslationResult) => void
  ): Promise<ParallelTranslationResult[]> {
    const failedItems: ParallelTranslationItem[] = previousResults
      .filter(result => !result.success)
      .map(result => ({
        id: result.id,
        key: result.key,
        value: "", // We need to pass the original value - this would need to be stored
      }));

    if (failedItems.length === 0) {
      return previousResults;
    }

    const retryResults = await this.translateParallel(
      failedItems,
      onProgress,
      onItemComplete
    );

    // Merge retry results with previous results
    const updatedResults = [...previousResults];
    retryResults.forEach(retryResult => {
      const index = updatedResults.findIndex(r => r.id === retryResult.id);
      if (index !== -1) {
        updatedResults[index] = retryResult;
      }
    });

    return updatedResults;
  }

  // Estimate translation time
  estimateTranslationTime(itemCount: number): number {
    const requestsPerSecond = this.rateLimitConfig.requestsPerMinute / 60;
    const effectiveRate = Math.min(
      requestsPerSecond,
      this.rateLimitConfig.maxConcurrentRequests
    );
    return itemCount / effectiveRate;
  }

  // Get cache statistics
  getCacheStats(): { size: number; entries: Array<{ key: string; value: string }> } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, value]) => ({ key, value })),
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get current status
  getStatus(): {
    activeRequests: number;
    queueSize: number;
    cacheSize: number;
    cancelled: boolean;
  } {
    return {
      activeRequests: this.activeRequests,
      queueSize: this.requestQueue.length,
      cacheSize: this.cache.size,
      cancelled: this.cancelled,
    };
  }
}
