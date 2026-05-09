import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { installTimeTravelAnalyticsBridge } from "./utils/installTimeTravelAnalytics";

installTimeTravelAnalyticsBridge();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
