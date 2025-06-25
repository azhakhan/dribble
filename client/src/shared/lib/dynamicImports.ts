// Dynamic imports for optional features

// LLM Features - Individual component imports
export const loadLLMList = () =>
  import("@/features/llm/LLMList").then((m) => ({ default: m.LLMList }));
export const loadLLMDialog = () =>
  import("@/features/llm/LLMDialog").then((m) => ({ default: m.LLMDialog }));
export const loadLLMForm = () =>
  import("@/features/llm/LLMForm").then((m) => ({ default: m.LLMForm }));

// Chat Features - Individual component imports
export const loadChatSidebar = () =>
  import("@/features/chat/ChatSidebar").then((m) => ({ default: m.ChatSidebar }));
export const loadSQLCodeBlock = () =>
  import("@/features/chat/SQLCodeBlock").then((m) => ({ default: m.SQLCodeBlock }));

// Editor Features
export const loadMonacoEditor = () => import("@/features/editor/MonacoSQLEditor");
export const loadMonacoDiffEditor = () => import("@/features/editor/MonacoDiffEditor");
