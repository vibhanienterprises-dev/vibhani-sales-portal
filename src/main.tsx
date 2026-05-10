import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl || !apiUrl.startsWith("http")) {
  console.error("❌ [VITE_API_URL] is missing or invalid! API calls will likely fail. Current value:", apiUrl);
  console.log("Please ensure VITE_API_URL is set in your Vercel Environment Variables (e.g., https://your-backend.onrender.com)");
}
setBaseUrl(apiUrl || "");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
