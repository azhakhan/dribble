import { ThemeProvider } from "@/components/theme-provider";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

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
    name: "Database",
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

function App() {
  const handleFileSelect = (path: string) => {
    console.log("Selected file:", path);
    // Implement your file selection logic here
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div className="flex h-screen">
        <div className="w-64 flex-shrink-0">
          <FileTree data={sampleFileTree} onFileSelect={handleFileSelect} />
        </div>
        <div className="flex-1 overflow-auto">
          <EditableTable />
        </div>
        <div className="w-80 flex-shrink-0">
          <ChatSidebar />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
