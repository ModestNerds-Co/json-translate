import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card"
import { Button } from "./Button"
import { Input } from "./Input"
import { Select, SelectItem } from "./Select"
import { Alert } from "./Alert"
import { Spinner } from "./Spinner"
import { cn } from "../lib/utils"
import { SUPPORTED_PROVIDERS, SUPPORTED_LANGUAGES, TranslationConfig as ITranslationConfig } from "../lib/translation/translator"
import { TranslatorFactory } from "../lib/translation/translator-factory"
import { OpenAITranslator } from "../lib/translation/openai-translator"

export interface TranslationConfigProps {
  config: ITranslationConfig
  onConfigChange: (config: ITranslationConfig) => void
  onSave: () => void
  className?: string
}

export function TranslationConfig({
  config,
  onConfigChange,
  onSave,
  className
}: TranslationConfigProps) {
  const [isTestingConnection, setIsTestingConnection] = React.useState(false)
  const [connectionStatus, setConnectionStatus] = React.useState<{
    status: 'idle' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const selectedProvider = SUPPORTED_PROVIDERS.find(p => p.name.toLowerCase() === config.provider.toLowerCase())
  const availableModels = selectedProvider?.models || []

  const handleProviderChange = (provider: string) => {
    const selectedProvider = SUPPORTED_PROVIDERS.find(p => p.name.toLowerCase() === provider.toLowerCase())
    const defaultModel = selectedProvider?.models[0] || ''

    onConfigChange({
      ...config,
      provider,
      model: defaultModel
    })

    // Reset connection status when provider changes
    setConnectionStatus({ status: 'idle' })
  }

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      setConnectionStatus({
        status: 'error',
        message: 'Please enter an API key first'
      })
      return
    }

    setIsTestingConnection(true)
    setConnectionStatus({ status: 'idle' })

    try {
      // Only test OpenAI for now since it's the only implemented provider
      if (config.provider.toLowerCase() === 'openai') {
        const translator = new OpenAITranslator(config)
        const result = await translator.testConnection()

        setConnectionStatus({
          status: result.success ? 'success' : 'error',
          message: result.error || 'Connection successful!'
        })
      } else {
        setConnectionStatus({
          status: 'error',
          message: 'Connection testing not available for this provider yet'
        })
      }
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setIsTestingConnection(false)
    }
  }

  const isConfigValid = () => {
    return config.apiKey.trim() !== '' &&
           config.provider.trim() !== '' &&
           config.model.trim() !== '' &&
           config.targetLanguage.trim() !== ''
  }

  return React.createElement(
    Card,
    { className: cn("w-full", className) },
    React.createElement(
      CardHeader,
      null,
      React.createElement(CardTitle, null, "Translation Configuration"),
      React.createElement(CardDescription, null, "Configure your translation provider and settings")
    ),
    React.createElement(
      CardContent,
      { className: "space-y-6" },

      // Provider Selection
      React.createElement(
        "div",
        { className: "space-y-2" },
        React.createElement(
          "label",
          { className: "text-sm font-medium text-gray-700" },
          "Translation Provider"
        ),
        React.createElement(
          Select,
          {
            value: config.provider,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => handleProviderChange(e.target.value),
            placeholder: "Select a provider"
          },
          SUPPORTED_PROVIDERS.map(provider =>
            React.createElement(
              SelectItem,
              {
                key: provider.name,
                value: provider.name.toLowerCase()
              },
              provider.name
            )
          )
        )
      ),

      // Model Selection
      React.createElement(
        "div",
        { className: "space-y-2" },
        React.createElement(
          "label",
          { className: "text-sm font-medium text-gray-700" },
          "Model"
        ),
        React.createElement(
          Select,
          {
            value: config.model,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, model: e.target.value }),
            disabled: !config.provider,
            placeholder: "Select a model"
          },
          availableModels.map(model =>
            React.createElement(
              SelectItem,
              {
                key: model,
                value: model
              },
              model
            )
          )
        )
      ),

      // API Key
      React.createElement(
        "div",
        { className: "space-y-2" },
        React.createElement(
          "label",
          { className: "text-sm font-medium text-gray-700" },
          "API Key"
        ),
        React.createElement(Input, {
          type: "password",
          value: config.apiKey,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => onConfigChange({ ...config, apiKey: e.target.value }),
          placeholder: "Enter your API key",
          className: "font-mono"
        }),
        React.createElement(
          "p",
          { className: "text-xs text-gray-500" },
          "Your API key is stored only in browser memory and never saved permanently"
        )
      ),

      // Target Language
      React.createElement(
        "div",
        { className: "space-y-2" },
        React.createElement(
          "label",
          { className: "text-sm font-medium text-gray-700" },
          "Target Language"
        ),
        React.createElement(
          Select,
          {
            value: config.targetLanguage,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, targetLanguage: e.target.value }),
            placeholder: "Select target language"
          },
          SUPPORTED_LANGUAGES.map(lang =>
            React.createElement(
              SelectItem,
              {
                key: lang.code,
                value: lang.code
              },
              `${lang.name} (${lang.code})`
            )
          )
        )
      ),

      // Source Language (Optional)
      React.createElement(
        "div",
        { className: "space-y-2" },
        React.createElement(
          "label",
          { className: "text-sm font-medium text-gray-700" },
          "Source Language",
          React.createElement("span", { className: "text-gray-400 ml-1" }, "(optional)")
        ),
        React.createElement(
          Select,
          {
            value: config.sourceLanguage || '',
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, sourceLanguage: e.target.value || undefined }),
            placeholder: "Auto-detect"
          },
          React.createElement(SelectItem, { value: "" }, "Auto-detect"),
          SUPPORTED_LANGUAGES.map(lang =>
            React.createElement(
              SelectItem,
              {
                key: lang.code,
                value: lang.code
              },
              `${lang.name} (${lang.code})`
            )
          )
        )
      ),

      // Connection Status
      connectionStatus.status !== 'idle' && React.createElement(
        Alert,
        {
          variant: connectionStatus.status === 'success' ? 'default' : 'destructive'
        },
        connectionStatus.message
      ),

      // Action Buttons
      React.createElement(
        "div",
        { className: "flex gap-3 pt-4" },
        React.createElement(
          Button,
          {
            onClick: handleTestConnection,
            disabled: !config.apiKey.trim() || !config.provider || isTestingConnection,
            variant: "outline",
            className: "flex items-center gap-2"
          },
          isTestingConnection && React.createElement(Spinner, { size: "sm" }),
          "Test Connection"
        ),
        React.createElement(
          Button,
          {
            onClick: onSave,
            disabled: !isConfigValid()
          },
          "Save Configuration"
        )
      )
    )
  )
}
