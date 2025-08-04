import {
  Translator,
  TranslationProvider,
  TranslationConfig,
  TranslationResult,
} from "./translator";

export class AnthropicTranslator extends Translator {
  private baseUrl = "https://api.anthropic.com/v1";

  constructor(config: TranslationConfig) {
    super(config);
  }

  async translateKey(key: string, value: string): Promise<TranslationResult> {
    try {
      if (!this.validateConfig()) {
        return {
          success: false,
          translatedValue: "",
          error: "Invalid configuration",
        };
      }

      const prompt = this.buildTranslationPrompt(key, value);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": true,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1000,
          temperature: 0.3,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          system: `You are a professional translator. Translate the given text from ${this.config.sourceLanguage || "auto-detected language"} to ${this.config.targetLanguage}. Return ONLY the translated text without any explanations, quotes, or additional formatting.`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          translatedValue: "",
          error: `Anthropic API error: ${response.status} - ${errorData.error?.message || "Unknown error"}`,
        };
      }

      const data = await response.json();
      const translatedValue = data.content?.[0]?.text?.trim();

      if (!translatedValue) {
        return {
          success: false,
          translatedValue: "",
          error: "No translation received from Anthropic",
        };
      }

      return {
        success: true,
        translatedValue,
        error: undefined,
      };
    } catch (error) {
      return {
        success: false,
        translatedValue: "",
        error: `Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  validateConfig(): boolean {
    if (!this.config.apiKey || this.config.apiKey.trim() === "") {
      return false;
    }

    if (
      !this.config.targetLanguage ||
      this.config.targetLanguage.trim() === ""
    ) {
      return false;
    }

    if (!this.config.model || this.config.model.trim() === "") {
      return false;
    }

    const provider = this.getProvider();
    if (!provider.models.includes(this.config.model)) {
      return false;
    }

    return true;
  }

  getProvider(): TranslationProvider {
    return {
      name: "Anthropic",
      models: [
        "claude-3-5-sonnet-20241022",
        "claude-3-5-sonnet-20240620",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307",
      ],
    };
  }

  private buildTranslationPrompt(key: string, value: string): string {
    return `Context: This is a translation key-value pair from a JSON localization file.
Key: "${key}"
Text to translate: "${value}"

Please translate the text to ${this.config.targetLanguage}. Consider the context provided by the key name when translating.`;
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test with a simple message to verify API key and connection
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "Hello",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `API connection failed: ${response.status} - ${errorData.error?.message || "Invalid API key or connection error"}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}
