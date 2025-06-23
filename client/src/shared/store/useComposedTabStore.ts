import { useTabManagerStore } from "./useTabManagerStore";
import { useTabContentStore } from "./useTabContentStore";
import { useTabExecutionStore } from "./useTabExecutionStore";
import { useTableFilterStore } from "./useTableFilterStore";
import { useUnsavedChangesStore } from "./useUnsavedChangesStore";

// Export a composed interface that matches the original useTabStore
export const useComposedTabStore = () => {
  const tabManager = useTabManagerStore();
  const tabContent = useTabContentStore();
  const tabExecution = useTabExecutionStore();
  const tableFilter = useTableFilterStore();
  const unsavedChanges = useUnsavedChangesStore();

  return {
    // Tab state from manager
    openTabs: tabManager.openTabs,
    activeTabId: tabManager.activeTabId,

    // Content state
    editorContent: tabContent.editorContent,

    // Filter state
    tableFilters: tableFilter.tableFilters,

    // Unsaved changes dialog state
    unsavedChangesDialog: unsavedChanges.unsavedChangesDialog,

    // Tab lifecycle actions from manager
    openQueryTab: tabManager.openQueryTab,
    closeQueryTab: tabManager.closeQueryTab,
    closeQueryTabWithConfirmation: tabManager.closeQueryTabWithConfirmation,
    closeTabsByQueryId: tabManager.closeTabsByQueryId,
    setActiveTab: tabManager.setActiveTab,
    updateTabTitle: tabManager.updateTabTitle,
    loadQueryInTab: tabManager.loadQueryInTab,

    // Content actions
    setEditorContent: tabContent.setEditorContent,

    // Execution actions
    executeQuery: tabExecution.executeQuery,

    // Filter actions
    setTableFilterOffset: tableFilter.setTableFilterOffset,
    setTableFilterWhere: tableFilter.setTableFilterWhere,
    setTableFilterOrderBy: tableFilter.setTableFilterOrderBy,
    setTableFilterPageSize: tableFilter.setTableFilterPageSize,
    clearTableFilters: tableFilter.clearTableFilters,
    getTableFilters: tableFilter.getTableFilters,
    getTabFilterState: tableFilter.getTabFilterState,
    updateFilterAndExecuteQuery: tableFilter.updateFilterAndExecuteQuery,

    // Unsaved changes actions
    hasUnsavedChanges: unsavedChanges.hasUnsavedChanges,
    discardChanges: unsavedChanges.discardChanges,
    saveChanges: unsavedChanges.saveChanges,
    showUnsavedChangesDialog: unsavedChanges.showUnsavedChangesDialog,
    hideUnsavedChangesDialog: unsavedChanges.hideUnsavedChangesDialog,
    handleDialogSave: unsavedChanges.handleDialogSave,
    handleDialogDiscard: unsavedChanges.handleDialogDiscard,

    // Helper functions from manager
    shouldAutoExecuteQuery: tabManager.shouldAutoExecuteQuery,
    initializeQueryTabsRuntimeStates: tabManager.initializeQueryTabsRuntimeStates,
    openQueryFromTree: tabManager.openQueryFromTree,
    openTableFromTree: tabManager.openTableFromTree,

    // Provide individual stores for advanced use cases
    stores: {
      tabManager,
      tabContent,
      tabExecution,
      tableFilter,
      unsavedChanges
    }
  };
};

// For backwards compatibility, also export as useTabStore
export const useTabStore = useComposedTabStore;
