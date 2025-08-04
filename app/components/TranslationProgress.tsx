import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./Card";
import { Button } from "./Button";
import { Progress } from "./Progress";
import { Alert, AlertDescription } from "./Alert";
import { Badge } from "./Badge";
import { Spinner } from "./Spinner";
import { cn } from "../lib/utils";

export interface TranslationProgressItem {
  key: string;
  status: "pending" | "translating" | "completed" | "error";
  originalValue: string;
  translatedValue?: string;
  error?: string;
}

export interface TranslationProgressProps {
  items: TranslationProgressItem[];
  currentIndex: number;
  isTranslating: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  className?: string;
  showDetails?: boolean;
  batchProgress?: {
    completed: number;
    total: number;
    percentage: number;
    currentBatch: number;
    totalBatches: number;
    itemsPerSecond: number;
    estimatedTimeRemaining: number;
  };
  estimatedTime?: number;
  useOptimizedTranslation?: boolean;
}

export function TranslationProgress({
  items,
  currentIndex,
  isTranslating,
  onStart,
  onPause,
  onResume,
  onStop,
  onRetryFailed,
  className,
  showDetails = true,
  batchProgress,
  estimatedTime,
  useOptimizedTranslation = true,
}: TranslationProgressProps) {
  const totalItems = items.length;
  const completedItems = items.filter(
    (item) => item.status === "completed",
  ).length;
  const errorItems = items.filter((item) => item.status === "error").length;
  const pendingItems = items.filter((item) => item.status === "pending").length;

  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const hasErrors = errorItems > 0;
  const hasStarted = currentIndex > 0 || isTranslating;
  const isCompleted = completedItems === totalItems && totalItems > 0;
  const canRetry = hasErrors && !isTranslating;

  const currentItem = items[currentIndex];

  const getStatusIcon = (status: TranslationProgressItem["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "translating":
        return React.createElement(Spinner, {
          size: "sm",
          className: "inline-block",
        });
      case "completed":
        return "✅";
      case "error":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStatusText = () => {
    if (isCompleted) {
      return hasErrors
        ? "Completed with errors"
        : "Translation completed successfully";
    }
    if (isTranslating) {
      if (useOptimizedTranslation && batchProgress) {
        return `Processing batch ${batchProgress.currentBatch}/${batchProgress.totalBatches} (${batchProgress.itemsPerSecond.toFixed(1)} items/sec)`;
      }
      return `Translating: ${currentItem?.key || "Processing..."}`;
    }
    if (hasStarted) {
      return "Translation paused";
    }
    if (estimatedTime) {
      return `Ready to translate (estimated: ${Math.ceil(estimatedTime)}s)`;
    }
    return "Ready to translate";
  };

  const getProgressVariant = ():
    | "default"
    | "success"
    | "warning"
    | "error" => {
    if (isCompleted) {
      return hasErrors ? "warning" : "success";
    }
    if (hasErrors) {
      return "warning";
    }
    return "default";
  };

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
          React.createElement(
            CardTitle,
            { className: "text-lg" },
            "Translation Progress",
          ),
          React.createElement(CardDescription, null, getStatusText()),
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2" },
          !hasStarted &&
            totalItems > 0 &&
            React.createElement(
              Button,
              {
                onClick: onStart,
                disabled: isTranslating,
                className: "flex items-center gap-2",
              },
              "Start Translation",
            ),
          isTranslating &&
            React.createElement(
              Button,
              {
                onClick: onPause,
                variant: "outline",
                className: "flex items-center gap-2",
              },
              "Pause",
            ),
          hasStarted &&
            !isTranslating &&
            !isCompleted &&
            React.createElement(
              Button,
              {
                onClick: onResume,
                variant: "outline",
                className: "flex items-center gap-2",
              },
              "Resume",
            ),
          hasStarted &&
            !isCompleted &&
            React.createElement(
              Button,
              {
                onClick: onStop,
                variant: "destructive",
                size: "sm",
              },
              "Stop",
            ),
          canRetry &&
            React.createElement(
              Button,
              {
                onClick: onRetryFailed,
                variant: "outline",
                size: "sm",
              },
              "Retry Failed",
            ),
        ),
      ),
    ),

    React.createElement(
      CardContent,
      { className: "space-y-4" },

      // Progress bar
      totalItems > 0 &&
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(Progress, {
            value: progress,
            max: 100,
            variant: getProgressVariant(),
            className: "w-full",
          }),
          React.createElement(
            "div",
            { className: "flex justify-between text-sm text-gray-600" },
            React.createElement(
              "span",
              null,
              `${completedItems} of ${totalItems} completed`,
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement("span", null, `${Math.round(progress)}%`),
              useOptimizedTranslation &&
                batchProgress &&
                React.createElement(
                  "span",
                  { className: "text-xs text-blue-600" },
                  `• ${batchProgress.itemsPerSecond.toFixed(1)}/s`,
                ),
            ),
          ),
        ),

      // Status badges
      totalItems > 0 &&
        React.createElement(
          "div",
          { className: "flex flex-wrap items-center gap-2" },
          React.createElement(
            Badge,
            { variant: "secondary" },
            `${totalItems} total`,
          ),
          completedItems > 0 &&
            React.createElement(
              Badge,
              { variant: "success" },
              `${completedItems} completed`,
            ),
          errorItems > 0 &&
            React.createElement(
              Badge,
              { variant: "destructive" },
              `${errorItems} errors`,
            ),
          pendingItems > 0 &&
            React.createElement(
              Badge,
              { variant: "outline" },
              `${pendingItems} pending`,
            ),
          useOptimizedTranslation &&
            React.createElement(
              Badge,
              { variant: "secondary" },
              "⚡ Optimized",
            ),
        ),

      // Current processing status
      isTranslating &&
        React.createElement(
          Alert,
          null,
          React.createElement(
            AlertDescription,
            { className: "flex items-center gap-2" },
            React.createElement(Spinner, { size: "sm" }),
            React.createElement(
              "span",
              { className: "font-medium" },
              useOptimizedTranslation ? "Processing batch:" : "Translating:",
            ),
            useOptimizedTranslation && batchProgress
              ? React.createElement(
                  "span",
                  { className: "text-sm" },
                  `Batch ${batchProgress.currentBatch}/${batchProgress.totalBatches} • ${batchProgress.estimatedTimeRemaining > 0 ? `${Math.ceil(batchProgress.estimatedTimeRemaining)}s remaining` : "Almost done"}`,
                )
              : currentItem &&
                  React.createElement(
                    "code",
                    { className: "text-sm" },
                    currentItem.key,
                  ),
          ),
        ),

      // Error summary
      hasErrors &&
        React.createElement(
          Alert,
          { variant: "destructive" },
          React.createElement(
            AlertDescription,
            null,
            `${errorItems} translation${errorItems === 1 ? "" : "s"} failed. You can retry failed translations or continue with the current results.`,
          ),
        ),

      // Completion message
      isCompleted &&
        React.createElement(
          Alert,
          { variant: hasErrors ? "warning" : "success" },
          React.createElement(
            AlertDescription,
            null,
            hasErrors
              ? `Translation completed with ${errorItems} error${errorItems === 1 ? "" : "s"}. Check the details below for failed translations.`
              : "All translations completed successfully! You can now copy or download the translated JSON.",
          ),
        ),

      // Detailed progress list (optional)
      showDetails &&
        totalItems > 0 &&
        totalItems <= 20 &&
        React.createElement(
          "div",
          { className: "space-y-2" },
          React.createElement(
            "h4",
            { className: "text-sm font-medium text-gray-700" },
            "Translation Details",
          ),
          React.createElement(
            "div",
            { className: "max-h-60 overflow-y-auto space-y-1" },
            items.map((item, index) =>
              React.createElement(
                "div",
                {
                  key: item.key,
                  className: cn(
                    "flex items-center gap-2 p-2 rounded text-sm",
                    item.status === "completed" && "bg-green-50",
                    item.status === "error" && "bg-red-50",
                    item.status === "translating" && "bg-blue-50",
                    item.status === "pending" && "bg-gray-50",
                  ),
                },
                React.createElement(
                  "span",
                  { className: "w-4 h-4 flex items-center justify-center" },
                  getStatusIcon(item.status),
                ),
                React.createElement(
                  "code",
                  { className: "font-mono text-xs flex-1 truncate" },
                  item.key,
                ),
                item.status === "error" &&
                  item.error &&
                  React.createElement(
                    "span",
                    { className: "text-red-600 text-xs truncate max-w-40" },
                    item.error,
                  ),
              ),
            ),
          ),
        ),

      // Show summary for large lists
      showDetails &&
        totalItems > 20 &&
        React.createElement(
          "div",
          { className: "text-sm text-gray-600" },
          `Too many items to show details (${totalItems} total). Progress is shown above.`,
        ),
    ),
  );
}
