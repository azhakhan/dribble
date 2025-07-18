import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  optimizeDeps: {
    // Exclude Monaco and Monaco SQL Languages from dependency optimization
    exclude: ["monaco-editor", "monaco-sql-languages"]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          vendor: ["react", "react-dom"],
          ui: ["@glideapps/glide-data-grid", "lucide-react"],
          stores: ["zustand"],
          monaco: ["monaco-editor", "monaco-sql-languages"],
          // Routing and panels
          routing: ["react-router-dom"],
          panels: ["react-resizable-panels"],
          // Feature chunks
          llm: [
            "src/features/llm/LLMList.tsx",
            "src/features/llm/LLMDialog.tsx",
            "src/features/llm/LLMForm.tsx"
          ],
          chat: ["src/features/chat/ChatSidebar.tsx", "src/features/chat/SQLCodeBlock.tsx"],
          editor: [
            "src/features/editor/Editor.tsx",
            "src/features/editor/MonacoSQLEditor.tsx",
            "src/features/editor/MonacoDiffEditor.tsx"
          ]
        }
      }
    }
  },
  server: {
    port: 3000,
    strictPort: true, // Don't try other ports if 3000 is taken
    host: true, // Listen on all addresses, including network and LAN
    proxy: {
      "/api": {
        target: "http://server:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
});
