import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card"
import { Button } from "./Button"
import { Input } from "./Input"
import { Select, SelectItem } from "./Select"
import { Alert, AlertDescription } from "./Alert"
import { Badge } from "./Badge"
import { Spinner } from "./Spinner"
import { cn } from "../lib/utils"
import { SUPPORTED_PROVIDERS, SUPPORTED_LANGUAGES, TranslationConfig as ITranslationConfig } from "../lib/translation/translator"
import { OpenAITranslator } from "../lib/translation/openai-translator"

export interface ConfigSidebarProps {
  config: ITranslationConfig
  onConfigChange: (config: ITranslationConfig) => void
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  className?: string
}

export function ConfigSidebar({
  config,
  onConfigChange,
  isOpen,
  onClose,
  onSave,
  className
}: ConfigSidebarProps) {
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

  const getLanguageName = (code: string) => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === code)?.name || code
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Configuration</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              ✕
            </Button>
          </div>

          {/* Current Configuration Summary */}
          <Card className="bg-gray-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Provider:</span>
                <Badge variant="outline" className="text-xs">
                  {config.provider}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Model:</span>
                <Badge variant="outline" className="text-xs">
                  {config.model}
                </Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Target:</span>
                <Badge variant="outline" className="text-xs">
                  {getLanguageName(config.targetLanguage)}
                </Badge>
              </div>
              {config.sourceLanguage && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Source:</span>
                  <Badge variant="outline" className="text-xs">
                    {getLanguageName(config.sourceLanguage)}
                  </Badge>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">API Key:</span>
                <Badge variant={config.apiKey ? "success" : "destructive"} className="text-xs">
                  {config.apiKey ? "Set" : "Missing"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Translation Provider
            </label>
            <Select
              value={config.provider}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleProviderChange(e.target.value)}
            >
              {SUPPORTED_PROVIDERS.map(provider =>
                <SelectItem
                  key={provider.name}
                  value={provider.name.toLowerCase()}
                >
                  {provider.name}
                </SelectItem>
              )}
            </Select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Model
            </label>
            <Select
              value={config.model}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, model: e.target.value })}
              disabled={!config.provider}
            >
              {availableModels.map(model =>
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              )}
            </Select>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              API Key
            </label>
            <Input
              type="password"
              value={config.apiKey}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfigChange({ ...config, apiKey: e.target.value })}
              placeholder="Enter your API key"
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Stored only in memory, never saved permanently
            </p>
          </div>

          {/* Target Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Target Language
            </label>
            <Select
              value={config.targetLanguage}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, targetLanguage: e.target.value })}
            >
              {SUPPORTED_LANGUAGES.map(lang =>
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </SelectItem>
              )}
            </Select>
          </div>

          {/* Source Language */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Source Language
              <span className="text-gray-400 ml-1">(optional)</span>
            </label>
            <Select
              value={config.sourceLanguage || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onConfigChange({ ...config, sourceLanguage: e.target.value || undefined })}
            >
              <SelectItem value="">Auto-detect</SelectItem>
              {SUPPORTED_LANGUAGES.map(lang =>
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name} ({lang.code})
                </SelectItem>
              )}
            </Select>
          </div>

          {/* Connection Status */}
          {connectionStatus.status !== 'idle' && (
            <Alert variant={connectionStatus.status === 'success' ? 'default' : 'destructive'}>
              <AlertDescription>
                {connectionStatus.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t">
            <Button
              onClick={handleTestConnection}
              disabled={!config.apiKey.trim() || !config.provider || isTestingConnection}
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
            >
              {isTestingConnection && <Spinner size="sm" />}
              Test Connection
            </Button>

            <Button
              onClick={onSave}
              disabled={!isConfigValid()}
              className="w-full"
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
