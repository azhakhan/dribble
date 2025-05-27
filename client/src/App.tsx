import { ThemeProvider } from "@/components/theme-provider";
import { useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/logo.png";

import { FileTree } from "@/elements/FileTree/FileTree";
import { sourcesToFileTreeNodes, schemaToFileTreeNodes, type FileNode } from "@/lib/fileTreeUtils";
import { TableDataDisplay } from "@/elements/Table/TableDataDisplay";
import { ChatSidebar } from "@/elements/Chat/ChatSidebar";
import { Editor } from "@/elements/Editor";
import { useSourcesQuery } from "@/hooks/useSourcesQuery";
import { useSourceSchemasQuery } from "@/hooks/useSourceSchemasQuery";
import { useQueryQuery } from "@/hooks/useQueryQuery";
import { useSourceStatusQuery } from "@/hooks/useSourceStatusQuery";
import type { Source } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

// Schema types are now imported from useAppStore

// Sample file tree data as fallback
const sampleFileTree = [
  {
    name: "Loading...",
    type: "folder" as const,
    children: []
  }
];

function TopMenu() {
  return (
    <div className="h-8 border-b flex items-center justify-between px-3 bg-background">
      <div className="flex items-center gap-2">
        <img src={logo} alt="Dribble IDE" className="w-5 h-5" />
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
      </div>
    </div>
  );
}

function App() {
  // Get state and actions from Zustand store
  const {
    panelSizes,
    setPanelSizes,
    selectedSource,
    setSelectedSource,
    sourceSchemaMap,
    setSourceSchema,
    selectedTableData,
    setSelectedTableData,
    queryResults,
    setQueryResults,
    queryRunning,
    setQueryRunning,
    sourceSchemaErrors,
    setSourceSchemaError,
    setSourceStatus,
    connectedSources
  } = useAppStore();

  // Query for all sources
  const { data: sources, isLoading: sourcesLoading, error: sourcesError } = useSourcesQuery();

  // Query for selected source schemas
  const {
    data: sourceSchemas,
    isLoading: schemasLoading,
    error: schemasError
  } = useSourceSchemasQuery(selectedSource?.id);

  // Query for selected source status - only if the source is connected
  const { data: selectedSourceStatus } = useSourceStatusQuery(
    selectedSource?.id && connectedSources.has(selectedSource.id) ? selectedSource.id : undefined
  );

  // Query for table data using the useQueryQuery hook
  const {
    data: tableQueryResults,
    isLoading,
    error: tableQueryError
  } = useQueryQuery(
    selectedTableData?.sourceId || "",
    selectedTableData?.query || "",
    {
      enabled: !!selectedTableData
    },
    "table"
  );

  // Update query results when the table query completes
  useEffect(() => {
    if (tableQueryResults) {
      setQueryResults(tableQueryResults);
    } else if (tableQueryError) {
      console.error("Error executing table query:", tableQueryError);
      setQueryResults([{ error: "Error loading table data" }]);
    }
  }, [tableQueryResults, tableQueryError]);

  // Update query running state based on loading state
  useEffect(() => {
    if (selectedTableData) {
      setQueryRunning(isLoading);
    } else {
      setQueryRunning(false);
    }
  }, [isLoading, selectedTableData]);

  // Update schema map when new schema data is loaded
  useEffect(() => {
    if (selectedSource?.id && sourceSchemas) {
      setSourceSchema(selectedSource.id, sourceSchemas);
      // Clear any error for this source
      if (sourceSchemaErrors[selectedSource.id]) {
        setSourceSchemaError(selectedSource.id, null);
      }
    }
  }, [selectedSource, sourceSchemas, sourceSchemaErrors, setSourceSchema, setSourceSchemaError]);

  // Track schema errors by source
  useEffect(() => {
    if (schemasError && selectedSource?.id) {
      setSourceSchemaError(selectedSource.id, "Error loading schemas");
    }
  }, [schemasError, selectedSource, setSourceSchemaError]);

  // Track source statuses
  useEffect(() => {
    if (selectedSourceStatus && selectedSource?.id) {
      setSourceStatus(selectedSource.id, selectedSourceStatus);
    }
  }, [selectedSourceStatus, selectedSource, setSourceStatus]);

  // This is now handled by Zustand persist middleware

  // This is now handled by Zustand persist middleware

  // Build file tree data with sources and their schemas
  let fileTreeData = sources ? sourcesToFileTreeNodes(sources) : sampleFileTree;

  // Add schema children to sources that have loaded schemas
  if (Object.keys(sourceSchemaMap).length > 0) {
    fileTreeData = (fileTreeData as FileNode[]).map((node) => {
      if (node.id && sourceSchemaMap[node.id]) {
        const schemaNodes = schemaToFileTreeNodes(sourceSchemaMap[node.id], node.id);
        return {
          ...node,
          children: schemaNodes
        };
      }
      return node;
    });
  }

  const handleSourceSelect = (source: Source) => {
    setSelectedSource(source);
  };

  // Handle table double-click
  const handleTableDoubleClick = async (sourceId: string, tableName: string) => {
    // Build the query to select all data from the table with a limit
    const query = `SELECT * FROM ${tableName} LIMIT 101`;

    // Set the selected table data with the query
    setSelectedTableData({ sourceId, tableName, query });

    // Clear previous query results and set loading state
    setQueryResults(null);
    setQueryRunning(true);
  };

  // Handle SQL query execution
  const handleQueryExecution = (results: object[]) => {
    setQueryResults(results);
    // Clear table selection since we're viewing custom query results
    setSelectedTableData(null);
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="h-screen flex flex-col">
        <TopMenu />
        <div className="flex-1">
          <PanelGroup direction="horizontal" onLayout={(newSizes) => setPanelSizes(newSizes)}>
            <Panel defaultSize={panelSizes[0]} minSize={15}>
              <div className="h-full">
                {sourcesLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading sources...</div>
                ) : sourcesError ? (
                  <div className="p-4 text-sm text-red-500">Error loading sources</div>
                ) : (
                  <div className="h-full">
                    <FileTree
                      data={fileTreeData}
                      onSourceSelect={handleSourceSelect}
                      onTableDoubleClick={handleTableDoubleClick}
                    />
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            <Panel defaultSize={panelSizes[1]} minSize={30}>
              <PanelGroup direction="vertical" storage={localStorage} autoSaveId="editor-layout">
                <Panel defaultSize={60} minSize={30}>
                  <TableDataDisplay
                    tableData={selectedTableData}
                    queryResults={queryResults}
                    isQueryRunning={queryRunning}
                  />
                </Panel>

                <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

                <Panel defaultSize={40} minSize={10}>
                  <Editor
                    selectedSource={selectedSource}
                    schemasLoading={schemasLoading}
                    schemasError={schemasError}
                    onQueryExecution={handleQueryExecution}
                    onQueryStatusChange={setQueryRunning}
                  />
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            <Panel defaultSize={panelSizes[2]} minSize={15}>
              <div className="h-full">
                <ChatSidebar />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
