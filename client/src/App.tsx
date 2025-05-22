import { ThemeProvider } from "@/components/theme-provider";
import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/logo.png";

import { FileTree } from "@/elements/FileTree";
import {
  sourcesToFileTreeNodes,
  schemaToFileTreeNodes,
  type FileNode,
} from "@/lib/fileTreeUtils";
import { TableDataDisplay } from "@/elements/TableDataDisplay";
import { ChatSidebar } from "@/elements/ChatSidebar";
import { useSourcesQuery } from "@/hooks/useSourcesQuery";
import { useSourceSchemasQuery } from "@/hooks/useSourceSchemasQuery";
import type { Source } from "@/lib/api";

// Interface for schema objects
interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface SchemaTable {
  columns: SchemaColumn[];
}

interface SchemaView {
  columns: SchemaColumn[];
}

interface SchemaObject {
  tables: Record<string, SchemaTable>;
  views: Record<string, SchemaView>;
}

// Type for the schema map
type SourceSchemaMap = Record<string, Record<string, SchemaObject>>;

// Sample file tree data as fallback
const sampleFileTree = [
  {
    name: "Loading...",
    type: "folder" as const,
    children: [],
  },
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
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [sqlContent, setSqlContent] = useState<string>(
    "-- Write your SQL query here\n"
  );
  const [sizes, setSizes] = useState(() => {
    const savedSizes = localStorage.getItem("panel-sizes");
    return savedSizes ? JSON.parse(savedSizes) : [20, 60, 20];
  });

  // State for selected source and table
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sourceSchemaMap, setSourceSchemaMap] = useState<SourceSchemaMap>({});
  const [selectedTableData, setSelectedTableData] = useState<{
    sourceId: string;
    tableName: string;
  } | null>(null);

  // Query for all sources
  const {
    data: sources,
    isLoading: sourcesLoading,
    error: sourcesError,
  } = useSourcesQuery();

  // Query for selected source schemas
  const {
    data: sourceSchemas,
    isLoading: schemasLoading,
    error: schemasError,
  } = useSourceSchemasQuery(selectedSource?.id);

  // Update schema map when new schema data is loaded
  useEffect(() => {
    if (selectedSource?.id && sourceSchemas) {
      setSourceSchemaMap((prev) => ({
        ...prev,
        [selectedSource.id]: sourceSchemas,
      }));
    }
  }, [selectedSource, sourceSchemas]);

  // Build file tree data with sources and their schemas
  let fileTreeData = sources ? sourcesToFileTreeNodes(sources) : sampleFileTree;

  // Add schema children to sources that have loaded schemas
  if (Object.keys(sourceSchemaMap).length > 0) {
    fileTreeData = (fileTreeData as FileNode[]).map((node) => {
      if (node.id && sourceSchemaMap[node.id]) {
        const schemaNodes = schemaToFileTreeNodes(
          sourceSchemaMap[node.id],
          node.id
        );
        return {
          ...node,
          children: schemaNodes,
        };
      }
      return node;
    });
  }

  useEffect(() => {
    localStorage.setItem("panel-sizes", JSON.stringify(sizes));
  }, [sizes]);

  const handleSourceSelect = (source: Source) => {
    console.log("Source selected in App:", source);
    setSelectedSource(source);
  };

  // Handle table double-click
  const handleTableDoubleClick = (sourceId: string, tableName: string) => {
    setSelectedTableData({ sourceId, tableName });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSqlContent(value);
    }
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="h-screen flex flex-col">
        <TopMenu />
        <div className="flex-1">
          <PanelGroup
            direction="horizontal"
            onLayout={(sizes) => setSizes(sizes)}
            storage={localStorage}
            autoSaveId="main-layout"
          >
            <Panel defaultSize={sizes[0]} minSize={10}>
              <div className="h-full">
                {sourcesLoading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    Loading sources...
                  </div>
                ) : sourcesError ? (
                  <div className="p-4 text-sm text-red-500">
                    Error loading sources
                  </div>
                ) : (
                  <div className="h-full">
                    {schemasError && selectedSource && (
                      <div className="p-2 text-xs text-red-500">
                        Error loading schemas
                      </div>
                    )}
                    <FileTree
                      data={fileTreeData}
                      onSourceSelect={handleSourceSelect}
                      onTableDoubleClick={handleTableDoubleClick}
                      loadingSourceId={
                        schemasLoading ? selectedSource?.id : undefined
                      }
                    />
                  </div>
                )}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            <Panel defaultSize={sizes[1]} minSize={30}>
              <PanelGroup
                direction="vertical"
                storage={localStorage}
                autoSaveId="editor-layout"
              >
                <Panel defaultSize={60} minSize={30}>
                  <TableDataDisplay tableData={selectedTableData} />
                </Panel>

                <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />

                <Panel defaultSize={40} minSize={10}>
                  <div ref={editorContainerRef} className="h-full">
                    <Editor
                      height="100%"
                      defaultLanguage="sql"
                      theme="vs-dark"
                      value={sqlContent}
                      onChange={handleEditorChange}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: "on",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

            <Panel defaultSize={sizes[2]} minSize={15}>
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
