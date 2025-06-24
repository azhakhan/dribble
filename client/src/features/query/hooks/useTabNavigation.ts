import { useState, useCallback, useRef, useEffect } from "react";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useUnsavedChangesStore } from "@/shared/store/useUnsavedChangesStore";

export function useTabNavigation() {
  // Get state and actions from stores
  const { openTabs, activeTabId, closeQueryTabWithConfirmation, setActiveTab } =
    useTabManagerStore();

  // Refs for scrolling functionality
  const tabBarScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current && tabBarScrollRef.current) {
      const tabElement = activeTabRef.current;
      const scrollContainer = tabBarScrollRef.current;

      // Calculate the relative position within the scroll container
      const tabLeft = tabElement.offsetLeft;
      const tabRight = tabLeft + tabElement.offsetWidth;
      const scrollLeft = scrollContainer.scrollLeft;
      const containerWidth = scrollContainer.clientWidth;

      // Check if tab is not fully visible and scroll if needed
      if (tabLeft < scrollLeft) {
        // Tab is cut off on the left, scroll to show it
        scrollContainer.scrollTo({
          left: tabLeft - 10, // Add some padding
          behavior: "smooth"
        });
      } else if (tabRight > scrollLeft + containerWidth) {
        // Tab is cut off on the right, scroll to show it
        scrollContainer.scrollTo({
          left: tabRight - containerWidth + 10, // Add some padding
          behavior: "smooth"
        });
      }
    }
  }, [activeTabId, openTabs.length]);

  // Handle closing a tab
  const handleCloseTab = useCallback(
    async (tabId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      await closeQueryTabWithConfirmation(tabId);
    },
    [closeQueryTabWithConfirmation]
  );

  // Handle tab click to make it active
  const handleTabClick = useCallback(
    async (tabId: string) => {
      await setActiveTab(tabId);
    },
    [setActiveTab]
  );

  // Handle right-click context menu
  const handleRightClick = useCallback((tabId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  }, []);

  // Handle closing other tabs
  const handleCloseOthers = useCallback(
    async (exceptTabId: string) => {
      const { showUnsavedChangesDialog } = useUnsavedChangesStore.getState();
      const { closeQueryTab } = useTabManagerStore.getState();

      // Check if any other tabs have unsaved changes
      const otherTabs = openTabs.filter((tab) => tab.id !== exceptTabId);
      const dirtyTabs = otherTabs.filter((tab) => tab.isDirty);

      if (dirtyTabs.length > 0) {
        // If there are dirty tabs, show a single confirmation for all
        const shouldClose = await showUnsavedChangesDialog(dirtyTabs[0].id, "closeOthers");
        if (!shouldClose) return;
      }

      // Close all other tabs
      otherTabs.forEach((tab) => {
        closeQueryTab(tab.id);
      });
    },
    [openTabs]
  );

  // Handle closing tabs to the right
  const handleCloseToRight = useCallback(
    async (fromTabId: string) => {
      const { showUnsavedChangesDialog } = useUnsavedChangesStore.getState();
      const { closeQueryTab } = useTabManagerStore.getState();
      const fromIndex = openTabs.findIndex((tab) => tab.id === fromTabId);
      if (fromIndex === -1) return;

      // Get tabs to the right
      const tabsToClose = openTabs.slice(fromIndex + 1);
      const dirtyTabs = tabsToClose.filter((tab) => tab.isDirty);

      if (dirtyTabs.length > 0) {
        // If there are dirty tabs, show a single confirmation for all
        const shouldClose = await showUnsavedChangesDialog(dirtyTabs[0].id, "closeToRight");
        if (!shouldClose) return;
      }

      // Close all tabs to the right
      tabsToClose.forEach((tab) => {
        closeQueryTab(tab.id);
      });
    },
    [openTabs]
  );

  // Check if there are tabs to the right
  const canCloseToRight = useCallback(
    (tabId: string) => {
      const tabIndex = openTabs.findIndex((tab) => tab.id === tabId);
      return tabIndex !== -1 && tabIndex < openTabs.length - 1;
    },
    [openTabs]
  );

  return {
    openTabs,
    activeTabId,
    contextMenu,
    setContextMenu,
    tabBarScrollRef,
    activeTabRef,
    handleCloseTab,
    handleTabClick,
    handleRightClick,
    handleCloseOthers,
    handleCloseToRight,
    canCloseToRight
  };
}
