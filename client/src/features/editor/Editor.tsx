import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PlayIcon, PencilIcon, CheckIcon, XIcon, Database } from "lucide-react";
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
import { useSourcesQuery } from "@/shared/hooks/useSourcesQuery";
import { useConnectedSourcesQuery } from "@/shared/hooks/useConnectedSourcesQuery";
import { useSourceSchemasQuery } from "@/shared/hooks/useSourceSchemasQuery";

interface EditorProps {
  initialQueryId?: string | null;
  onQueryLoad?: (loadQuery: (queryId: string | null) => Promise<void>) => void;
}

export function Editor({ initialQueryId = null, onQueryLoad }: EditorProps) {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [activeQuery, setActiveQuery] = useState<{ sourceId: string; sql: string } | null>(null);
  const [queryName, setQueryName] = useState<string>("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [queryId, setQueryId] = useState<string | null>(initialQueryId);
  const [originalQueryContent, setOriginalQueryContent] = useState<string>("");
  const lastSavedContentRef = useRef<string>("");
  const lastAIProposalRef = useRef<string>("");

  // Get editor content and proposed changes from appStore
  const {
    editorContent,
    setEditorContent,
    proposedChanges,
    acceptProposedChanges,
    rejectProposedChanges,
    updateTabContent,
    updateTabTitle,
    openTabs,
    activeTabId
  } = useAppStore();

  // Find current tab
  const currentTab = openTabs.find((tab) => tab.id === activeTabId);

  // Get the source for this tab's query
  const { data: sources } = useSourcesQuery();
  const { data: connectedSourcesData } = useConnectedSourcesQuery();

  const tabSource = useMemo(() => {
    if (!currentTab || !sources) return null;
    return sources.find((source) => source.id === currentTab.sourceId) || null;
  }, [currentTab, sources]);

  // Create a set of connected source IDs for easy lookup
  const connectedSourceIds = useMemo(() => {
    if (!connectedSourcesData) return new Set<string>();
    return new Set(connectedSourcesData.map((source: { id: string }) => source.id));
  }, [connectedSourcesData]);

  // Query for tab source schemas
  const { isLoading: schemasLoading, error: schemasError } = useSourceSchemasQuery(
    tabSource?.id && connectedSourceIds.has(tabSource.id) ? tabSource.id : undefined
  );

  // Check if the source is connected
  const isSourceConnected = tabSource ? connectedSourceIds.has(tabSource.id) : false;

  const isEditorActive = tabSource && !schemasLoading && !schemasError;
  const canRunQueries = isEditorActive && isSourceConnected;

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

      // Reset refs to sync with loaded content
      lastSavedContentRef.current = queryContent.trim();
      lastAIProposalRef.current = "";
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
      setActiveQuery(null);

      // Update tab content with results
      if (currentTab) {
        if (queryResults) {
          if (Array.isArray(queryResults) && queryResults.length > 0) {
            updateTabContent(currentTab.id, {
              queryResults: queryResults,
              queryRunning: false,
              selectedTableData: null
            });
            toast.success("Query executed successfully");
          } else {
            updateTabContent(currentTab.id, {
              queryResults: [{ message: "Query returned no data" }],
              queryRunning: false,
              selectedTableData: null
            });
            toast.info("Query executed but returned no data");
          }
        } else if (queryError) {
          updateTabContent(currentTab.id, {
            queryResults: [{ error: "Error executing query" }],
            queryRunning: false,
            selectedTableData: null
          });
          toast.error("Failed to retrieve query results");
        }
      }
    }
  }, [activeQuery, queryResults, queryError, currentTab?.id, updateTabContent]);

  // Update isRunning state based on loading status
  useEffect(() => {
    if (activeQuery) {
      setIsRunning(isLoading);

      // Update tab running status
      if (currentTab && currentTab.queryRunning !== isLoading) {
        updateTabContent(currentTab.id, {
          queryRunning: isLoading
        });
      }
    }
  }, [isLoading, activeQuery, currentTab?.id, currentTab?.queryRunning, updateTabContent]);

  // Update tab title when query name changes
  useEffect(() => {
    if (currentTab && queryName && currentTab.title !== queryName) {
      updateTabTitle(currentTab.id, queryName);
    }
  }, [queryName, currentTab?.id, currentTab?.title, updateTabTitle]);

  const handleRunQuery = async (sqlToRun?: string) => {
    if (!tabSource || !isSourceConnected) {
      if (!isSourceConnected) {
        toast.error("Cannot run query: Source is not connected");
      }
      return;
    }

    const queryToRun =
      sqlToRun || (proposedChanges ? proposedChanges.proposedContent : editorContent);
    if (!queryToRun.trim()) return;

    // Create version in background without blocking the run
    createVersionIfChanged("run");

    setIsRunning(true);

    // Set the active query which will trigger the useQueryQuery hook
    setActiveQuery({
      sourceId: tabSource.id,
      sql: queryToRun
    });
  };

  const handleCreateQuery = async () => {
    if (!tabSource) return;

    setEditorContent("");
    setQueryName("");
    setQueryId(null);
    setOriginalQueryContent(""); // Reset original content for new query

    try {
      const created = await createQuery({ source_id: tabSource.id });
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
    async (saveTrigger: "run" | "ai") => {
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
    [queryId, editorContent, proposedChanges, createQueryVersionMutation, originalQueryContent]
  );

  // Function to load a different query (with version saving)
  const loadQuery = useCallback(
    async (newQueryId: string | null) => {
      // Set new query ID which will trigger the loading effects
      setQueryId(newQueryId);
      lastSavedContentRef.current = ""; // Reset for new query
    },
    [] // No dependencies needed since we're only setting local state
  );

  // Effect to handle initialQueryId changes (when parent component changes the query)
  useEffect(() => {
    if (initialQueryId !== queryId) {
      loadQuery(initialQueryId);
    }
  }, [initialQueryId, queryId, loadQuery]);

  // Effect to save version when AI proposes changes
  useEffect(() => {
    if (proposedChanges && queryId) {
      const proposedContent = proposedChanges.proposedContent;

      // Only save if this is a new AI proposal (different from last one)
      if (
        lastAIProposalRef.current !== proposedContent.trim() &&
        editorContent.trim() !== proposedContent.trim() &&
        proposedContent.trim() !== ""
      ) {
        lastAIProposalRef.current = proposedContent.trim();
        createVersionIfChanged("ai");
      }
    }
  }, [proposedChanges?.proposedContent, queryId, editorContent]);

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
          <div className="flex items-center gap-1">
            <Database
              className={`h-4 w-4 ${isSourceConnected ? "text-green-600" : "text-red-500"}`}
              strokeWidth={1.5}
            />
            <span className="truncate font-medium text-xs text-muted-foreground">
              {tabSource?.name || "No source selected"}
            </span>
            {!isSourceConnected && tabSource && (
              <span className="text-xs text-red-500 font-medium">(Disconnected)</span>
            )}
          </div>
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
            disabled={!canRunQueries || isRunning}
            className="gap-1 text-xs cursor-pointer"
            size="sm"
            title={!isSourceConnected ? "Source is not connected" : ""}
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
              {!tabSource
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
            language={getMonacoLanguage(tabSource?.dbtype)}
            readOnly={true}
          />
        ) : (
          <MonacoSQLEditor
            value={editorContent}
            onChange={setEditorContent}
            language={getMonacoLanguage(tabSource?.dbtype)}
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
