import { ThemeProvider } from "@/components/theme-provider";
import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ModeToggle } from "@/components/mode-toggle";
import logo from "@/assets/logo.png";

import { EditableTable } from "@/elements/EditableTable";
import { FileTree } from "@/elements/FileTree";
import { ChatSidebar } from "@/elements/ChatSidebar";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

// Sample file tree data - replace this with your actual data
const sampleFileTree: FileNode[] = [
  {
    name: "Postgres",
    type: "folder",
    children: [
      {
        name: "Tables",
        type: "folder",
        children: [
          { name: "users.sql", type: "file" },
          { name: "products.sql", type: "file" },
        ],
      },
      {
        name: "Views",
        type: "folder",
        children: [{ name: "active_users.sql", type: "file" }],
      },
    ],
  },
  {
    name: "Snowflake",
    type: "folder",
    children: [
      {
        name: "Tables",
        type: "folder",
        children: [
          { name: "users.sql", type: "file" },
          { name: "products.sql", type: "file" },
        ],
      },
      {
        name: "Views",
        type: "folder",
        children: [{ name: "active_users.sql", type: "file" }],
      },
    ],
  },
];

function TopMenu() {
  return (
    <div className="h-8 border-b flex items-center justify-between px-3 bg-background">
      <div className="flex items-center gap-2">
        <img src={logo} alt="DBIDE" className="w-5 h-5" />
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

  useEffect(() => {
    localStorage.setItem("panel-sizes", JSON.stringify(sizes));
  }, [sizes]);

  const handleFileSelect = (path: string) => {
    console.log("Selected file:", path);
    // Implement your file selection logic here
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
                <FileTree
                  data={sampleFileTree}
                  onFileSelect={handleFileSelect}
                />
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
