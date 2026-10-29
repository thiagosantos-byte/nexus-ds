import { createRoot } from "react-dom/client";

import App from "./App";
import { ErrorBoundary } from "@/components/error-boundary";

import { AccessibilityProvider } from "./features/accessibility/AccessibilityProvider";
import { AccessibilityDock } from "./features/accessibility/AccessibilityDock";
import { CaptionsShortcut, ReadingGuide } from "./features/accessibility/AccessibilityPanel";
import "./index.css";
import "./features/login/login.css";
import "./features/accessibility/nexus-a11y.css";

createRoot(document.getElementById("root")!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    if (import.meta.env.DEV) console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <AccessibilityProvider>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo principal
      </a>
      <CaptionsShortcut />
      <ReadingGuide />
      <App />
      <AccessibilityDock />
    </AccessibilityProvider>
  </ErrorBoundary>,
);
