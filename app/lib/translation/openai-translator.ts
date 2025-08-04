import {
  Translator,
  TranslationProvider,
  TranslationConfig,
  TranslationResult,
} from "./translator";

export class OpenAITranslator extends Translator {
  private baseUrl = "https://api.openai.com/v1";

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

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate the given text from ${this.config.sourceLanguage || "auto-detected language"} to ${this.config.targetLanguage}. Return ONLY the translated text without any explanations, quotes, or additional formatting.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          translatedValue: "",
          error: `OpenAI API error: ${response.status} - ${errorData.error?.message || "Unknown error"}`,
        };
      }

      const data = await response.json();
      const translatedValue = data.choices?.[0]?.message?.content?.trim();

      if (!translatedValue) {
        return {
          success: false,
          translatedValue: "",
          error: "No translation received from OpenAI",
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
      name: "OpenAI",
      models: [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
        "o1",
        "o1-mini",
        "o3-mini",
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
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
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
