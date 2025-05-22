import { ThemeProvider } from "@/components/theme-provider";
import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/logo.png";

import { EditableTable } from "@/elements/EditableTable";
import {
  FileTree,
  sourcesToFileTreeNodes,
  schemaToFileTreeNodes,
} from "@/elements/FileTree";
import { ChatSidebar } from "@/elements/ChatSidebar";
import { useSourcesQuery } from "@/hooks/useSourcesQuery";
import { useSourceSchemasQuery } from "@/hooks/useSourceSchemasQuery";
import type { Source } from "@/lib/api";

interface FileNode {
  name: string;
  type: "file" | "folder" | "source";
  id?: string;
  dbtype?: string;
  children?: FileNode[];
}

// Sample file tree data as fallback
const sampleFileTree: FileNode[] = [
  {
    name: "Loading...",
    type: "folder",
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
    return savedSizes ? JSON.parse(savedSizes) : [10, 70, 20];
  });
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);

  // Query for all sources
  const {
    data: sources,
    isLoading: sourcesLoading,
    error: sourcesError,
  } = useSourcesQuery();

  // Query for selected source schemas
  const {
    data: schemaData,
    isLoading: schemasLoading,
    error: schemasError,
  } = useSourceSchemasQuery(selectedSource?.id);

  // Convert sources to file tree nodes when data is loaded
  let fileTreeData = sources ? sourcesToFileTreeNodes(sources) : sampleFileTree;

  // If we have schema data for the selected source, add it to the file tree
  if (selectedSource && schemaData) {
    // Add schema data to the tree
    const schemaNodes = schemaToFileTreeNodes(schemaData, selectedSource.id);
    fileTreeData = [...fileTreeData, ...schemaNodes];
  }

  useEffect(() => {
    localStorage.setItem("panel-sizes", JSON.stringify(sizes));
  }, [sizes]);

  const handleFileSelect = (path: string) => {
    console.log("Selected file:", path);
    // Implement your file selection logic here
  };

  const handleSourceSelect = (source: Source) => {
    console.log("Selected source:", source);
    setSelectedSource(source);
    // When a source is selected, it will trigger the schemas query
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
                  <FileTree
                    data={fileTreeData}
                    onFileSelect={handleFileSelect}
                    onSourceSelect={handleSourceSelect}
                  />
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
                  <div className="h-full overflow-auto">
                    {selectedSource ? (
                      <div className="p-2 border-b bg-muted">
                        <h3 className="text-sm font-medium">
                          Connected to: {selectedSource.name} (
                          {selectedSource.dbtype})
                          {schemasLoading && " - Loading schemas..."}
                          {schemasError && " - Error loading schemas"}
                        </h3>
                      </div>
                    ) : null}
                    <EditableTable />
                  </div>
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
