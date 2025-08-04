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
import { cn } from "../lib/utils";
import { JSONProcessor } from "../lib/json-processor";

export interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  title?: string;
  description?: string;
  className?: string;
  showValidation?: boolean;
  showStats?: boolean;
  onFileUpload?: (content: string) => void;
  onDownload?: () => void;
  downloadFilename?: string;
}

// Simple JSON syntax highlighter
function highlightJSON(json: string): string {
  if (!json.trim()) return json;

  try {
    // Parse and re-stringify to validate JSON
    const parsed = JSON.parse(json);
    const formatted = JSON.stringify(parsed, null, 2);

    return formatted
      .replace(/("([^"\\]|\\.)*")\s*:/g, '<span class="json-key">$1</span>:')
      .replace(
        /:\s*("([^"\\]|\\.)*")/g,
        ': <span class="json-string">$1</span>',
      )
      .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
      .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
      .replace(/([{}])/g, '<span class="json-bracket">$1</span>')
      .replace(/(\[|\])/g, '<span class="json-bracket">$1</span>');
  } catch {
    return json;
  }
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
  downloadFilename = "translated.json",
}: JSONEditorProps) {
  const [validation, setValidation] = React.useState<{
    valid: boolean;
    error?: string;
    keyCount?: number;
  }>({ valid: true });

  const [showSyntaxHighlight, setShowSyntaxHighlight] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Validate JSON when value changes
  React.useEffect(() => {
    if (!value.trim()) {
      setValidation({ valid: true });
      return;
    }

    if (showValidation) {
      const result = JSONProcessor.validateForTranslation(value);
      setValidation(result);
    }
  }, [value, showValidation]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (onFileUpload) {
        onFileUpload(content);
      } else {
        onChange(content);
      }
    };
    reader.readAsText(file);

    // Clear the input value so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFormatJSON = () => {
    try {
      const parsed = JSON.parse(value);
      const formatted = JSONProcessor.formatJSON(parsed, 2);
      onChange(formatted);
    } catch (error) {
      // If formatting fails, we don't change the value
      console.warn("Failed to format JSON:", error);
    }
  };

  const handleClearContent = () => {
    onChange("");
  };

  const getStats = () => {
    if (!value.trim() || !validation.valid) return null;

    try {
      const parsed = JSON.parse(value);
      const keyCount = JSONProcessor.countTranslatableStrings(parsed);
      const charCount = value.length;
      const estimate = JSONProcessor.estimateTranslationCost(parsed, "openai");

      return {
        keyCount,
        charCount,
        estimatedTokens: estimate.estimatedTokens,
        estimatedCost: estimate.estimatedCost,
      };
    } catch {
      return null;
    }
  };

  const stats = showStats ? getStats() : null;

  return (
    <>
      {/* JSON Syntax Highlighting Styles */}
      <style>{`
        .json-key { color: #0066cc; font-weight: 600; }
        .json-string { color: #009900; }
        .json-number { color: #cc6600; }
        .json-boolean { color: #cc0066; font-weight: 600; }
        .json-null { color: #999999; font-style: italic; }
        .json-bracket { color: #666666; font-weight: bold; }
        .json-preview {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          white-space: pre-wrap;
          word-wrap: break-word;
          line-height: 1.5;
          font-size: 14px;
        }
      `}</style>

      <Card className={cn("flex flex-col h-full", className)}>
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm mt-1">
                  {description}
                </CardDescription>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!readonly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 Upload
                </Button>
              )}
              {!readonly && value.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFormatJSON}
                  disabled={!validation.valid}
                >
                  ✨ Format
                </Button>
              )}
              {readonly && validation.valid && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSyntaxHighlight(!showSyntaxHighlight)}
                >
                  {showSyntaxHighlight ? "📝" : "🎨"}{" "}
                  {showSyntaxHighlight ? "Edit" : "Highlight"}
                </Button>
              )}
              {!readonly && value.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearContent}
                >
                  🗑️ Clear
                </Button>
              )}
              {readonly && onDownload && (
                <Button variant="outline" size="sm" onClick={onDownload}>
                  📥 Download
                </Button>
              )}
            </div>
          </div>

          {/* File input (hidden) */}
          {!readonly && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileUpload}
              className="hidden"
            />
          )}

          {/* Validation and Stats */}
          {(showValidation || showStats) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {/* Validation status */}
              {showValidation && value.trim() && (
                <Badge
                  variant={validation.valid ? "success" : "destructive"}
                  className="text-xs"
                >
                  {validation.valid ? "✓ Valid JSON" : "✗ Invalid JSON"}
                </Badge>
              )}

              {/* Stats badges */}
              {stats && (
                <>
                  <Badge variant="secondary" className="text-xs">
                    📝 {stats.keyCount} keys
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    📊 {stats.charCount.toLocaleString()} chars
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    🎯 ~{stats.estimatedTokens.toLocaleString()} tokens
                  </Badge>
                  {stats.estimatedCost > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      💰 ~${stats.estimatedCost.toFixed(4)}
                    </Badge>
                  )}
                </>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0 p-4">
          {/* Validation error */}
          {showValidation && !validation.valid && validation.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{validation.error}</AlertDescription>
            </Alert>
          )}

          {/* Editor Area */}
          <div className="flex-1 relative min-h-0">
            {readonly && showSyntaxHighlight && validation.valid ? (
              // Syntax highlighted view
              <div
                className={cn(
                  "w-full h-full p-4 rounded-md border border-gray-300 bg-gray-50 overflow-auto",
                  "json-preview",
                )}
                dangerouslySetInnerHTML={{
                  __html: highlightJSON(value),
                }}
              />
            ) : (
              // Regular textarea
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  onChange(e.target.value)
                }
                placeholder={placeholder}
                readOnly={readonly}
                className={cn(
                  "w-full h-full p-4 rounded-md border border-gray-300 bg-white text-sm font-mono resize-none",
                  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  "placeholder:text-gray-500",
                  readonly && "bg-gray-50 cursor-default",
                  "min-h-[600px]", // Ensure minimum height
                )}
                spellCheck={false}
                style={{
                  lineHeight: "1.5",
                  tabSize: 2,
                  fontSize: "14px",
                }}
              />
            )}
          </div>

          {/* Footer Info */}
          <div className="flex justify-between items-center text-xs text-gray-500 mt-2 pt-2 border-t">
            <span>
              {value.length.toLocaleString()} characters
              {value.split("\n").length > 1 &&
                ` • ${value.split("\n").length} lines`}
            </span>
            {readonly ? (
              <span>Read-only</span>
            ) : (
              <span>Tab for indent • Ctrl+A to select all</span>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
