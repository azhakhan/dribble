import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useQueryVersion } from "../../hooks/useQueryVersion";
import { useQueryExecution } from "../../hooks/useQueryExecution";
import { queryService } from "../../services/queryService";

interface EditorStatusBarProps {
  tabId: string;
  showVersions?: boolean;
  showRuns?: boolean;
  onShowRuns?: () => void;
}

function EditorStatusBarComponent({
  tabId,
  showVersions = true,
  showRuns = true,
  onShowRuns
}: EditorStatusBarProps) {
  const { openTabs } = useTabManagerStore();

  const currentTab = openTabs.find((tab) => tab.id === tabId);

  const {
    versions,
    selectedVersionId,
    isLoadingVersions,
    formatVersionDisplay,
    handleVersionChange
  } = useQueryVersion(currentTab?.queryId || undefined, tabId);

  const { latestRun, isLoadingRuns } = useQueryExecution(currentTab?.queryId || undefined);

  if (!currentTab) {
    return null;
  }

  return (
    <div className="flex-shrink-0 border-t">
      <div className="flex items-center justify-between px-3 py-2 gap-4">
        {/* Versions dropdown on the left */}
        {showVersions && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Version:</span>

            <Select
              value={selectedVersionId || ""}
              onValueChange={handleVersionChange}
              disabled={versions.length === 0 || isLoadingVersions}
            >
              <SelectTrigger className="h-auto w-auto p-0 border-0 bg-transparent text-xs text-muted-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 cursor-pointer">
                <SelectValue placeholder={isLoadingVersions ? "Loading..." : "Select version"} />
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
        )}

        {/* Latest run status in the middle */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          {latestRun ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Latest run:</span>
              {(() => {
                const status = queryService.getQueryStatus(latestRun);
                return <span className={`font-medium ${status.color}`}>{status.text}</span>;
              })()}
              {latestRun.row_count !== undefined && latestRun.row_count !== null && (
                <span className="text-muted-foreground">
                  {queryService.formatRowCount(latestRun.row_count)}
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
        {showRuns && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowRuns}
              disabled={!currentTab.queryId}
              className="h-7 px-2 text-xs gap-1 underline cursor-pointer"
            >
              All Runs
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const EditorStatusBar = memo(EditorStatusBarComponent);
