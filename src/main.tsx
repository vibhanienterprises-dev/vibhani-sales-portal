import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const apiUrl = import.meta.env.VITE_API_URL;

if (!apiUrl) {
  throw new Error("❌ [FATAL] VITE_API_URL is undefined. Please set it in your environment variables.");
}

if (!apiUrl.startsWith("http")) {
  throw new Error(`❌ [FATAL] VITE_API_URL must be an absolute URL starting with http/https. Current value: "${apiUrl}"`);
}

// Ensuring API URL is absolute and correctly applied for cross-origin requests
console.info(`✅ [API] Base URL set to: ${apiUrl}`);
setBaseUrl(apiUrl);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
