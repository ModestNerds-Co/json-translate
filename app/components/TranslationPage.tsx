import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./Card";
import { Button } from "./Button";
import { Alert, AlertDescription } from "./Alert";
import { Badge } from "./Badge";
import { ConfigSidebar } from "./ConfigSidebar";
import { JSONEditor } from "./JSONEditor";
import { NotificationStatus } from "./NotificationStatus";
import {
  TranslationProgress,
  TranslationProgressItem,
} from "./TranslationProgress";
import { cn } from "../lib/utils";
import {
  TranslationConfig as ITranslationConfig,
  SUPPORTED_LANGUAGES,
} from "../lib/translation/translator";
import { TranslatorFactory } from "../lib/translation/translator-factory";
import { JSONProcessor } from "../lib/json-processor";
import {
  ParallelTranslator,
  ParallelTranslationItem,
  ParallelTranslationResult,
  ParallelProgress,
} from "../lib/translation/parallel-translator";
import {
  notifyTranslationComplete,
  notifyTranslationStarted,
  notifyTranslationError,
  requestNotificationPermission,
} from "../lib/notifications";

interface TranslationState {
  originalJSON: string;
  translatedJSON: string;
  config: ITranslationConfig;
  isConfigured: boolean;
  progressItems: TranslationProgressItem[];
  currentIndex: number;
  isTranslating: boolean;
  isPaused: boolean;
  errors: string[];
  sidebarOpen: boolean;
  parallelProgress?: ParallelProgress;
  estimatedTime?: number;
  useOptimizedTranslation: boolean;
  isStreaming: boolean;
  enableStreaming: boolean;
}

export function TranslationPage() {
  const [state, setState] = React.useState<TranslationState>({
    originalJSON: "",
    translatedJSON: "",
    config: {
      provider: "openai",
      model: "gpt-3.5-turbo",
      apiKey: "",
      targetLanguage: "es",
      sourceLanguage: undefined,
    },
    isConfigured: false,
    progressItems: [],
    currentIndex: 0,
    isTranslating: false,
    isPaused: false,
    errors: [],
    sidebarOpen: false,
    useOptimizedTranslation: true,
    isStreaming: false,
    enableStreaming: true,
  });

  const translationInProgress = React.useRef(false);
  const translationStartTime = React.useRef(0);

  // Extract translatable keys when JSON changes
  React.useEffect(() => {
    if (!state.originalJSON.trim()) {
      setState((prev) => ({ ...prev, progressItems: [], translatedJSON: "" }));
      return;
    }

    try {
      const parsed = JSON.parse(state.originalJSON);
      const keys = JSONProcessor.extractTranslatableKeys(parsed);
      const items: TranslationProgressItem[] = keys.map(({ key, value }) => ({
        key,
        status: "pending" as const,
        originalValue: value,
      }));

      setState((prev) => ({
        ...prev,
        progressItems: items,
        currentIndex: 0,
        isTranslating: false,
        isPaused: false,
        translatedJSON: "",
        isStreaming: false,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, progressItems: [], translatedJSON: "" }));
    }
  }, [state.originalJSON]);

  const handleConfigSave = () => {
    setState((prev) => ({ ...prev, isConfigured: true, sidebarOpen: false }));
  };

  const handleStartTranslation = async () => {
    if (
      !state.isConfigured ||
      state.progressItems.length === 0 ||
      translationInProgress.current
    ) {
      return;
    }

    translationInProgress.current = true;
    translationStartTime.current = Date.now();

    setState((prev) => ({
      ...prev,
      isTranslating: true,
      isPaused: false,
      currentIndex: 0,
      isStreaming: true,
    }));

    // Request notification permission and notify start
    await requestNotificationPermission();
    await notifyTranslationStarted(state.progressItems.length);

    try {
      await processTranslations();
    } catch (error) {
      console.error("Translation process failed:", error);
      setState((prev) => ({
        ...prev,
        isTranslating: false,
        errors: [
          ...prev.errors,
          `Translation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      }));
    } finally {
      translationInProgress.current = false;
    }
  };

  const handlePauseTranslation = () => {
    translationInProgress.current = false;
    setState((prev) => ({ ...prev, isTranslating: false, isPaused: true }));
  };

  const handleResumeTranslation = async () => {
    if (translationInProgress.current) return;

    translationInProgress.current = true;
    setState((prev) => ({
      ...prev,
      isTranslating: true,
      isPaused: false,
      isStreaming: prev.enableStreaming,
    }));

    try {
      await processTranslations();
    } catch (error) {
      console.error("Translation resume failed:", error);
      setState((prev) => ({
        ...prev,
        isTranslating: false,
        errors: [
          ...prev.errors,
          `Resume failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      }));
    } finally {
      translationInProgress.current = false;
    }
  };

  const handleStopTranslation = () => {
    translationInProgress.current = false;
    setState((prev) => ({
      ...prev,
      isTranslating: false,
      isPaused: false,
      currentIndex: 0,
      progressItems: prev.progressItems.map((item) => ({
        ...item,
        status: item.status === "completed" ? "completed" : "pending",
        error: item.status === "completed" ? item.error : undefined,
      })),
    }));
  };

  const handleRetryFailed = async () => {
    if (translationInProgress.current) return;

    const failedItems = state.progressItems.filter(
      (item) => item.status === "error",
    );
    if (failedItems.length === 0) return;

    translationInProgress.current = true;
    setState((prev) => ({
      ...prev,
      isTranslating: true,
      isPaused: false,
      isStreaming: prev.enableStreaming,
    }));

    const parallelTranslator = new ParallelTranslator(state.config);

    // Convert failed items to parallel translation format
    const retryItems: ParallelTranslationItem[] = failedItems.map(
      (item, index) => ({
        id: `retry_${index}`,
        key: item.key,
        value: item.originalValue,
      }),
    );

    try {
      await parallelTranslator.translateParallel(
        retryItems,
        // Progress callback
        (progress: ParallelProgress) => {
          setState((prev) => ({ ...prev, parallelProgress: progress }));
        },
        // Item complete callback
        (result: ParallelTranslationResult) => {
          setState((prev) => {
            const updatedItems = prev.progressItems.map((pItem) => {
              if (result.key === pItem.key) {
                return {
                  ...pItem,
                  status: result.success
                    ? ("completed" as const)
                    : ("error" as const),
                  translatedValue: result.success ? result.translatedValue : "",
                  error: result.success ? undefined : result.error,
                };
              }
              return pItem;
            });

            // Generate streaming JSON update after each retry completion
            if (prev.enableStreaming && result.success) {
              console.log(
                "Generating streaming JSON after retry completion:",
                result.key,
              );
              generateStreamingJSONWithItems(updatedItems);
            }

            return {
              ...prev,
              progressItems: updatedItems,
            };
          });
        },
      );

      setState((prev) => ({
        ...prev,
        isTranslating: false,
        isStreaming: false,
        parallelProgress: undefined,
      }));

      // Generate final JSON if streaming is enabled
      if (state.enableStreaming) {
        generateStreamingJSON();
      }
    } catch (error) {
      console.error("Retry failed:", error);
      setState((prev) => ({
        ...prev,
        isTranslating: false,
        isStreaming: false,
        parallelProgress: undefined,
        errors: [
          ...prev.errors,
          `Retry failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      }));
    } finally {
      translationInProgress.current = false;
    }
  };

  const processTranslations = async () => {
    if (state.useOptimizedTranslation) {
      await processOptimizedTranslations();
    } else {
      await processLegacyTranslations();
    }
  };

  const processOptimizedTranslations = async () => {
    const parallelTranslator = new ParallelTranslator(state.config);

    // Get pending items
    const pendingItems = state.progressItems
      .filter((item) => item.status === "pending")
      .map((item, index) => ({
        id: `${index}`,
        key: item.key,
        value: item.originalValue,
      }));

    if (pendingItems.length === 0) {
      await generateTranslatedJSON();
      setState((prev) => ({ ...prev, isTranslating: false }));
      return;
    }

    // Estimate translation time
    const estimatedTime = parallelTranslator.estimateTranslationTime(
      pendingItems.length,
    );
    setState((prev) => ({ ...prev, estimatedTime }));

    try {
      await parallelTranslator.translateParallel(
        pendingItems,
        // Progress callback
        (progress: ParallelProgress) => {
          setState((prev) => ({ ...prev, parallelProgress: progress }));
        },
        // Item complete callback
        (result: ParallelTranslationResult) => {
          setState((prev) => {
            const updatedItems = prev.progressItems.map((pItem) => {
              if (result.key === pItem.key) {
                return {
                  ...pItem,
                  status: result.success
                    ? ("completed" as const)
                    : ("error" as const),
                  translatedValue: result.success
                    ? result.translatedValue
                    : undefined,
                  error: result.success ? undefined : result.error,
                };
              }
              return pItem;
            });

            // Generate streaming JSON update after each completion
            if (prev.enableStreaming && result.success) {
              console.log(
                "Generating streaming JSON after item completion, completed items:",
                updatedItems.filter((item) => item.status === "completed")
                  .length,
              );
              generateStreamingJSONWithItems(updatedItems);
            }

            return {
              ...prev,
              progressItems: updatedItems,
            };
          });
        },
      );

      // Generate final translated JSON when done
      if (translationInProgress.current) {
        setState((prev) => {
          // Generate final JSON with current state
          console.log(
            "Generating final JSON on completion, completed items:",
            prev.progressItems.filter((item) => item.status === "completed")
              .length,
          );
          generateTranslatedJSONWithItems(prev.progressItems);

          // Calculate completion stats with current state
          const totalItems = prev.progressItems.length;
          const completedItems = prev.progressItems.filter(
            (item) => item.status === "completed",
          ).length;
          const errorItems = prev.progressItems.filter(
            (item) => item.status === "error",
          ).length;

          // Show completion notification
          const duration = (Date.now() - translationStartTime.current) / 1000;
          notifyTranslationComplete(
            totalItems,
            completedItems,
            errorItems,
            duration,
          );

          return {
            ...prev,
            isTranslating: false,
            isStreaming: false,
            parallelProgress: undefined,
          };
        });
      }

      // Fallback: Ensure final JSON is generated even if streaming didn't work
      setTimeout(() => {
        if (translationInProgress.current === false) {
          const completedItems = state.progressItems.filter(
            (item) => item.status === "completed",
          );
          if (completedItems.length > 0 && !state.translatedJSON.trim()) {
            console.log("Fallback: Generating final JSON");
            generateTranslatedJSONWithItems(state.progressItems);
          }
        }
      }, 100);
    } catch (error) {
      console.error("Parallel translation failed:", error);
      setState((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          `Parallel translation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
        isTranslating: false,
        isStreaming: false,
        parallelProgress: undefined,
      }));

      // Show error notification
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await notifyTranslationError(errorMessage);
    }
  };

  const processLegacyTranslations = async () => {
    const translator = TranslatorFactory.createTranslator(state.config);

    // Start from current index and process pending items
    for (
      let i = state.currentIndex;
      i < state.progressItems.length && translationInProgress.current;
      i++
    ) {
      const item = state.progressItems[i];

      // Skip already completed items
      if (item.status === "completed") {
        setState((prev) => ({ ...prev, currentIndex: i + 1 }));
        continue;
      }

      // Update current item status to translating
      setState((prev) => ({
        ...prev,
        currentIndex: i,
        progressItems: prev.progressItems.map((pItem, index) =>
          index === i ? { ...pItem, status: "translating" } : pItem,
        ),
      }));

      try {
        console.log(`Translating key: ${item.key} = "${item.originalValue}"`);
        const result = await translator.translateKey(
          item.key,
          item.originalValue,
        );
        console.log(`Translation result:`, result);

        // Update item with translation result
        setState((prev) => {
          const updatedItems = prev.progressItems.map((pItem, index) =>
            index === i
              ? {
                  ...pItem,
                  status: result.success
                    ? ("completed" as const)
                    : ("error" as const),
                  translatedValue: result.success
                    ? result.translatedValue
                    : undefined,
                  error: result.success ? undefined : result.error,
                }
              : pItem,
          );

          // Generate streaming JSON update after each successful translation
          if (result.success && prev.enableStreaming) {
            console.log(
              "Generating streaming JSON after individual translation:",
              item.key,
            );
            generateStreamingJSONWithItems(updatedItems);
          }

          return {
            ...prev,
            progressItems: updatedItems,
          };
        });

        // Small delay to prevent overwhelming the API
        if (translationInProgress.current) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Translation failed for key ${item.key}:`, error);
        setState((prev) => ({
          ...prev,
          progressItems: prev.progressItems.map((pItem, index) =>
            index === i
              ? {
                  ...pItem,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Translation failed",
                }
              : pItem,
          ),
        }));
      }
    }

    // Generate translated JSON when done
    if (translationInProgress.current) {
      setState((prev) => {
        // Generate final JSON with current state
        generateTranslatedJSONWithItems(prev.progressItems);

        // Calculate completion stats with current state
        const totalItems = prev.progressItems.length;
        const completedItems = prev.progressItems.filter(
          (item) => item.status === "completed",
        ).length;
        const errorItems = prev.progressItems.filter(
          (item) => item.status === "error",
        ).length;

        // Show completion notification
        const duration = (Date.now() - translationStartTime.current) / 1000;
        notifyTranslationComplete(
          totalItems,
          completedItems,
          errorItems,
          duration,
        );

        return {
          ...prev,
          isTranslating: false,
          isStreaming: false,
        };
      });
    }
  };

  const generateStreamingJSON = () => {
    generateStreamingJSONWithItems(state.progressItems);
  };

  const generateStreamingJSONWithItems = (items: TranslationProgressItem[]) => {
    try {
      if (!state.originalJSON || !state.originalJSON.trim()) {
        console.warn("No original JSON available for streaming");
        return;
      }

      const originalParsed = JSON.parse(state.originalJSON);
      const translations = new Map<string, string>();

      // Only include completed translations for streaming
      items.forEach((item) => {
        if (item.status === "completed" && item.translatedValue) {
          translations.set(item.key, item.translatedValue);
        }
      });

      console.log(
        "Streaming JSON generation: found",
        translations.size,
        "completed translations out of",
        items.length,
        "total items",
      );

      if (translations.size > 0) {
        const { translatedJSON, errors } = JSONProcessor.applyTranslations(
          originalParsed,
          translations,
        );

        setState((prev) => ({
          ...prev,
          translatedJSON: JSONProcessor.formatJSON(translatedJSON),
          errors:
            errors.length > 0
              ? [...prev.errors, ...errors.map((e) => e.error)]
              : prev.errors,
        }));
      }
    } catch (error) {
      console.warn("Streaming JSON generation failed:", error);
      // Don't add to errors array for streaming failures as they're non-critical
    }
  };

  const generateTranslatedJSON = async () => {
    generateTranslatedJSONWithItems(state.progressItems);
  };

  const generateTranslatedJSONWithItems = (
    items: TranslationProgressItem[],
  ) => {
    try {
      if (!state.originalJSON || !state.originalJSON.trim()) {
        setState((prev) => ({
          ...prev,
          errors: [
            ...prev.errors,
            "No original JSON available for translation",
          ],
        }));
        return;
      }

      const originalParsed = JSON.parse(state.originalJSON);
      const translations = new Map<string, string>();

      items.forEach((item) => {
        if (item.status === "completed" && item.translatedValue) {
          translations.set(item.key, item.translatedValue);
        }
      });

      if (translations.size === 0) {
        console.warn("No completed translations found");
        return;
      }

      const { translatedJSON, errors } = JSONProcessor.applyTranslations(
        originalParsed,
        translations,
      );

      setState((prev) => ({
        ...prev,
        translatedJSON: JSONProcessor.formatJSON(translatedJSON),
        errors:
          errors.length > 0
            ? [...prev.errors, ...errors.map((e) => e.error)]
            : prev.errors,
      }));
    } catch (error) {
      console.error("Failed to generate translated JSON:", error);
      setState((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          `Failed to generate translated JSON: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      }));
    }
  };

  const handleDownloadTranslated = () => {
    if (!state.translatedJSON) return;

    try {
      const parsed = JSON.parse(state.translatedJSON);
      const targetLang = SUPPORTED_LANGUAGES.find(
        (lang) => lang.code === state.config.targetLanguage,
      );
      const filename = `translation_${targetLang?.code || "unknown"}.json`;
      JSONProcessor.downloadJSON(parsed, filename);
    } catch (error) {
      console.error("Failed to download translated JSON:", error);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!state.translatedJSON) return;

    try {
      await navigator.clipboard.writeText(state.translatedJSON);
      // TODO: Add toast notification
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const canStartTranslation =
    state.isConfigured &&
    state.progressItems.length > 0 &&
    !state.isTranslating;

  const hasCompletedTranslations = state.progressItems.some(
    (item) => item.status === "completed",
  );
  const targetLanguageName =
    SUPPORTED_LANGUAGES.find(
      (lang) => lang.code === state.config.targetLanguage,
    )?.name || state.config.targetLanguage;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gradient">
                JSON Translator
              </h1>
              <p className="text-gray-600 text-sm">
                AI-powered JSON localization file translation
              </p>
            </div>
            <div className="flex items-center gap-4">
              {state.isConfigured && (
                <div className="flex items-center gap-2">
                  <Badge variant="success" className="text-xs">
                    {state.config.provider.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Target: {targetLanguageName}
                  </Badge>
                  <NotificationStatus showPermissionButton={false} />
                </div>
              )}
              <Button
                onClick={() =>
                  setState((prev) => ({ ...prev, sidebarOpen: true }))
                }
                variant={state.isConfigured ? "outline" : "default"}
                size="sm"
              >
                ⚙️ {state.isConfigured ? "Settings" : "Configure"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-6 flex-1 flex flex-col min-h-0 space-y-6">
        {/* Configuration Required Alert */}
        {!state.isConfigured && (
          <div className="flex-shrink-0">
            <Alert>
              <AlertDescription>
                Please configure your translation provider settings to get
                started.
                <Button
                  variant="link"
                  className="ml-2 p-0 h-auto"
                  onClick={() =>
                    setState((prev) => ({ ...prev, sidebarOpen: true }))
                  }
                >
                  Open Settings
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Translation Progress */}
        {state.isConfigured && state.progressItems.length > 0 && (
          <div className="flex-shrink-0">
            <TranslationProgress
              items={state.progressItems}
              currentIndex={state.currentIndex}
              isTranslating={state.isTranslating}
              onStart={handleStartTranslation}
              onPause={handlePauseTranslation}
              onResume={handleResumeTranslation}
              onStop={handleStopTranslation}
              onRetryFailed={handleRetryFailed}
              parallelProgress={state.parallelProgress}
              estimatedTime={state.estimatedTime}
              useOptimizedTranslation={state.useOptimizedTranslation}
              isStreaming={state.isStreaming}
              enableStreaming={state.enableStreaming}
            />
          </div>
        )}

        {/* JSON Editors - Full Height */}
        {state.isConfigured && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* Source JSON */}
            <div className="flex flex-col min-h-0">
              <JSONEditor
                value={state.originalJSON}
                onChange={(value) =>
                  setState((prev) => ({ ...prev, originalJSON: value }))
                }
                title="Source JSON"
                description="Paste or upload your JSON file to translate"
                showValidation={true}
                showStats={true}
                className="h-full"
              />
            </div>

            {/* Translated JSON */}
            <div className="flex flex-col min-h-0">
              <JSONEditor
                value={state.translatedJSON}
                onChange={() => {}} // Read-only
                title="Translated JSON"
                description={
                  state.isStreaming && state.enableStreaming
                    ? `🔄 Streaming results to ${targetLanguageName}...`
                    : hasCompletedTranslations
                      ? `Translated to ${targetLanguageName}`
                      : "Translation results will appear here"
                }
                readonly={true}
                showValidation={false}
                showStats={false}
                onDownload={
                  state.translatedJSON ? handleDownloadTranslated : undefined
                }
                downloadFilename={`translation_${state.config.targetLanguage}.json`}
                className="h-full"
                isStreaming={state.isStreaming && state.enableStreaming}
              />
            </div>
          </div>
        )}

        {/* Export Actions */}
        {state.translatedJSON && (
          <div className="flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle>Export Translation</CardTitle>
                <CardDescription>
                  Download or copy your translated JSON file
                </CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Button
                  onClick={handleDownloadTranslated}
                  className="flex items-center gap-2"
                >
                  📥 Download JSON
                </Button>
                <Button
                  onClick={handleCopyToClipboard}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  📋 Copy to Clipboard
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Errors */}
        {state.errors.length > 0 && (
          <div className="flex-shrink-0">
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Errors occurred:</strong>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  {state.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setState((prev) => ({ ...prev, errors: [] }))}
                >
                  Clear Errors
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Configuration Sidebar */}
      <ConfigSidebar
        config={state.config}
        onConfigChange={(config) => setState((prev) => ({ ...prev, config }))}
        isOpen={state.sidebarOpen}
        onClose={() => setState((prev) => ({ ...prev, sidebarOpen: false }))}
        onSave={handleConfigSave}
        useOptimizedTranslation={state.useOptimizedTranslation}
        onOptimizationToggle={(enabled) =>
          setState((prev) => ({ ...prev, useOptimizedTranslation: enabled }))
        }
        enableStreaming={state.enableStreaming}
        onStreamingToggle={(enabled) =>
          setState((prev) => ({ ...prev, enableStreaming: enabled }))
        }
      />
    </div>
  );
}
