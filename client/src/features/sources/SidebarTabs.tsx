import { useState } from "react";
import { Database, FileText } from "lucide-react";
import { SourcesPanel } from "./SourcesPanel";
import { QueryTree } from "./QueryTree";
import type { FileNode } from "@/shared/lib/fileTreeUtils";
import type { Query } from "@/shared/lib/api";

interface SidebarTabsProps {
  sources: FileNode[];
  sourcesLoading: boolean;
  sourcesError: unknown;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableSelect?: (sourceId: string, tableName: string) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
  onQuerySelect?: (query: Query) => void;
  onQueryDoubleClick?: (query: Query) => void;
  selectedQueryId?: string;
}

type TabType = "sources" | "queries";

export const SidebarTabs = ({
  sources,
  sourcesLoading,
  sourcesError,
  onSourceSelect,
  onTableSelect,
  onTableDoubleClick,
  onQuerySelect,
  onQueryDoubleClick,
  selectedQueryId
}: SidebarTabsProps) => {
  const [activeTab, setActiveTab] = useState<TabType>("sources");

  const renderTabContent = () => {
    if (activeTab === "sources") {
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
          onTableSelect={onTableSelect}
          onTableDoubleClick={onTableDoubleClick}
        />
      );
    }

    if (activeTab === "queries") {
      return (
        <QueryTree
          onQuerySelect={onQuerySelect}
          onQueryDoubleClick={onQueryDoubleClick}
          selectedQueryId={selectedQueryId}
        />
      );
    }

    return null;
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
            onClick={() => setActiveTab("sources")}
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
            onClick={() => setActiveTab("queries")}
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
