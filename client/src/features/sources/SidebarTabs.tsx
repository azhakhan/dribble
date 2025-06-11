import { Database, FileText } from "lucide-react";
import { SourcesPanel } from "./SourcesPanel";
import { QueryTree } from "./QueryTree";
import { useTreeStore } from "@/shared/store";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import type { Query } from "@/shared/lib/api";

interface SidebarTabsProps {
  sources: FileNode[];
  sourcesLoading: boolean;
  sourcesError: unknown;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string, nodeType: "table" | "view") => void;
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

export const SidebarTabs = ({
  sources,
  sourcesLoading,
  sourcesError,
  onSourceSelect,
  onTableDoubleClick,
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}: SidebarTabsProps) => {
  // Use centralized tree state instead of local state
  const activeTab = useTreeStore((state) => state.sidebarState.activeTab);
  const setSidebarActiveTab = useTreeStore((state) => state.setSidebarActiveTab);

  const renderTabContent = () => {
    switch (activeTab) {
      case "sources":
        if (sourcesLoading) {
          return <div className="p-4 text-sm text-muted-foreground">Loading sources...</div>;
        }
        if (sourcesError) {
          return <div className="p-4 text-sm text-red-500">Error loading sources</div>;
        }
        return (
          <SourcesPanel
            data={sources}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
          />
        );
      case "queries":
        return (
          <QueryTree
            onQuerySelect={onQuerySelect}
            onQueryDoubleClick={onQueryDoubleClick}
            selectedQueryId={selectedQueryId}
          />
        );
      default:
        if (sourcesLoading) {
          return <div className="p-4 text-sm text-muted-foreground">Loading sources...</div>;
        }
        if (sourcesError) {
          return <div className="p-4 text-sm text-red-500">Error loading sources</div>;
        }
        return (
          <SourcesPanel
            data={sources}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
          />
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tab navigation */}
      <div className="flex-shrink-0 border-b">
        <div className="flex">
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "sources"
                ? "border-primary text-primary bg-accent/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setSidebarActiveTab("sources")}
          >
            <Database className="h-4 w-4" strokeWidth={1.5} />
            Sources
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "queries"
                ? "border-primary text-primary bg-accent/30"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setSidebarActiveTab("queries")}
          >
            <FileText className="h-4 w-4" strokeWidth={1.5} />
            Queries
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">{renderTabContent()}</div>
    </div>
  );
};
