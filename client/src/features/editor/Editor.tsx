import { useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon, PencilIcon, CheckIcon, XIcon, Database, SaveIcon } from "lucide-react";
import { toast } from "sonner";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { useTabExecutionStore } from "@/shared/store/useTabExecutionStore";
import { useUnsavedChangesStore } from "@/shared/store/useUnsavedChangesStore";
import { useSourceStore, useChatStore, useQueryStore } from "@/shared/store";
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

  // Local state for editor content to improve typing performance
  const [localEditorContent, setLocalEditorContent] = useState("");

  // Get all needed state from the store using selectors
  const { openTabs, updateTabContent } = useTabManagerStore();
  const { executeQuery } = useTabExecutionStore();
  const { saveChanges, hasUnsavedChanges } = useUnsavedChangesStore();
  const { sources, connectedSources } = useSourceStore();
  const { proposedChanges, acceptProposedChanges, rejectProposedChanges } = useChatStore();
  const { updateQueryName } = useQueryStore();

  // Handle accept proposed changes with user feedback
  const handleAcceptProposedChanges = useCallback(() => {
    acceptProposedChanges();
    toast.success("Changes accepted");
  }, [acceptProposedChanges]);

  // Handle reject proposed changes with async support
  const handleRejectProposedChanges = useCallback(async () => {
    try {
      await rejectProposedChanges();
      toast.success("Changes rejected and reverted");
    } catch (error) {
      console.error("Failed to reject proposed changes:", error);
      toast.error("Failed to reject changes");
    }
  }, [rejectProposedChanges]);

  // Find current tab - memoized to prevent unnecessary re-computations
  const currentTab = useMemo(() => openTabs.find((tab) => tab.id === tabId), [openTabs, tabId]);

  // Sync local editor content with store content when it changes externally
  useEffect(() => {
    if (currentTab?.editorContent !== undefined) {
      setLocalEditorContent(currentTab.editorContent);
    }
  }, [currentTab?.editorContent]);

  // Debounced update for editor content - similar to TableFilterBar pattern
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentTab && localEditorContent !== currentTab.editorContent) {
        updateTabContent(tabId, {
          editorContent: localEditorContent
        });
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [localEditorContent, currentTab?.editorContent, tabId, updateTabContent]);

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

  // Handle content changes - now uses local state for immediate updates
  const handleContentChange = useCallback((content: string) => {
    // Update local state immediately for responsive typing
    setLocalEditorContent(content);
  }, []);

  // Handle saving changes
  const handleSaveChanges = useCallback(async () => {
    if (!currentTab || !hasUnsavedChanges(tabId)) return;

    try {
      await saveChanges(tabId);
      toast.success("Changes saved successfully");
    } catch (error) {
      console.error("Failed to save changes:", error);
      toast.error("Failed to save changes");
    }
  }, [currentTab, tabId, saveChanges, hasUnsavedChanges]);

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
        sqlToRun || (proposedChanges ? proposedChanges.proposedContent : localEditorContent);
      if (!queryToRun.trim()) return;

      try {
        // executeQuery now handles saving the version automatically
        await executeQuery(tabId, queryToRun);
        toast.success("Query executed successfully");
      } catch (error) {
        console.error("Failed to execute query:", error);
        toast.error("Failed to execute query");
      } finally {
        // Notify parent component that query execution completed (success or failure)
        // This ensures the query runs are refreshed to show the latest status
        onQueryExecuted?.();
      }
    },
    [
      canRunQueries,
      currentTab,
      proposedChanges,
      executeQuery,
      tabId,
      isSourceConnected,
      localEditorContent,
      onQueryExecuted
    ]
  );

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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        handleSaveChanges();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveChanges]);

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
          {currentTab.isDirty && (
            <Button
              onClick={handleSaveChanges}
              disabled={!currentTab.isDirty}
              variant="outline"
              className="gap-1 text-xs cursor-pointer"
              size="xs"
              title="Save changes (Ctrl+S)"
            >
              <SaveIcon size={16} />
              Save
            </Button>
          )}
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
            value={localEditorContent}
            onChange={handleContentChange}
            language={getMonacoLanguage(tabSource?.dbtype)}
            readOnly={!isEditorReady}
            onRunQuery={() => handleRunQuery()}
          />
        )}
      </div>

      {/* Show accept/reject bar when there are proposed changes */}
      {proposedChanges && (
        <ProposedChangesBar
          onAccept={handleAcceptProposedChanges}
          onReject={handleRejectProposedChanges}
        />
      )}
    </div>
  );
}
