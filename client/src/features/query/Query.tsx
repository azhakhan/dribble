import { memo, useState, useEffect, useMemo, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAppStore } from "@/shared/store/useAppStore";
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
import { ExternalLinkIcon } from "lucide-react";
import {
  getQueryRunsByQueryId,
  getQueryVersions,
  type QueryRun,
  type QueryVersion
} from "@/shared/lib/api";

interface QueryProps {
  tabId: string;
}

function QueryComponent({ tabId }: QueryProps) {
  const [showRuns, setShowRuns] = useState(false);
  const [runs, setRuns] = useState<QueryRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [versions, setVersions] = useState<QueryVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Use store selectors to get only the data we need for this specific tab
  const { openTabs, updateTabContent } = useAppStore();

  const currentTab = openTabs.find((tab) => tab.id === tabId);

  // Load versions directly from API
  const loadVersions = useCallback(async () => {
    if (!currentTab?.queryId) return;

    setLoadingVersions(true);
    try {
      const queryVersions = await getQueryVersions(currentTab.queryId);
      setVersions(queryVersions);
    } catch (error) {
      console.error("Failed to load versions:", error);
    } finally {
      setLoadingVersions(false);
    }
  }, [currentTab?.queryId]);

  // Load runs function
  const loadRuns = useCallback(async () => {
    if (!currentTab?.queryId) return;

    setLoadingRuns(true);
    try {
      const queryRuns = await getQueryRunsByQueryId(currentTab.queryId);
      setRuns(queryRuns);
    } catch (error) {
      console.error("Failed to load runs:", error);
    } finally {
      setLoadingRuns(false);
    }
  }, [currentTab?.queryId]);

  // Load versions and runs when query changes
  useEffect(() => {
    if (currentTab?.queryId) {
      // Reset state when query changes
      setVersions([]);
      setRuns([]);
      setSelectedVersionId(null);
      setShowRuns(false);

      // Load fresh data
      loadVersions();
      loadRuns();
    }
  }, [currentTab?.queryId, loadVersions, loadRuns]);

  // Set default selected version to latest when versions load
  useEffect(() => {
    if (versions.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versions[0].id);
    }
  }, [versions, selectedVersionId]);

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
    if (runs.length === 0) return null;
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
        editorContent: selectedVersion.sql
      });
    }
  };

  // Handle showing runs
  const handleShowRuns = () => {
    if (!showRuns && !loadingRuns) {
      loadRuns();
    }
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
                  <QueryRuns queryId={currentTab.queryId} onBack={() => setShowRuns(false)} />
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
                    loadVersions();
                    loadRuns();
                  }}
                />
              )}
            </div>

            {/* Bottom section with versions and runs info - only show when not viewing runs */}
            {!showRuns && (
              <div className="flex-shrink-0 border-t bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2 gap-4">
                  {/* Versions dropdown on the left */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Version:
                    </span>
                    <Select
                      value={selectedVersionId || ""}
                      onValueChange={handleVersionChange}
                      disabled={versions.length === 0 || loadingVersions}
                    >
                      <SelectTrigger className="w-48 h-7 text-xs">
                        <SelectValue
                          placeholder={loadingVersions ? "Loading..." : "Select version"}
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
                      disabled={loadingRuns || !currentTab.queryId}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      All Runs
                      <ExternalLinkIcon size={12} />
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
