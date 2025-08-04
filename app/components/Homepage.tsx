import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./Card";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { cn } from "../lib/utils";

export function Homepage() {
  const features = [
    {
      title: "AI-Powered Translation",
      description:
        "Use OpenAI's GPT models to translate your JSON files with context awareness",
      icon: "🤖",
    },
    {
      title: "Secure & Private",
      description:
        "Your API keys are stored only in memory - we never save them permanently",
      icon: "🔒",
    },
    {
      title: "Batch Processing",
      description:
        "Translate entire JSON files key by key with progress tracking and error handling",
      icon: "⚡",
    },
    {
      title: "Multiple Languages",
      description:
        "Support for 50+ languages with automatic detection of source language",
      icon: "🌍",
    },
    {
      title: "Easy Export",
      description:
        "Download translated files or copy to clipboard with proper formatting",
      icon: "📥",
    },
    {
      title: "Extensible Design",
      description:
        "Built with a modular architecture to support multiple translation providers",
      icon: "🔧",
    },
  ];

  const supportedProviders = [
    {
      name: "OpenAI",
      status: "Available",
      models: ["GPT-4", "GPT-4 Turbo", "GPT-3.5 Turbo"],
    },
    {
      name: "Anthropic",
      status: "Available",
      models: ["Claude 3 Opus", "Claude 3 Sonnet", "Claude 3 Haiku"],
    },
  ];

  return React.createElement(
    "div",
    { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" },

    React.createElement(
      "div",
      { className: "container mx-auto px-6 py-16" },

      // Hero Section
      React.createElement(
        "div",
        { className: "text-center space-y-8 mb-16" },
        React.createElement(
          "div",
          { className: "space-y-4" },
          React.createElement(
            "h1",
            {
              className:
                "text-5xl md:text-6xl font-bold text-gradient leading-tight",
            },
            "JSON Translator",
          ),
          React.createElement(
            "p",
            {
              className:
                "text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed",
            },
            "Transform your JSON localization files with AI-powered translation. Fast, accurate, and secure translation for modern applications.",
          ),
        ),

        React.createElement(
          "div",
          {
            className:
              "flex flex-col sm:flex-row gap-4 justify-center items-center",
          },
          React.createElement(
            Link,
            { to: "/translate" },
            React.createElement(
              Button,
              { size: "lg", className: "text-lg px-8 py-3" },
              "Start Translating",
            ),
          ),
          React.createElement(
            Button,
            {
              variant: "outline",
              size: "lg",
              className: "text-lg px-8 py-3",
              onClick: () => {
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" });
              },
            },
            "Learn More",
          ),
        ),

        React.createElement(
          "div",
          { className: "flex flex-wrap justify-center gap-2 mt-6" },
          React.createElement(
            Badge,
            { variant: "secondary" },
            "No Registration Required",
          ),
          React.createElement(
            Badge,
            { variant: "secondary" },
            "Bring Your Own API Key",
          ),
          React.createElement(Badge, { variant: "secondary" }, "Open Source"),
        ),
      ),

      // Features Section
      React.createElement(
        "section",
        { id: "features", className: "space-y-12" },
        React.createElement(
          "div",
          { className: "text-center space-y-4" },
          React.createElement(
            "h2",
            { className: "text-3xl md:text-4xl font-bold" },
            "Why Choose JSON Translator?",
          ),
          React.createElement(
            "p",
            { className: "text-gray-600 max-w-2xl mx-auto" },
            "Built for developers, translators, and teams who need fast, reliable JSON localization.",
          ),
        ),

        React.createElement(
          "div",
          { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" },
          features.map((feature, index) =>
            React.createElement(
              Card,
              {
                key: index,
                className:
                  "hover:shadow-lg transition-shadow duration-200 border-0 shadow-md",
              },
              React.createElement(
                CardHeader,
                { className: "text-center" },
                React.createElement(
                  "div",
                  { className: "text-4xl mb-4" },
                  feature.icon,
                ),
                React.createElement(
                  CardTitle,
                  { className: "text-xl" },
                  feature.title,
                ),
              ),
              React.createElement(
                CardContent,
                null,
                React.createElement(
                  CardDescription,
                  { className: "text-center text-gray-600" },
                  feature.description,
                ),
              ),
            ),
          ),
        ),
      ),

      // How It Works Section
      React.createElement(
        "section",
        { className: "space-y-12 mt-20" },
        React.createElement(
          "div",
          { className: "text-center space-y-4" },
          React.createElement(
            "h2",
            { className: "text-3xl md:text-4xl font-bold" },
            "How It Works",
          ),
          React.createElement(
            "p",
            { className: "text-gray-600 max-w-2xl mx-auto" },
            "Get your JSON files translated in just a few simple steps.",
          ),
        ),

        React.createElement(
          "div",
          { className: "grid grid-cols-1 md:grid-cols-3 gap-8" },
          [
            {
              step: "1",
              title: "Configure Your Provider",
              description:
                "Add your OpenAI API key and select your preferred model and target language.",
              icon: "⚙️",
            },
            {
              step: "2",
              title: "Upload Your JSON",
              description:
                "Paste or upload your JSON localization file. We'll validate and show you a preview.",
              icon: "📁",
            },
            {
              step: "3",
              title: "Translate & Download",
              description:
                "Start the translation process and download your translated JSON file when complete.",
              icon: "✨",
            },
          ].map((step, index) =>
            React.createElement(
              "div",
              { key: index, className: "text-center space-y-4" },
              React.createElement(
                "div",
                {
                  className:
                    "w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto",
                },
                step.step,
              ),
              React.createElement("div", { className: "text-4xl" }, step.icon),
              React.createElement(
                "h3",
                { className: "text-xl font-semibold" },
                step.title,
              ),
              React.createElement(
                "p",
                { className: "text-gray-600" },
                step.description,
              ),
            ),
          ),
        ),
      ),

      // Supported Providers Section
      React.createElement(
        "section",
        { className: "space-y-8 mt-20" },
        React.createElement(
          "div",
          { className: "text-center space-y-4" },
          React.createElement(
            "h2",
            { className: "text-3xl md:text-4xl font-bold" },
            "Supported Providers",
          ),
          React.createElement(
            "p",
            { className: "text-gray-600 max-w-2xl mx-auto" },
            "We support multiple AI translation providers to give you the best results.",
          ),
        ),

        React.createElement(
          "div",
          {
            className:
              "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto",
          },
          supportedProviders.map((provider, index) =>
            React.createElement(
              Card,
              { key: index, className: "shadow-md" },
              React.createElement(
                CardHeader,
                null,
                React.createElement(
                  "div",
                  { className: "flex items-center justify-between" },
                  React.createElement(CardTitle, null, provider.name),
                  React.createElement(
                    Badge,
                    {
                      variant:
                        provider.status === "Available"
                          ? "success"
                          : "secondary",
                    },
                    provider.status,
                  ),
                ),
              ),
              React.createElement(
                CardContent,
                null,
                React.createElement(
                  "div",
                  { className: "space-y-2" },
                  React.createElement(
                    "p",
                    { className: "text-sm text-gray-600" },
                    "Available Models:",
                  ),
                  React.createElement(
                    "div",
                    { className: "flex flex-wrap gap-1" },
                    provider.models.map((model, modelIndex) =>
                      React.createElement(
                        Badge,
                        {
                          key: modelIndex,
                          variant: "outline",
                          className: "text-xs",
                        },
                        model,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),

      // CTA Section
      React.createElement(
        "section",
        {
          className:
            "text-center space-y-8 mt-20 py-16 bg-white rounded-2xl shadow-lg",
        },
        React.createElement(
          "div",
          { className: "space-y-4" },
          React.createElement(
            "h2",
            { className: "text-3xl md:text-4xl font-bold" },
            "Ready to Get Started?",
          ),
          React.createElement(
            "p",
            { className: "text-gray-600 max-w-2xl mx-auto text-lg" },
            "Join developers worldwide who trust JSON Translator for their localization needs.",
          ),
        ),
        React.createElement(
          Link,
          { to: "/translate" },
          React.createElement(
            Button,
            { size: "lg", className: "text-lg px-8 py-3" },
            "Start Translating Now",
          ),
        ),
        React.createElement(
          "p",
          { className: "text-sm text-gray-500" },
          "No account required • Secure • Fast",
        ),
      ),
    ),
  );
}
