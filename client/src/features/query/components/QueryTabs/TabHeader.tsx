import { memo, useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSourceStore } from "@/shared/store";
import { useCreateQuery } from "@/shared/hooks/useCreateQuery";
import { useTabNavigation } from "../../hooks/useTabNavigation";
import { TabButton } from "./TabButton";
import { NewQueryModal } from "./NewQueryModal";
import { ContextMenu } from "./ContextMenu";

function TabHeaderComponent() {
  const { selectedSource, allSources: sources } = useSourceStore();
  const { createQueryAndOpenInTab } = useCreateQuery();

  // New query modal state
  const [isNewQueryModalOpen, setIsNewQueryModalOpen] = useState(false);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const {
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
  } = useTabNavigation();

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

  return (
    <>
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
    </>
  );
}

export const TabHeader = memo(TabHeaderComponent);
