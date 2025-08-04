import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./Card";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select, SelectItem } from "./Select";
import { SearchableSelect, SearchableSelectOption } from "./SearchableSelect";
import { Alert, AlertDescription } from "./Alert";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { cn } from "../lib/utils";
import {
  SUPPORTED_PROVIDERS,
  SUPPORTED_LANGUAGES,
  TranslationConfig as ITranslationConfig,
} from "../lib/translation/translator";
import { OpenAITranslator } from "../lib/translation/openai-translator";
import { AnthropicTranslator } from "../lib/translation/anthropic-translator";

export interface ConfigSidebarProps {
  config: ITranslationConfig;
  onConfigChange: (config: ITranslationConfig) => void;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  className?: string;
  useOptimizedTranslation?: boolean;
  onOptimizationToggle?: (enabled: boolean) => void;
  enableStreaming?: boolean;
  onStreamingToggle?: (enabled: boolean) => void;
}

export function ConfigSidebar({
  config,
  onConfigChange,
  isOpen,
  onClose,
  onSave,
  className,
  useOptimizedTranslation = true,
  onOptimizationToggle,
  enableStreaming = true,
  onStreamingToggle,
}: ConfigSidebarProps) {
  const [isTestingConnection, setIsTestingConnection] = React.useState(false);
  const [connectionStatus, setConnectionStatus] = React.useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  const selectedProvider = SUPPORTED_PROVIDERS.find(
    (p) => p.name.toLowerCase() === config.provider.toLowerCase(),
  );
  const availableModels = selectedProvider?.models || [];

  const handleProviderChange = (provider: string) => {
    const selectedProvider = SUPPORTED_PROVIDERS.find(
      (p) => p.name.toLowerCase() === provider.toLowerCase(),
    );
    const defaultModel = selectedProvider?.models[0] || "";

    onConfigChange({
      ...config,
      provider,
      model: defaultModel,
    });

    setConnectionStatus({ status: "idle" });
  };

  const handleTestConnection = async () => {
    if (!config.apiKey.trim()) {
      setConnectionStatus({
        status: "error",
        message: "Please enter an API key first",
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionStatus({ status: "idle" });

    try {
      if (config.provider.toLowerCase() === "openai") {
        const translator = new OpenAITranslator(config);
        const result = await translator.testConnection();

        setConnectionStatus({
          status: result.success ? "success" : "error",
          message: result.error || "Connection successful!",
        });
      } else if (config.provider.toLowerCase() === "anthropic") {
        const translator = new AnthropicTranslator(config);
        const result = await translator.testConnection();

        setConnectionStatus({
          status: result.success ? "success" : "error",
          message: result.error || "Connection successful!",
        });
      } else {
        setConnectionStatus({
          status: "error",
          message: "Connection testing not available for this provider yet",
        });
      }
    } catch (error) {
      setConnectionStatus({
        status: "error",
        message: `Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const isConfigValid = () => {
    return (
      config.apiKey.trim() !== "" &&
      config.provider.trim() !== "" &&
      config.model.trim() !== "" &&
      config.targetLanguage.trim() !== ""
    );
  };

  const getLanguageName = (code: string) => {
    return SUPPORTED_LANGUAGES.find((lang) => lang.code === code)?.name || code;
  };

  // Convert SUPPORTED_LANGUAGES to SearchableSelectOption format
  const languageOptions: SearchableSelectOption[] = SUPPORTED_LANGUAGES.map(
    (lang) => ({
      value: lang.code,
      label: lang.name,
      description: lang.code.toUpperCase(),
    }),
  );

  // Source language options with auto-detect option
  const sourceLanguageOptions: SearchableSelectOption[] = [
    {
      value: "",
      label: "Auto-detect",
      description: "Automatically detect source language",
    },
    ...languageOptions,
  ];

  // Convert SUPPORTED_PROVIDERS to SearchableSelectOption format
  const providerOptions: SearchableSelectOption[] = SUPPORTED_PROVIDERS.map(
    (provider) => ({
      value: provider.name.toLowerCase(),
      label: provider.name,
      description: `${provider.models.length} models available`,
    }),
  );

  // Convert available models to SearchableSelectOption format
  const modelOptions: SearchableSelectOption[] = availableModels.map(
    (model) => ({
      value: model,
      label: model,
      description:
        config.provider === "openai" ? "OpenAI Model" : "Anthropic Model",
    }),
  );

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
          "fixed right-0 top-0 h-full w-80 lg:w-96 bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        <div className="flex-1 overflow-y-auto">
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
                  <Badge
                    variant={config.apiKey ? "success" : "destructive"}
                    className="text-xs"
                  >
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
              <SearchableSelect
                options={providerOptions}
                value={config.provider}
                placeholder="Select provider..."
                searchPlaceholder="Search providers..."
                onChange={(value) => handleProviderChange(value)}
                emptyMessage="No providers found"
                maxHeight="150px"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Model</label>
              <SearchableSelect
                options={modelOptions}
                value={config.model}
                placeholder="Select model..."
                searchPlaceholder="Search models..."
                onChange={(value) =>
                  onConfigChange({ ...config, model: value })
                }
                disabled={!config.provider}
                emptyMessage="No models found"
                maxHeight="200px"
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                API Key
              </label>
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onConfigChange({ ...config, apiKey: e.target.value })
                }
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
              <SearchableSelect
                options={languageOptions}
                value={config.targetLanguage}
                placeholder="Select target language..."
                searchPlaceholder="Search languages..."
                onChange={(value) =>
                  onConfigChange({ ...config, targetLanguage: value })
                }
                emptyMessage="No languages found"
                maxHeight="200px"
              />
            </div>

            {/* Source Language */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Source Language
                <span className="text-gray-400 ml-1">(optional)</span>
              </label>
              <SearchableSelect
                options={sourceLanguageOptions}
                value={config.sourceLanguage || ""}
                placeholder="Auto-detect or select language..."
                searchPlaceholder="Search languages..."
                onChange={(value) =>
                  onConfigChange({
                    ...config,
                    sourceLanguage: value || undefined,
                  })
                }
                emptyMessage="No languages found"
                maxHeight="200px"
              />
            </div>

            {/* Connection Status */}
            {connectionStatus.status !== "idle" && (
              <Alert
                variant={
                  connectionStatus.status === "success"
                    ? "default"
                    : "destructive"
                }
              >
                <AlertDescription>{connectionStatus.message}</AlertDescription>
              </Alert>
            )}

            {/* Translation Optimization */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Translation Mode
              </label>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {useOptimizedTranslation ? "⚡ Optimized" : "🔄 Legacy"}
                    </span>
                    {useOptimizedTranslation && (
                      <Badge variant="success" className="text-xs">
                        Up to 10x faster
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {useOptimizedTranslation
                      ? "Batch processing with parallel requests and caching"
                      : "Sequential translation, one key at a time"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOptimizationToggle?.(!useOptimizedTranslation)
                  }
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    useOptimizedTranslation ? "bg-blue-600" : "bg-gray-200",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      useOptimizedTranslation
                        ? "translate-x-5"
                        : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Notifications
              </label>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        🔔 Completion Alerts
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const { notificationManager } = await import(
                          "../lib/notifications"
                        );
                        const result =
                          await notificationManager.requestPermission();
                        if (result.success) {
                          notificationManager.showTestNotification();
                        }
                      }}
                    >
                      Test
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Get system notifications when translations complete, even
                    when the tab isn't active
                  </p>
                </div>
              </div>
            </div>

            {/* Streaming Settings */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Real-time Updates
              </label>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {enableStreaming
                        ? "🔄 Live Streaming"
                        : "⏸️ Batch Updates"}
                    </span>
                    {enableStreaming && (
                      <Badge variant="success" className="text-xs">
                        Live preview
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {enableStreaming
                      ? "See translation results appear in real-time as they complete"
                      : "Update results only when entire translation finishes"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onStreamingToggle?.(!enableStreaming)}
                  className={cn(
                    "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    enableStreaming ? "bg-blue-600" : "bg-gray-200",
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      enableStreaming ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t">
              <Button
                onClick={handleTestConnection}
                disabled={
                  !config.apiKey.trim() ||
                  !config.provider ||
                  isTestingConnection
                }
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
      </div>
    </>
  );
}
