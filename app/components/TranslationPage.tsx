import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card"
import { Button } from "./Button"
import { Alert, AlertDescription } from "./Alert"
import { TranslationConfig } from "./TranslationConfig"
import { JSONEditor } from "./JSONEditor"
import { TranslationProgress, TranslationProgressItem } from "./TranslationProgress"
import { cn } from "../lib/utils"
import { TranslationConfig as ITranslationConfig, SUPPORTED_LANGUAGES } from "../lib/translation/translator"
import { TranslatorFactory } from "../lib/translation/translator-factory"
import { JSONProcessor, ProcessingProgress } from "../lib/json-processor"

interface TranslationState {
  originalJSON: string
  translatedJSON: string
  config: ITranslationConfig
  isConfigured: boolean
  progressItems: TranslationProgressItem[]
  currentIndex: number
  isTranslating: boolean
  isPaused: boolean
  errors: string[]
}

export function TranslationPage() {
  const [state, setState] = React.useState<TranslationState>({
    originalJSON: '',
    translatedJSON: '',
    config: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      targetLanguage: 'es',
      sourceLanguage: undefined
    },
    isConfigured: false,
    progressItems: [],
    currentIndex: 0,
    isTranslating: false,
    isPaused: false,
    errors: []
  })

  const [showConfig, setShowConfig] = React.useState(false)

  // Extract translatable keys when JSON changes
  React.useEffect(() => {
    if (!state.originalJSON.trim()) {
      setState(prev => ({ ...prev, progressItems: [] }))
      return
    }

    try {
      const parsed = JSON.parse(state.originalJSON)
      const keys = JSONProcessor.extractTranslatableKeys(parsed)
      const items: TranslationProgressItem[] = keys.map(({ key, value }) => ({
        key,
        status: 'pending' as const,
        originalValue: value
      }))

      setState(prev => ({
        ...prev,
        progressItems: items,
        currentIndex: 0,
        isTranslating: false,
        isPaused: false
      }))
    } catch (error) {
      setState(prev => ({ ...prev, progressItems: [] }))
    }
  }, [state.originalJSON])

  const handleConfigSave = () => {
    setState(prev => ({ ...prev, isConfigured: true }))
    setShowConfig(false)
  }

  const handleStartTranslation = async () => {
    if (!state.isConfigured || state.progressItems.length === 0) return

    setState(prev => ({ ...prev, isTranslating: true, isPaused: false, currentIndex: 0 }))
    await processTranslations()
  }

  const handlePauseTranslation = () => {
    setState(prev => ({ ...prev, isTranslating: false, isPaused: true }))
  }

  const handleResumeTranslation = async () => {
    setState(prev => ({ ...prev, isTranslating: true, isPaused: false }))
    await processTranslations()
  }

  const handleStopTranslation = () => {
    setState(prev => ({
      ...prev,
      isTranslating: false,
      isPaused: false,
      currentIndex: 0,
      progressItems: prev.progressItems.map(item => ({
        ...item,
        status: item.status === 'completed' ? 'completed' : 'pending'
      }))
    }))
  }

  const handleRetryFailed = async () => {
    setState(prev => ({
      ...prev,
      progressItems: prev.progressItems.map(item => ({
        ...item,
        status: item.status === 'error' ? 'pending' : item.status,
        error: item.status === 'error' ? undefined : item.error
      }))
    }))

    // Find first failed item and resume from there
    const firstFailedIndex = state.progressItems.findIndex(item => item.status === 'error')
    if (firstFailedIndex !== -1) {
      setState(prev => ({ ...prev, currentIndex: firstFailedIndex, isTranslating: true, isPaused: false }))
      await processTranslations()
    }
  }

  const processTranslations = async () => {
    try {
      const translator = TranslatorFactory.createTranslator(state.config)

      for (let i = state.currentIndex; i < state.progressItems.length; i++) {
        // Check if translation was paused
        if (!state.isTranslating) break

        const item = state.progressItems[i]
        if (item.status === 'completed') continue

        // Update current item status
        setState(prev => ({
          ...prev,
          currentIndex: i,
          progressItems: prev.progressItems.map((pItem, index) =>
            index === i ? { ...pItem, status: 'translating' } : pItem
          )
        }))

        try {
          const result = await translator.translateKey(item.key, item.originalValue)

          setState(prev => ({
            ...prev,
            progressItems: prev.progressItems.map((pItem, index) =>
              index === i ? {
                ...pItem,
                status: result.success ? 'completed' : 'error',
                translatedValue: result.translatedValue,
                error: result.error
              } : pItem
            )
          }))

          // Small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 100))

        } catch (error) {
          setState(prev => ({
            ...prev,
            progressItems: prev.progressItems.map((pItem, index) =>
              index === i ? {
                ...pItem,
                status: 'error',
                error: error instanceof Error ? error.message : 'Translation failed'
              } : pItem
            )
          }))
        }
      }

      // Generate translated JSON when done
      await generateTranslatedJSON()

    } catch (error) {
      setState(prev => ({
        ...prev,
        isTranslating: false,
        errors: [...prev.errors, error instanceof Error ? error.message : 'Translation process failed']
      }))
    } finally {
      setState(prev => ({ ...prev, isTranslating: false }))
    }
  }

  const generateTranslatedJSON = async () => {
    try {
      const originalParsed = JSON.parse(state.originalJSON)
      const translations = new Map<string, string>()

      state.progressItems.forEach(item => {
        if (item.status === 'completed' && item.translatedValue) {
          translations.set(item.key, item.translatedValue)
        }
      })

      const { translatedJSON, errors } = JSONProcessor.applyTranslations(originalParsed, translations)

      setState(prev => ({
        ...prev,
        translatedJSON: JSONProcessor.formatJSON(translatedJSON),
        errors: errors.length > 0 ? [...prev.errors, ...errors.map(e => e.error)] : prev.errors
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, `Failed to generate translated JSON: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }))
    }
  }

  const handleDownloadTranslated = () => {
    if (!state.translatedJSON) return

    try {
      const parsed = JSON.parse(state.translatedJSON)
      const targetLang = SUPPORTED_LANGUAGES.find(lang => lang.code === state.config.targetLanguage)
      const filename = `translation_${targetLang?.code || 'unknown'}.json`
      JSONProcessor.downloadJSON(parsed, filename)
    } catch (error) {
      console.error('Failed to download translated JSON:', error)
    }
  }

  const handleCopyToClipboard = async () => {
    if (!state.translatedJSON) return

    try {
      await navigator.clipboard.writeText(state.translatedJSON)
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const canStartTranslation = state.isConfigured &&
                              state.progressItems.length > 0 &&
                              !state.isTranslating

  const hasCompletedTranslations = state.progressItems.some(item => item.status === 'completed')

  return React.createElement(
    "div",
    { className: "container mx-auto p-6 space-y-6" },

    // Header
    React.createElement(
      "div",
      { className: "text-center space-y-2" },
      React.createElement("h1", { className: "text-4xl font-bold text-gradient" }, "JSON Translator"),
      React.createElement(
        "p",
        { className: "text-gray-600 max-w-2xl mx-auto" },
        "Translate your JSON localization files using AI. Paste your JSON content, configure your translation provider, and get professionally translated content in minutes."
      )
    ),

    // Configuration Section
    React.createElement(
      "div",
      { className: "space-y-4" },
      React.createElement(
        "div",
        { className: "flex items-center justify-between" },
        React.createElement("h2", { className: "text-2xl font-semibold" }, "Configuration"),
        React.createElement(
          Button,
          {
            onClick: () => setShowConfig(!showConfig),
            variant: state.isConfigured ? "outline" : "default"
          },
          state.isConfigured ? "Edit Configuration" : "Configure Provider"
        )
      ),

      !state.isConfigured && React.createElement(
        Alert,
        null,
        React.createElement(
          AlertDescription,
          null,
          "Please configure your translation provider settings to get started."
        )
      ),

      (showConfig || !state.isConfigured) && React.createElement(TranslationConfig, {
        config: state.config,
        onConfigChange: (config) => setState(prev => ({ ...prev, config })),
        onSave: handleConfigSave
      })
    ),

    // Main Translation Interface
    state.isConfigured && React.createElement(
      "div",
      { className: "grid grid-cols-1 lg:grid-cols-2 gap-6" },

      // Source JSON
      React.createElement(JSONEditor, {
        value: state.originalJSON,
        onChange: (value) => setState(prev => ({ ...prev, originalJSON: value })),
        title: "Source JSON",
        description: "Paste or upload your JSON file to translate",
        showValidation: true,
        showStats: true
      }),

      // Translated JSON
      React.createElement(JSONEditor, {
        value: state.translatedJSON,
        onChange: () => {}, // Read-only
        title: "Translated JSON",
        description: hasCompletedTranslations
          ? `Translated to ${SUPPORTED_LANGUAGES.find(lang => lang.code === state.config.targetLanguage)?.name || state.config.targetLanguage}`
          : "Translation results will appear here",
        readonly: true,
        showValidation: false,
        showStats: false,
        onDownload: state.translatedJSON ? handleDownloadTranslated : undefined,
        downloadFilename: `translation_${state.config.targetLanguage}.json`
      })
    ),

    // Translation Progress
    state.isConfigured && state.progressItems.length > 0 && React.createElement(TranslationProgress, {
      items: state.progressItems,
      currentIndex: state.currentIndex,
      isTranslating: state.isTranslating,
      onStart: handleStartTranslation,
      onPause: handlePauseTranslation,
      onResume: handleResumeTranslation,
      onStop: handleStopTranslation,
      onRetryFailed: handleRetryFailed
    }),

    // Action Buttons
    state.translatedJSON && React.createElement(
      Card,
      null,
      React.createElement(
        CardHeader,
        null,
        React.createElement(CardTitle, null, "Download & Export"),
        React.createElement(CardDescription, null, "Get your translated JSON file")
      ),
      React.createElement(
        CardContent,
        { className: "flex gap-4" },
        React.createElement(
          Button,
          {
            onClick: handleDownloadTranslated,
            className: "flex items-center gap-2"
          },
          "Download JSON"
        ),
        React.createElement(
          Button,
          {
            onClick: handleCopyToClipboard,
            variant: "outline",
            className: "flex items-center gap-2"
          },
          "Copy to Clipboard"
        )
      )
    ),

    // Errors
    state.errors.length > 0 && React.createElement(
      Alert,
      { variant: "destructive" },
      React.createElement(
        AlertDescription,
        null,
        React.createElement("strong", null, "Errors occurred:"),
        React.createElement(
          "ul",
          { className: "mt-2 list-disc list-inside space-y-1" },
          state.errors.map((error, index) =>
            React.createElement("li", { key: index }, error)
          )
        )
      )
    )
  )
}
