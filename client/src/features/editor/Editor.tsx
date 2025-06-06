import { useRef, useState, useEffect, useCallback } from "react";
import type { Source } from "@/shared/lib/api";
import { Button } from "@/components/ui/button";
import { PlayIcon, PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { useQueryQuery } from "@/shared/hooks/useQueryQuery";
import {
  useCreateQueryVersionMutation,
  useQueryVersionsQuery
} from "@/shared/hooks/useQueryVersionsQuery";
import { useQueryByIdQuery } from "@/shared/hooks/useQueriesQuery";
import { useAppStore } from "@/shared/store/useAppStore";
import { LanguageIdEnum } from "@/shared/lib/monaco-setup";
import { MonacoSQLEditor } from "./MonacoSQLEditor";
import { MonacoDiffEditor } from "./MonacoDiffEditor";
import { ProposedChangesBar } from "./ProposedChangesBar";
import { Input } from "@/components/ui/input";
import { createQuery, updateQuery } from "@/shared/lib/api";

interface EditorProps {
  selectedSource: Source | null;
  schemasLoading: boolean;
  schemasError?: unknown;
  onQueryExecution?: (results: object[]) => void;
  onQueryStatusChange?: (isRunning: boolean) => void;
  initialQueryId?: string | null;
  onQueryLoad?: (loadQuery: (queryId: string | null) => Promise<void>) => void;
}

export function Editor({
  selectedSource,
  schemasLoading,
  schemasError,
  onQueryExecution,
  onQueryStatusChange,
  initialQueryId = null,
  onQueryLoad
}: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeQuery, setActiveQuery] = useState<{ sourceId: string; sql: string } | null>(null);
  const [queryName, setQueryName] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [queryId, setQueryId] = useState<string | null>(initialQueryId);
  const [originalQueryContent, setOriginalQueryContent] = useState<string>("");
  const lastSavedContentRef = useRef<string>("");

  // Get editor content and proposed changes from appStore
  const {
    editorContent,
    setEditorContent,
    proposedChanges,
    acceptProposedChanges,
    rejectProposedChanges
  } = useAppStore();

  // Mutation for creating query versions
  const createQueryVersionMutation = useCreateQueryVersionMutation();

  // Hook to load existing query if queryId is provided
  const { data: loadedQuery, isLoading: isLoadingQuery } = useQueryByIdQuery(queryId || "");

  // Hook to load query versions to get the latest SQL content
  const { data: queryVersions, isLoading: isLoadingVersions } = useQueryVersionsQuery(
    queryId || ""
  );

  // Effect to load query content when query and versions are fetched
  useEffect(() => {
    if (loadedQuery && queryVersions && !isLoadingQuery && !isLoadingVersions) {
      setQueryName(loadedQuery.name || "");

      // Get the latest version (versions should be sorted by created_at desc)
      const latestVersion = queryVersions[0];
      const queryContent = latestVersion?.sql || "";

      setEditorContent(queryContent);
      setOriginalQueryContent(queryContent);
    }
  }, [loadedQuery, queryVersions, isLoadingQuery, isLoadingVersions, setEditorContent]);

  // Helper to map dbtype to Monaco language
  function getMonacoLanguage(dbtype?: string): string {
    if (!dbtype) return LanguageIdEnum.MYSQL;
    switch (dbtype.toLowerCase()) {
      case "postgres":
        return LanguageIdEnum.PG;
      case "mysql":
        return LanguageIdEnum.MYSQL;
      // Add more mappings if needed
      default:
        return LanguageIdEnum.MYSQL;
    }
  }

  // Use the query hook with enabled set to false by default
  // We'll enable it manually when the user clicks the Run button
  const {
    data: queryResults,
    isLoading,
    error: queryError
  } = useQueryQuery(
    activeQuery?.sourceId || "",
    activeQuery?.sql || "",
    {
      enabled: !!activeQuery
    },
    "manual"
  );

  // Reset active query when query completes or errors
  useEffect(() => {
    if (activeQuery && (queryResults || queryError)) {
      setIsRunning(false);
      if (onQueryStatusChange) {
        onQueryStatusChange(false);
      }
      setActiveQuery(null);
    }
  }, [activeQuery, queryResults, queryError, onQueryStatusChange]);

  // Update isRunning state based on loading status
  useEffect(() => {
    if (activeQuery) {
      setIsRunning(isLoading);
      if (onQueryStatusChange) {
        onQueryStatusChange(isLoading);
      }
    }
  }, [isLoading, activeQuery, onQueryStatusChange]);

  // Handle query results when they arrive
  useEffect(() => {
    if (queryResults && onQueryExecution) {
      if (Array.isArray(queryResults) && queryResults.length > 0) {
        onQueryExecution(queryResults);
        toast.success("Query executed successfully");
      } else {
        onQueryExecution([{ message: "Query returned no data" }]);
        toast.info("Query executed but returned no data");
      }
    } else if (queryError && onQueryExecution) {
      onQueryExecution([{ error: "Error executing query" }]);
      toast.error("Failed to retrieve query results");
    }
  }, [queryResults, queryError, onQueryExecution]);

  const isEditorActive = selectedSource && !schemasLoading && !schemasError;

  const handleRunQuery = async (sqlToRun?: string) => {
    if (!selectedSource) return;

    const queryToRun =
      sqlToRun || (proposedChanges ? proposedChanges.proposedContent : editorContent);
    if (!queryToRun.trim()) return;

    // Create version in background without blocking the run
    createVersionIfChanged("run");

    setIsRunning(true);
    if (onQueryStatusChange) {
      onQueryStatusChange(true);
    }

    // Provide initial empty results to indicate query is running
    if (onQueryExecution) {
      onQueryExecution([{ status: "Query running..." }]);
    }

    // Set the active query which will trigger the useQueryQuery hook
    setActiveQuery({
      sourceId: selectedSource.id,
      sql: queryToRun
    });
  };

  const handleCreateQuery = async () => {
    if (!selectedSource) return;

    // Create version if current query has changed before creating new one
    await createVersionIfChanged("on_exit");

    setEditorContent("");
    setQueryName("");
    setQueryId(null);
    setOriginalQueryContent(""); // Reset original content for new query

    try {
      const created = await createQuery({ source_id: selectedSource.id });
      setQueryId(created.id);
      setOriginalQueryContent(""); // New query starts with empty content
      toast.success("Query created");
    } catch {
      toast.error("Failed to create query");
    }
  };

  // Handlers for editing query name
  const startEditingName = () => {
    setTempName(queryName);
    setEditingName(true);
  };
  const cancelEditingName = () => {
    setEditingName(false);
    setTempName("");
  };
  const saveEditingName = async () => {
    if (!queryId) return;
    try {
      await updateQuery(queryId, { name: tempName.trim() || undefined });
      setQueryName(tempName.trim() || "");
      setEditingName(false);
      toast.success("Query name updated");
    } catch {
      toast.error("Failed to update query name");
    }
  };

  // Function to check if query has changed
  const hasQueryChanged = () => {
    const currentContent = proposedChanges ? proposedChanges.proposedContent : editorContent;
    return originalQueryContent.trim() !== currentContent.trim() && currentContent.trim() !== "";
  };

  // Function to create a version if query has changed
  const createVersionIfChanged = useCallback(
    async (saveTrigger: "run" | "on_exit" | "ai") => {
      if (!queryId || !hasQueryChanged()) return;

      const currentContent = proposedChanges ? proposedChanges.proposedContent : editorContent;

      // Prevent duplicate saves
      if (lastSavedContentRef.current === currentContent.trim()) return;

      try {
        await createQueryVersionMutation.mutateAsync({
          query_id: queryId,
          sql: currentContent,
          save_trigger: saveTrigger,
          created_by: "00000000-0000-0000-0000-000000000000" // TODO: Replace with actual user ID
        });

        // Update the original content and last saved content after successful version creation
        setOriginalQueryContent(currentContent);
        lastSavedContentRef.current = currentContent.trim();

        if (saveTrigger === "run") {
          toast.success("Query version saved before execution");
        }
      } catch (error) {
        console.error("Failed to create query version:", error);
        toast.error("Failed to save query version");
      }
    },
    [
      queryId,
      originalQueryContent,
      editorContent,
      proposedChanges,
      createQueryVersionMutation,
      setOriginalQueryContent
    ]
  );

  // Function to load a different query (with version saving)
  const loadQuery = useCallback(
    async (newQueryId: string | null) => {
      // Save current query version if it has changed
      await createVersionIfChanged("on_exit");

      // Set new query ID which will trigger the loading effects
      setQueryId(newQueryId);
      lastSavedContentRef.current = ""; // Reset for new query
    },
    [createVersionIfChanged, setQueryId]
  );

  // Effect to handle initialQueryId changes (when parent component changes the query)
  useEffect(() => {
    if (initialQueryId !== queryId) {
      loadQuery(initialQueryId);
    }
  }, [initialQueryId]);

  // Effect to save version when AI proposes changes
  useEffect(() => {
    if (proposedChanges && queryId) {
      // Check if proposed content is different from original
      const proposedContent = proposedChanges.proposedContent;
      if (originalQueryContent.trim() !== proposedContent.trim() && proposedContent.trim() !== "") {
        createVersionIfChanged("ai");
      }
    }
  }, [proposedChanges, queryId, originalQueryContent, createVersionIfChanged]);

  // Effect to handle page/tab close (keep this for browser close)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasQueryChanged()) {
        // This will show a confirmation dialog
        event.preventDefault();

        // Try to save the version (though it might not complete due to page unload)
        createVersionIfChanged("on_exit");
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasQueryChanged, createVersionIfChanged]);

  // Effect to expose loadQuery function to parent
  useEffect(() => {
    if (onQueryLoad) {
      onQueryLoad(loadQuery);
    }
  }, [onQueryLoad, loadQuery]);

  return (
    <div ref={editorContainerRef} className="h-full flex flex-col">
      {/* Fixed header with run button only */}
      <div className="flex-shrink-0 flex justify-between items-center gap-2 p-2 border-b">
        {/* Query metadata on the left */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium text-xs text-muted-foreground">
            {selectedSource?.name || "No source selected"}
          </span>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="truncate font-semibold text-xs relative group" style={{ minWidth: 0 }}>
            {editingName ? (
              <span className="flex items-center gap-1">
                <Input
                  className="h-6 px-2 py-0 text-xs w-32"
                  value={tempName}
                  autoFocus
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEditingName();
                    if (e.key === "Escape") cancelEditingName();
                  }}
                  disabled={!queryId}
                />
                <button
                  className="ml-1 text-green-600 hover:text-green-800"
                  onClick={saveEditingName}
                  tabIndex={-1}
                  aria-label="Save name"
                  disabled={!queryId}
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
                <span>{queryName ? queryName : "Untitled query"}</span>
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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleCreateQuery()}
            disabled={!isEditorActive || isRunning}
            className="gap-1 text-xs cursor-pointer"
            size="sm"
          >
            Create Query
          </Button>
          <Button
            onClick={() => handleRunQuery()}
            disabled={!isEditorActive || isRunning}
            className="gap-1 text-xs cursor-pointer"
            size="sm"
          >
            <PlayIcon size={16} />
            Run
          </Button>
        </div>
      </div>
      {/* Scrollable editor content */}
      <div className="flex-1 min-h-0 relative">
        {!isEditorActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <p className="text-muted-foreground text-sm">
              {!selectedSource
                ? "Select a source to write SQL queries"
                : schemasLoading
                  ? "Loading schema..."
                  : schemasError
                    ? "Error loading schema"
                    : ""}
            </p>
          </div>
        )}

        {/* Show diff editor if there are proposed changes, otherwise show regular editor */}
        {proposedChanges ? (
          <MonacoDiffEditor
            originalContent={proposedChanges.originalContent}
            proposedContent={proposedChanges.proposedContent}
            language={getMonacoLanguage(selectedSource?.dbtype)}
            readOnly={true}
          />
        ) : (
          <MonacoSQLEditor
            value={editorContent}
            onChange={setEditorContent}
            language={getMonacoLanguage(selectedSource?.dbtype)}
            readOnly={!isEditorActive}
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
