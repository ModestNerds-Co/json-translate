import { createFileRoute } from "@tanstack/react-router";
import { Homepage } from "../components/Homepage";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return <Homepage />;
}
