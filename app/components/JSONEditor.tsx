import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card"
import { Button } from "./Button"
import { Textarea } from "./Textarea"
import { Alert, AlertDescription } from "./Alert"
import { Badge } from "./Badge"
import { cn } from "../lib/utils"
import { JSONProcessor } from "../lib/json-processor"

export interface JSONEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  readonly?: boolean
  title?: string
  description?: string
  className?: string
  showValidation?: boolean
  showStats?: boolean
  onFileUpload?: (content: string) => void
  onDownload?: () => void
  downloadFilename?: string
}

export function JSONEditor({
  value,
  onChange,
  placeholder = "Paste your JSON content here...",
  readonly = false,
  title = "JSON Content",
  description,
  className,
  showValidation = true,
  showStats = true,
  onFileUpload,
  onDownload,
  downloadFilename = "translated.json"
}: JSONEditorProps) {
  const [validation, setValidation] = React.useState<{
    valid: boolean
    error?: string
    keyCount?: number
  }>({ valid: true })

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Validate JSON when value changes
  React.useEffect(() => {
    if (!value.trim()) {
      setValidation({ valid: true })
      return
    }

    if (showValidation) {
      const result = JSONProcessor.validateForTranslation(value)
      setValidation(result)
    }
  }, [value, showValidation])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (onFileUpload) {
        onFileUpload(content)
      } else {
        onChange(content)
      }
    }
    reader.readAsText(file)

    // Clear the input value so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFormatJSON = () => {
    try {
      const parsed = JSON.parse(value)
      const formatted = JSONProcessor.formatJSON(parsed, 2)
      onChange(formatted)
    } catch (error) {
      // If formatting fails, we don't change the value
      console.warn('Failed to format JSON:', error)
    }
  }

  const handleClearContent = () => {
    onChange('')
  }

  const getStats = () => {
    if (!value.trim() || !validation.valid) return null

    try {
      const parsed = JSON.parse(value)
      const keyCount = JSONProcessor.countTranslatableStrings(parsed)
      const charCount = value.length
      const estimate = JSONProcessor.estimateTranslationCost(parsed, 'openai')

      return {
        keyCount,
        charCount,
        estimatedTokens: estimate.estimatedTokens,
        estimatedCost: estimate.estimatedCost
      }
    } catch {
      return null
    }
  }

  const stats = showStats ? getStats() : null

  return React.createElement(
    Card,
    { className: cn("w-full", className) },
    React.createElement(
      CardHeader,
      null,
      React.createElement(
        "div",
        { className: "flex items-center justify-between" },
        React.createElement(
          "div",
          null,
          React.createElement(CardTitle, { className: "text-lg" }, title),
          description && React.createElement(CardDescription, null, description)
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2" },
          !readonly && React.createElement(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: () => fileInputRef.current?.click()
            },
            "Upload JSON"
          ),
          !readonly && value.trim() && React.createElement(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: handleFormatJSON,
              disabled: !validation.valid
            },
            "Format"
          ),
          !readonly && value.trim() && React.createElement(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: handleClearContent
            },
            "Clear"
          ),
          readonly && onDownload && React.createElement(
            Button,
            {
              variant: "outline",
              size: "sm",
              onClick: onDownload
            },
            "Download"
          )
        )
      ),

      // File input (hidden)
      !readonly && React.createElement("input", {
        ref: fileInputRef,
        type: "file",
        accept: ".json,application/json",
        onChange: handleFileUpload,
        className: "hidden"
      }),

      // Validation and Stats
      (showValidation || showStats) && React.createElement(
        "div",
        { className: "flex flex-wrap items-center gap-2 pt-2" },

        // Validation status
        showValidation && value.trim() && React.createElement(
          Badge,
          {
            variant: validation.valid ? "default" : "destructive",
            className: "text-xs"
          },
          validation.valid ? "Valid JSON" : "Invalid JSON"
        ),

        // Stats badges
        stats && React.createElement(
          React.Fragment,
          null,
          React.createElement(
            Badge,
            { variant: "secondary", className: "text-xs" },
            `${stats.keyCount} translatable keys`
          ),
          React.createElement(
            Badge,
            { variant: "secondary", className: "text-xs" },
            `${stats.charCount.toLocaleString()} characters`
          ),
          React.createElement(
            Badge,
            { variant: "secondary", className: "text-xs" },
            `~${stats.estimatedTokens.toLocaleString()} tokens`
          ),
          stats.estimatedCost > 0 && React.createElement(
            Badge,
            { variant: "secondary", className: "text-xs" },
            `~$${stats.estimatedCost.toFixed(4)} estimated cost`
          )
        )
      )
    ),

    React.createElement(
      CardContent,
      { className: "space-y-4" },

      // Validation error
      showValidation && !validation.valid && validation.error && React.createElement(
        Alert,
        { variant: "destructive" },
        React.createElement(AlertDescription, null, validation.error)
      ),

      // Text area
      React.createElement(Textarea, {
        value,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value),
        placeholder,
        readOnly: readonly,
        className: cn(
          "min-h-[400px] font-mono text-sm resize-y",
          readonly && "bg-gray-50 cursor-default"
        ),
        spellCheck: false
      })
    )
  )
}
