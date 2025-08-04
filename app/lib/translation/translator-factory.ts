import { Translator, TranslationConfig } from './translator';
import { OpenAITranslator } from './openai-translator';

export class TranslatorFactory {
  static createTranslator(config: TranslationConfig): Translator {
    switch (config.provider.toLowerCase()) {
      case 'openai':
        return new OpenAITranslator(config);
      case 'anthropic':
        // TODO: Implement AnthropicTranslator when needed
        throw new Error('Anthropic translator not yet implemented');
      default:
        throw new Error(`Unsupported translation provider: ${config.provider}`);
    }
  }

  static getSupportedProviders(): string[] {
    return ['openai'];
  }

  static validateProviderConfig(provider: string, model: string): boolean {
    switch (provider.toLowerCase()) {
      case 'openai':
        const openaiModels = ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        return openaiModels.includes(model);
      case 'anthropic':
        const anthropicModels = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
        return anthropicModels.includes(model);
      default:
        return false;
    }
  }
}
