import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "@/components/ui/sonner";
import "./index.css";
// Import Monaco SQL setup to initialize workers and language contributions
import "@/shared/lib/monaco-setup";
import App from "./App.tsx";
import { queryClient } from "@/shared/lib/query-client";

// Import migration function
import { migrateFromAppStore } from "@/shared/store";

// Run migration on app startup if needed
const runMigration = () => {
  const hasRunMigration = localStorage.getItem("dribble-store-migration-v1");
  if (!hasRunMigration) {
    console.log("Running store migration...");
    try {
      migrateFromAppStore();
      localStorage.setItem("dribble-store-migration-v1", "true");
      console.log("Store migration completed successfully");
    } catch (error) {
      console.error("Store migration failed:", error);
    }
  }
};

// Run migration before app starts
runMigration();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  </StrictMode>
);
