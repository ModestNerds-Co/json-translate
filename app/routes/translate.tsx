import { createFileRoute } from "@tanstack/react-router";
import { TranslationPage } from "../components/TranslationPage";

export const Route = createFileRoute("/translate")({
  component: TranslateComponent,
});

function TranslateComponent() {
  return <TranslationPage />;
}
