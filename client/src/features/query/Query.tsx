import { memo, useState, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useTabStore, useQueryStore, useSourceStore } from "@/shared/store";
import { TableDataDisplay } from "@/features/tables/TableDataDisplay";
import { Editor } from "@/features/editor/Editor";
import { QueryRuns } from "./QueryRuns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { type QueryVersion } from "@/shared/lib/api";

interface QueryProps {
  tabId: string;
}

function QueryComponent({ tabId }: QueryProps) {
  const [showRuns, setShowRuns] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Use store selectors to get data for this specific tab
  const { openTabs, updateTabContent } = useTabStore();

  const {
    queryVersions,
    queryRuns,
    loadingVersions,
    loadingRuns,
    loadQueryVersions,
    loadQueryRuns
  } = useQueryStore();

  const { sources } = useSourceStore();

  const currentTab = openTabs.find((tab) => tab.id === tabId);
  const currentSource = currentTab?.sourceId ? sources[currentTab.sourceId] : null;

  // Get versions and runs for this query from the store
  const versions = useMemo(
    () => (currentTab?.queryId ? queryVersions[currentTab.queryId] || [] : []),
    [currentTab?.queryId, queryVersions]
  );
  const runs = useMemo(
    () => (currentTab?.queryId ? queryRuns[currentTab.queryId] || [] : []),
    [currentTab?.queryId, queryRuns]
  );
  const isLoadingVersions = currentTab?.queryId ? loadingVersions.has(currentTab.queryId) : false;
  const isLoadingRuns = currentTab?.queryId ? loadingRuns.has(currentTab.queryId) : false;

  // Load versions and runs when query changes
  useEffect(() => {
    if (currentTab?.queryId) {
      // Reset state when query changes
      setSelectedVersionId(null);
      setShowRuns(false);

      // Load fresh data from store (with caching)
      loadQueryVersions(currentTab.queryId);
      loadQueryRuns(currentTab.queryId);
    }
  }, [currentTab?.queryId, loadQueryVersions, loadQueryRuns]);

  // Set default selected version to latest when versions load
  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

  // Sync selectedVersionId with tab's queryVersionId
  useEffect(() => {
    if (currentTab?.queryVersionId && currentTab.queryVersionId !== selectedVersionId) {
      setSelectedVersionId(currentTab.queryVersionId);
    }
  }, [currentTab?.queryVersionId, selectedVersionId]);

  // Format version display text
  const formatVersionDisplay = (version: QueryVersion, index: number) => {
    const shortId = version.id.substring(0, 4);
    const date = new Date(version.created_at);
    const shortDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const isLatest = index === 0;
    return `${shortId} • ${shortDate}${isLatest ? " (latest)" : ""}`;
  };

  // Get the latest run for status display
  const latestRun = useMemo(() => {
    if (!runs || !Array.isArray(runs) || runs.length === 0) return null;
    return runs.reduce((latest, current) =>
      new Date(current.created_at) > new Date(latest.created_at) ? current : latest
    );
  }, [runs]);

  // Handle version change
  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const selectedVersion = versions.find((v) => v.id === versionId);
    if (selectedVersion && currentTab) {
      updateTabContent(tabId, {
        queryVersionId: versionId,
        editorContent: selectedVersion.sql
      });
    }
  };

  // Handle showing runs
  const handleShowRuns = () => {
    setShowRuns(!showRuns);
  };

  if (!currentTab) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Tab not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PanelGroup direction="vertical" storage={localStorage} autoSaveId={`query-layout-${tabId}`}>
        <Panel defaultSize={60} minSize={30}>
          <TableDataDisplay
            tableData={currentTab.selectedTableData}
            queryResults={currentTab.queryResults}
            isQueryRunning={currentTab.queryRunning}
          />
        </Panel>

        <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

        <Panel defaultSize={40} minSize={10}>
          <div className="h-full flex flex-col">
            {/* Editor or Runs Component */}
            <div className="flex-1 min-h-0">
              {showRuns ? (
                currentTab.queryId ? (
                  <QueryRuns
                    queryId={currentTab.queryId}
                    onBack={() => setShowRuns(false)}
                    sourceName={currentSource?.name || "No source selected"}
                    queryName={currentTab.title}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No query selected
                  </div>
                )
              ) : (
                <Editor
                  tabId={tabId}
                  onQueryExecuted={() => {
                    // Reload versions and runs after successful execution
                    // The store handles this automatically now, but we can trigger manual refresh if needed
                    if (currentTab?.queryId) {
                      loadQueryVersions(currentTab.queryId);
                      loadQueryRuns(currentTab.queryId, true); // Force refresh
                    }
                  }}
                />
              )}
            </div>

            {/* Bottom section with versions and runs info - only show when not viewing runs */}
            {!showRuns && (
              <div className="flex-shrink-0 border-t">
                <div className="flex items-center justify-between px-3 py-2 gap-4">
                  {/* Versions dropdown on the left */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Version:
                    </span>

                    <Select
                      value={selectedVersionId || ""}
                      onValueChange={handleVersionChange}
                      disabled={versions.length === 0 || isLoadingVersions}
                    >
                      <SelectTrigger className="h-auto w-auto p-0 border-0 bg-transparent text-xs text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 cursor-pointer">
                        <SelectValue
                          placeholder={isLoadingVersions ? "Loading..." : "Select version"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((version, index) => (
                          <SelectItem key={version.id} value={version.id}>
                            {formatVersionDisplay(version, index)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Latest run status in the middle */}
                  <div className="flex-1 flex items-center justify-center min-w-0">
                    {latestRun ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Latest run:</span>
                        {latestRun.error_message ? (
                          <span className="text-red-600 font-medium">Failed</span>
                        ) : (
                          <span className="text-green-600 font-medium">Success</span>
                        )}
                        {latestRun.row_count !== null && (
                          <span className="text-muted-foreground">
                            ({latestRun.row_count} rows)
                          </span>
                        )}
                      </div>
                    ) : isLoadingRuns ? (
                      <span className="text-xs text-muted-foreground">Loading runs...</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No runs yet</span>
                    )}
                  </div>

                  {/* Runs link on the right */}
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShowRuns}
                      disabled={!currentTab.queryId}
                      className="h-7 px-2 text-xs gap-1 underline cursor-pointer"
                    >
                      All Runs ({runs?.length ?? 0})
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render if the tabId changes
export const Query = memo(QueryComponent);
