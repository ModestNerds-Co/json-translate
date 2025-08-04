export interface JSONProcessingError {
  key: string;
  error: string;
}

export interface ProcessingResult {
  success: boolean;
  translatedJSON?: any;
  errors: JSONProcessingError[];
  totalKeys: number;
  processedKeys: number;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  currentKey: string;
  percentage: number;
}

export class JSONProcessor {
  /**
   * Validates if the input string is valid JSON
   */
  static validateJSON(jsonString: string): { valid: boolean; error?: string } {
    try {
      JSON.parse(jsonString);
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid JSON format'
      };
    }
  }

  /**
   * Extracts all translatable key-value pairs from a JSON object
   */
  static extractTranslatableKeys(obj: any, prefix = ''): Array<{ key: string; value: string; path: string }> {
    const keys: Array<{ key: string; value: string; path: string }> = [];

    const traverse = (current: any, currentPath: string) => {
      if (typeof current === 'string' && current.trim() !== '') {
        keys.push({
          key: currentPath,
          value: current,
          path: currentPath
        });
      } else if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
        Object.keys(current).forEach(key => {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          traverse(current[key], newPath);
        });
      } else if (Array.isArray(current)) {
        current.forEach((item, index) => {
          const newPath = `${currentPath}[${index}]`;
          traverse(item, newPath);
        });
      }
    };

    traverse(obj, prefix);
    return keys;
  }

  /**
   * Sets a value in a nested object using dot notation path
   */
  static setNestedValue(obj: any, path: string, value: string): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];

      // Handle array notation like "items[0]"
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);

        if (!current[arrayKey]) {
          current[arrayKey] = [];
        }

        if (!current[arrayKey][index]) {
          current[arrayKey][index] = {};
        }

        current = current[arrayKey][index];
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    }

    const lastKey = keys[keys.length - 1];

    // Handle array notation for the last key
    const arrayMatch = lastKey.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, indexStr] = arrayMatch;
      const index = parseInt(indexStr, 10);

      if (!current[arrayKey]) {
        current[arrayKey] = [];
      }

      current[arrayKey][index] = value;
    } else {
      current[lastKey] = value;
    }
  }

  /**
   * Creates a copy of the original JSON with translated values
   */
  static applyTranslations(
    originalJSON: any,
    translations: Map<string, string>
  ): { translatedJSON: any; errors: JSONProcessingError[] } {
    const translatedJSON = JSON.parse(JSON.stringify(originalJSON));
    const errors: JSONProcessingError[] = [];

    try {
      translations.forEach((translatedValue, keyPath) => {
        try {
          this.setNestedValue(translatedJSON, keyPath, translatedValue);
        } catch (error) {
          errors.push({
            key: keyPath,
            error: `Failed to apply translation: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      });
    } catch (error) {
      errors.push({
        key: 'global',
        error: `Failed to process translations: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    return { translatedJSON, errors };
  }

  /**
   * Formats JSON string with proper indentation
   */
  static formatJSON(obj: any, indent = 2): string {
    return JSON.stringify(obj, null, indent);
  }

  /**
   * Counts the total number of translatable strings in a JSON object
   */
  static countTranslatableStrings(obj: any): number {
    return this.extractTranslatableKeys(obj).length;
  }

  /**
   * Validates that the JSON structure is suitable for translation
   */
  static validateForTranslation(jsonString: string): {
    valid: boolean;
    error?: string;
    keyCount?: number;
  } {
    const validation = this.validateJSON(jsonString);
    if (!validation.valid) {
      return validation;
    }

    try {
      const parsed = JSON.parse(jsonString);
      const keyCount = this.countTranslatableStrings(parsed);

      if (keyCount === 0) {
        return {
          valid: false,
          error: 'No translatable strings found in the JSON'
        };
      }

      return {
        valid: true,
        keyCount
      };
    } catch (error) {
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Creates a downloadable blob from JSON data
   */
  static createDownloadBlob(jsonData: any, filename: string): { blob: Blob; url: string } {
    const jsonString = this.formatJSON(jsonData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    return { blob, url };
  }

  /**
   * Triggers download of JSON file
   */
  static downloadJSON(jsonData: any, filename: string): void {
    const { url } = this.createDownloadBlob(jsonData, filename);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  }

  /**
   * Estimates the cost of translation based on character count
   */
  static estimateTranslationCost(obj: any, provider: string = 'openai'): {
    totalCharacters: number;
    estimatedTokens: number;
    estimatedCost: number;
  } {
    const keys = this.extractTranslatableKeys(obj);
    const totalCharacters = keys.reduce((sum, key) => sum + key.value.length, 0);

    // Rough estimation: 1 token ≈ 4 characters for English text
    const estimatedTokens = Math.ceil(totalCharacters / 4);

    // Cost estimation (these are approximate rates and may change)
    let costPerToken = 0;
    if (provider.toLowerCase() === 'openai') {
      // Using GPT-3.5-turbo rates as baseline (input + output)
      costPerToken = 0.000002; // $0.002 per 1K tokens (combined input/output estimate)
    }

    const estimatedCost = estimatedTokens * costPerToken;

    return {
      totalCharacters,
      estimatedTokens,
      estimatedCost
    };
  }
}
