// Export all stores
export { useSourceStore } from "./useSourceStore";
export { useQueryStore } from "./useQueryStore";
export { useTabStore } from "./useTabStore";
export { useTreeStore } from "./useTreeStore";
export { useChatStore } from "./useChatStore";
export { useUIStore } from "./useUIStore";

// Export types
export * from "./types";

// Export legacy store (will be deprecated)
export { useAppStore } from "./useAppStore";

// Import stores for migration
import { useAppStore } from "./useAppStore";
import { useSourceStore } from "./useSourceStore";
import { useQueryStore } from "./useQueryStore";
import { useTabStore } from "./useTabStore";
import { useTreeStore } from "./useTreeStore";
import { useChatStore } from "./useChatStore";
import { useUIStore } from "./useUIStore";
import type { ChatMessage } from "./types";

// Helper function to migrate from old store to new stores
export const migrateFromAppStore = () => {
  const appStore = useAppStore.getState();
  const sourceStore = useSourceStore.getState();
  const queryStore = useQueryStore.getState();
  const tabStore = useTabStore.getState();
  const treeStore = useTreeStore.getState();
  const chatStore = useChatStore.getState();
  const uiStore = useUIStore.getState();

  // Migrate source data
  if (appStore.sources) sourceStore.setSources(Object.values(appStore.sources));
  if (appStore.selectedSource) sourceStore.setSelectedSource(appStore.selectedSource);
  if (appStore.connectedSourcesData)
    sourceStore.setConnectedSourcesData(appStore.connectedSourcesData);

  // Migrate query data
  Object.entries(appStore.queries || {}).forEach(([id, query]) => {
    queryStore.setQuery(id, query);
  });
  Object.entries(appStore.queryVersions || {}).forEach(([id, versions]) => {
    queryStore.setQueryVersions(id, versions);
  });
  Object.entries(appStore.queryRuns || {}).forEach(([id, runs]) => {
    queryStore.setQueryRuns(id, runs);
  });

  // Migrate tab data
  if (appStore.openTabs && appStore.openTabs.length > 0) {
    tabStore.openTabs = appStore.openTabs;
    tabStore.activeTabId = appStore.activeTabId;
  }

  // Migrate tree data
  if (appStore.sidebarState) {
    treeStore.sidebarState = appStore.sidebarState;
  }
  if (appStore.selectedNodeId !== undefined) {
    treeStore.setSelectedNodeId(appStore.selectedNodeId);
  }

  // Migrate chat data
  if (appStore.selectedLLM) chatStore.setSelectedLLM(appStore.selectedLLM);
  if (appStore.messages) appStore.messages.forEach((msg: ChatMessage) => chatStore.addMessage(msg));
  if (appStore.sessionId) chatStore.setSessionId(appStore.sessionId);
  if (appStore.proposedChanges) chatStore.setProposedChanges(appStore.proposedChanges);

  // Migrate UI data
  if (appStore.panelSizes) uiStore.setPanelSizes(appStore.panelSizes);

  console.log("Migration from useAppStore completed");
};
