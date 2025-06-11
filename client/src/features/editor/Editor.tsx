import { useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon, PencilIcon, CheckIcon, XIcon, Database } from "lucide-react";
import { toast } from "sonner";
import { useTabStore, useSourceStore, useChatStore, useQueryStore } from "@/shared/store";
import { LanguageIdEnum } from "@/shared/lib/monaco-setup";
import { MonacoSQLEditor } from "./MonacoSQLEditor";
import { MonacoDiffEditor } from "./MonacoDiffEditor";
import { ProposedChangesBar } from "./ProposedChangesBar";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface EditorProps {
  tabId: string;
  onQueryExecuted?: () => void;
}

export function Editor({ tabId, onQueryExecuted }: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // Get all needed state from the store using selectors
  const { openTabs, updateTabContent, executeQuery, loadQueryInTab } = useTabStore();
  const { sources, connectedSources } = useSourceStore();
  const { proposedChanges, acceptProposedChanges, rejectProposedChanges } = useChatStore();
  const { createNewQuery, updateQueryName } = useQueryStore();

  // Find current tab - memoized to prevent unnecessary re-computations
  const currentTab = useMemo(() => openTabs.find((tab) => tab.id === tabId), [openTabs, tabId]);

  // Get source for this tab - memoized
  const tabSource = useMemo(() => {
    if (!currentTab) return null;
    return sources[currentTab.sourceId] || null;
  }, [currentTab, sources]);

  // Check if source is connected - memoized
  const isSourceConnected = useMemo(
    () => (tabSource ? connectedSources.has(tabSource.id) : false),
    [tabSource, connectedSources]
  );

  // Check editor readiness - memoized
  const isEditorReady = useMemo(
    () => tabSource && !currentTab?.isLoadingQuery && !currentTab?.isLoadingVersions,
    [tabSource, currentTab?.isLoadingQuery, currentTab?.isLoadingVersions]
  );

  const canRunQueries = isEditorReady && isSourceConnected;

  // Helper to map dbtype to Monaco language
  const getMonacoLanguage = useCallback((dbtype?: string): string => {
    if (!dbtype) return LanguageIdEnum.MYSQL;
    switch (dbtype.toLowerCase()) {
      case "postgres":
        return LanguageIdEnum.PG;
      case "mysql":
        return LanguageIdEnum.MYSQL;
      default:
        return LanguageIdEnum.MYSQL;
    }
  }, []);

  // Handle content changes
  const handleContentChange = useCallback(
    (content: string) => {
      // Update tab content - let the store calculate isDirty based on lastSavedContent
      updateTabContent(tabId, {
        editorContent: content
      });
    },
    [tabId, updateTabContent]
  );

  // Handle query execution
  const handleRunQuery = useCallback(
    async (sqlToRun?: string) => {
      if (!canRunQueries || !currentTab) {
        if (!isSourceConnected) {
          toast.error("Cannot run query: Source is not connected");
        }
        return;
      }

      const queryToRun =
        sqlToRun || (proposedChanges ? proposedChanges.proposedContent : currentTab.editorContent);
      if (!queryToRun.trim()) return;

      try {
        // executeQuery now handles saving the version automatically
        await executeQuery(tabId, queryToRun);
        toast.success("Query executed successfully");
        // Notify parent component that query was executed successfully
        onQueryExecuted?.();
      } catch (error) {
        console.error("Failed to execute query:", error);
        toast.error("Failed to execute query");
      }
    },
    [canRunQueries, currentTab, proposedChanges, executeQuery, tabId, isSourceConnected, openTabs]
  );

  // Handle create new query
  const handleCreateQuery = useCallback(async () => {
    if (!tabSource) return;

    try {
      const queryId = await createNewQuery(tabSource.id);
      await loadQueryInTab(tabId, queryId);
      toast.success("Query created");
    } catch (error) {
      console.error("Failed to create query:", error);
      toast.error("Failed to create query");
    }
  }, [tabSource, createNewQuery, loadQueryInTab, tabId]);

  // Handle name editing
  const startEditingName = useCallback(() => {
    if (!currentTab) return;
    setTempName(currentTab.title);
    setEditingName(true);
  }, [currentTab]);

  const cancelEditingName = useCallback(() => {
    setEditingName(false);
    setTempName("");
  }, []);

  const saveEditingName = useCallback(async () => {
    if (!currentTab?.queryId) return;

    try {
      // Use the centralized updateQueryName from the store
      await updateQueryName(currentTab.queryId, tempName.trim() || "Untitled Query");
      setEditingName(false);
      toast.success("Query name updated");
    } catch (error) {
      console.error("Failed to update query name:", error);
      toast.error("Failed to update query name");
    }
  }, [currentTab?.queryId, tempName, updateQueryName]);

  if (!currentTab) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Tab not found
      </div>
    );
  }

  if (currentTab.isLoadingQuery || currentTab.isLoadingVersions) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Loading query...
      </div>
    );
  }

  return (
    <div ref={editorContainerRef} className="h-full flex flex-col">
      {/* Fixed header with run button only */}
      <div className="flex-shrink-0 flex justify-between items-center gap-2 p-2 border-b">
        <div className="flex items-center gap-2 min-w-0 px-2">
          <div className="flex items-center gap-1">
            <Database
              className={`h-4 w-4 mr-1 ${isSourceConnected ? "text-green-600" : "text-red-500"}`}
              strokeWidth={1.5}
            />
            <span className="truncate font-medium text-sm text-muted-foreground">
              {tabSource?.name || "No source selected"}
            </span>
            {!isSourceConnected && tabSource && (
              <span className="text-xs text-red-500 font-medium">(Disconnected)</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="truncate text-sm relative group" style={{ minWidth: 0 }}>
            {editingName ? (
              <span className="flex items-center gap-1">
                <Input
                  className="h-6 px-2 py-0 text-sm w-32"
                  value={tempName}
                  autoFocus
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEditingName();
                    if (e.key === "Escape") cancelEditingName();
                  }}
                  disabled={!currentTab.queryId}
                />
                <button
                  className="ml-1 text-green-600 hover:text-green-800"
                  onClick={saveEditingName}
                  tabIndex={-1}
                  aria-label="Save name"
                  disabled={!currentTab.queryId}
                >
                  <CheckIcon size={16} />
                </button>
                <button
                  className="ml-0.5 text-red-500 hover:text-red-700"
                  onClick={cancelEditingName}
                  tabIndex={-1}
                  aria-label="Cancel edit"
                >
                  <XIcon size={16} />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1 group/query-name">
                <span>{currentTab.title || "Untitled query"}</span>
                <button
                  className="opacity-0 group-hover/query-name:opacity-100 ml-1 transition-opacity"
                  onClick={startEditingName}
                  tabIndex={-1}
                  aria-label="Edit name"
                >
                  <PencilIcon size={14} />
                </button>
              </span>
            )}
          </span>
        </div>

        {/* Action buttons on the right */}
        <div className="flex items-center gap-2 h-8">
          <Button
            onClick={handleCreateQuery}
            disabled={!isEditorReady || currentTab.queryRunning}
            className="gap-1 text-xs cursor-pointer"
            size="xs"
          >
            Create Query
          </Button>
          <Button
            onClick={() => handleRunQuery()}
            disabled={!canRunQueries || currentTab.queryRunning}
            className="gap-1 text-xs cursor-pointer"
            size="xs"
            title={!isSourceConnected ? "Source is not connected" : ""}
          >
            <PlayIcon size={16} />
            {currentTab.queryRunning ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      {/* Scrollable editor content */}
      <div className="flex-1 min-h-0 relative">
        {!isEditorReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <p className="text-muted-foreground text-sm">
              {!tabSource
                ? "Select a source to write SQL queries"
                : currentTab.isLoadingQuery || currentTab.isLoadingVersions
                  ? "Loading query..."
                  : "Editor not ready"}
            </p>
          </div>
        )}

        {/* Show diff editor if there are proposed changes, otherwise show regular editor */}
        {proposedChanges ? (
          <MonacoDiffEditor
            originalContent={proposedChanges.originalContent}
            proposedContent={proposedChanges.proposedContent}
            language={getMonacoLanguage(tabSource?.dbtype)}
            readOnly={true}
          />
        ) : (
          <MonacoSQLEditor
            value={currentTab.editorContent}
            onChange={handleContentChange}
            language={getMonacoLanguage(tabSource?.dbtype)}
            readOnly={!isEditorReady}
            onRunQuery={() => handleRunQuery()}
          />
        )}
      </div>

      {/* Show accept/reject bar when there are proposed changes */}
      {proposedChanges && (
        <ProposedChangesBar onAccept={acceptProposedChanges} onReject={rejectProposedChanges} />
      )}
    </div>
  );
}
