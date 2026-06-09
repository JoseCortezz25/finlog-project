import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/renderer/app/query-client";
import { FinlogApp } from "@/renderer/features/finlog/finlog-app";
import "@/styles/global.css";

const container = document.getElementById("app");

if (!container) {
  throw new Error('No se encontro el elemento raiz con id "app".');
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FinlogApp />
    </QueryClientProvider>
  </StrictMode>
);
