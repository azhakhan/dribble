import { X, Plus } from "lucide-react";
import { useCallback, memo, useRef, useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { Query } from "./Query";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useUnsavedChangesStore } from "@/shared/store/useUnsavedChangesStore";
import { useSourceStore } from "@/shared/store";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { generateQueryName } from "@/shared/lib/queryUtils";
import { useCreateQuery } from "@/shared/hooks/useCreateQuery";
import { Capybara } from "@/components/Capybara";

// New Query Modal component
// New Query Modal component
const NewQueryModal = memo(
  ({
    isOpen,
    onClose,
    onCreateQuery,
    sources,
    defaultSourceId,
    position
  }: {
    isOpen: boolean;
    onClose: () => void;
    onCreateQuery: (name: string, sourceId: string) => void;
    sources: Array<{ id: string; name: string }>;
    defaultSourceId?: string;
    position?: { x: number; y: number } | null;
  }) => {
    const [queryName, setQueryName] = useState("");
    const [selectedSourceId, setSelectedSourceId] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Initialize form when modal opens
    useEffect(() => {
      if (isOpen) {
        setQueryName(generateQueryName());
        const sourceToSelect = defaultSourceId || (sources.length > 0 ? sources[0].id : "");
        setSelectedSourceId(sourceToSelect);

        // Focus input after a short delay
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 100);
      }
    }, [isOpen, defaultSourceId, sources]);

    // Handle escape key
    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape" && isOpen) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
      }
    }, [isOpen, onClose]);

    // Handle form submission
    const handleSubmit = useCallback(
      (e: React.FormEvent) => {
        e.preventDefault();
        if (queryName.trim() && selectedSourceId) {
          onCreateQuery(queryName.trim(), selectedSourceId);
          onClose();
        }
      },
      [queryName, selectedSourceId, onCreateQuery, onClose]
    );

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0" onClick={onClose} />

        {/* Modal */}
        <div
          className="absolute bg-background border rounded-lg shadow-lg p-4 w-72"
          style={{
            left: position?.x || 0,
            top: position?.y || 0
          }}
        >
          <h3 className="text-sm font-medium mb-3">Create New Query</h3>

          <form onSubmit={handleSubmit} className="space-y-3 pb-2">
            <div className="space-y-1">
              <Label htmlFor="queryName" className="text-xs font-medium">
                Query Name
              </Label>
              <Input
                ref={inputRef}
                id="queryName"
                value={queryName}
                onChange={(e) => setQueryName(e.target.value)}
                placeholder="Enter query name"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sourceSelect" className="text-xs font-medium">
                Data Source
              </Label>
              <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                <SelectTrigger id="sourceSelect" className="h-8 text-xs w-full">
                  <SelectValue placeholder="Select a data source" />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="xs" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="xs" disabled={!queryName.trim() || !selectedSourceId}>
                Create Query
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }
);

// Context menu component
const ContextMenu = memo(
  ({
    x,
    y,
    onClose,
    onCloseOthers,
    onCloseToRight,
    canCloseToRight
  }: {
    x: number;
    y: number;
    onClose: () => void;
    onCloseOthers: () => Promise<void>;
    onCloseToRight: () => Promise<void>;
    canCloseToRight: boolean;
  }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
          onClose();
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [onClose]);

    return (
      <div
        ref={menuRef}
        className="fixed z-50 bg-background border rounded-md shadow-lg py-1 min-w-[150px]"
        style={{ left: x, top: y }}
      >
        <button
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
          onClick={async () => {
            await onCloseOthers();
            onClose();
          }}
        >
          Close Others
        </button>
        <button
          className={cn(
            "w-full px-3 py-1.5 text-left text-sm transition-colors",
            canCloseToRight ? "hover:bg-accent" : "text-muted-foreground cursor-not-allowed"
          )}
          onClick={async () => {
            if (canCloseToRight) {
              await onCloseToRight();
              onClose();
            }
          }}
          disabled={!canCloseToRight}
        >
          Close Tabs to the Right
        </button>
      </div>
    );
  }
);

// Memoized tab button component to prevent unnecessary re-renders
const TabButton = memo(
  ({
    tab,
    isActive,
    onTabClick,
    onCloseTab,
    onRightClick,
    tabRef
  }: {
    tab: { id: string; title: string; isDirty: boolean };
    isActive: boolean;
    onTabClick: (tabId: string) => Promise<void>;
    onCloseTab: (tabId: string, e: React.MouseEvent) => Promise<void>;
    onRightClick: (tabId: string, e: React.MouseEvent) => void;
    tabRef?: React.RefObject<HTMLDivElement | null>;
  }) => (
    <div
      ref={tabRef}
      className={cn(
        "flex items-center px-2 py-1.5 border-r cursor-pointer group flex-shrink-0",
        "min-w-[120px] max-w-[200px]", // Set minimum and maximum width
        isActive ? "bg-background" : "border-b bg-muted/20 hover:bg-accent"
      )}
      onClick={() => onTabClick(tab.id)}
      onContextMenu={(e) => onRightClick(tab.id, e)}
    >
      <span className="text-sm truncate mx-2 flex-1 min-w-0" title={tab.title}>
        {tab.title}
        {tab.isDirty && <span className="ml-1">•</span>}
      </span>
      <button
        className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity flex-shrink-0"
        onClick={(e) => onCloseTab(tab.id, e)}
        aria-label="Close tab"
      >
        <X className="h-3 w-3 cursor-pointer hover:bg-primary/40 rounded-xs" />
      </button>
    </div>
  )
);

function QueryTabsComponent() {
  // Use selective subscriptions to prevent unnecessary re-renders
  const openTabs = useTabManagerStore((state) => state.openTabs);
  const activeTabId = useTabManagerStore((state) => state.activeTabId);
  const selectedSource = useSourceStore((state) => state.selectedSource);
  const sources = useSourceStore((state) => state.allSources);

  // Dialog state
  const unsavedChangesDialog = useUnsavedChangesStore((state) => state.unsavedChangesDialog);

  // Get actions from store
  const { closeQueryTabWithConfirmation, setActiveTab } = useTabManagerStore();

  const { hideUnsavedChangesDialog, handleDialogSave, handleDialogDiscard } =
    useUnsavedChangesStore();

  // Get reusable query creation hook
  const { createQueryAndOpenInTab } = useCreateQuery();

  // Refs for scrolling functionality
  const tabBarScrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  // New query modal state
  const [isNewQueryModalOpen, setIsNewQueryModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

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

  // Handle showing the new query modal
  const handleNewTab = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setModalPosition({
      x: rect.left,
      y: rect.bottom + 5 // 5px below the button
    });
    setIsNewQueryModalOpen(true);
  }, []);

  // Handle creating a new query tab from modal
  const handleCreateQuery = useCallback(
    async (queryName: string, sourceId: string) => {
      await createQueryAndOpenInTab(sourceId, queryName);
    },
    [createQueryAndOpenInTab]
  );

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
      await Promise.all(otherTabs.map((tab) => closeQueryTab(tab.id)));
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
      await Promise.all(tabsToClose.map((tab) => closeQueryTab(tab.id)));
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

  // If no tabs are open, show empty state
  if (openTabs.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Tab bar with new tab button */}
        <div className="flex-shrink-0 flex items-center border-b bg-muted/30 min-h-[40px]">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewTab}
            disabled={sources.length === 0}
            className="h-8 px-3 rounded-none border-r hover:bg-accent"
          >
            <Plus className="h-4 w-4 mr-1" />
            New Query
          </Button>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Capybara />
            <p className="text-lg mb-2">No queries open</p>
            <p className="text-sm">
              {sources.length === 0
                ? "Connect a data source to create queries"
                : "Create a new query or double-click a table to get started"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Find the active tab to render
  const activeTab = openTabs.find((tab) => tab.id === activeTabId) || openTabs[0];

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div
        ref={tabBarScrollRef}
        className="flex-shrink-0 flex items-stretch border-border/50 bg-muted/10 h-10 overflow-x-auto scrollbar-hide"
      >
        <div className="flex items-stretch min-w-fit">
          {openTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onTabClick={handleTabClick}
              onCloseTab={handleCloseTab}
              onRightClick={handleRightClick}
              tabRef={tab.id === activeTabId ? activeTabRef : undefined}
            />
          ))}

          {/* New tab button */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleNewTab}
            disabled={sources.length === 0}
            className="h-full px-3 rounded-none hover:bg-accent flex-shrink-0 min-w-[40px]"
          >
            <Plus className="h-2 w-2" />
          </Button>
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0">
        {activeTab && <Query key={activeTab.id} tabId={activeTab.id} />}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onCloseOthers={() => handleCloseOthers(contextMenu.tabId)}
          onCloseToRight={() => handleCloseToRight(contextMenu.tabId)}
          canCloseToRight={canCloseToRight(contextMenu.tabId)}
        />
      )}

      {/* New Query Modal */}
      <NewQueryModal
        isOpen={isNewQueryModalOpen}
        onClose={() => setIsNewQueryModalOpen(false)}
        onCreateQuery={handleCreateQuery}
        sources={sources.map((source) => ({ id: source.id, name: source.name }))}
        defaultSourceId={selectedSource?.id}
        position={modalPosition}
      />

      {/* Unsaved Changes Dialog */}
      <UnsavedChangesDialog
        open={unsavedChangesDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            hideUnsavedChangesDialog();
          }
        }}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        tabTitle={unsavedChangesDialog.tabTitle}
        action={unsavedChangesDialog.action}
      />
    </div>
  );
}

// Memoize the main component but be careful about when it should re-render
export const QueryTabs = memo(QueryTabsComponent);
