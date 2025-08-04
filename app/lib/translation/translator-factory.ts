import { Translator, TranslationConfig } from "./translator";
import { OpenAITranslator } from "./openai-translator";
import { AnthropicTranslator } from "./anthropic-translator";

export class TranslatorFactory {
  static createTranslator(config: TranslationConfig): Translator {
    switch (config.provider.toLowerCase()) {
      case "openai":
        return new OpenAITranslator(config);
      case "anthropic":
        return new AnthropicTranslator(config);
      default:
        throw new Error(`Unsupported translation provider: ${config.provider}`);
    }
  }

  static getSupportedProviders(): string[] {
    return ["openai", "anthropic"];
  }

  static validateProviderConfig(provider: string, model: string): boolean {
    switch (provider.toLowerCase()) {
      case "openai":
        const openaiModels = [
          "gpt-4o",
          "gpt-4o-mini",
          "gpt-4-turbo",
          "gpt-4",
          "gpt-3.5-turbo",
          "o1",
          "o1-mini",
          "o3-mini",
        ];
        return openaiModels.includes(model);
      case "anthropic":
        const anthropicModels = [
          "claude-3-5-sonnet-20241022",
          "claude-3-5-sonnet-20240620",
          "claude-3-5-haiku-20241022",
          "claude-3-opus-20240229",
          "claude-3-sonnet-20240229",
          "claude-3-haiku-20240307",
        ];
        return anthropicModels.includes(model);
      default:
        return false;
    }
  }
}
