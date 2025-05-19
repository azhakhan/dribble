import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";

interface FileNode {
  name: string;
  type: "file" | "folder";
  children?: FileNode[];
}

interface FileTreeProps {
  data: FileNode[];
  onFileSelect?: (path: string) => void;
}

const FileTreeItem = ({
  node,
  level = 0,
  onFileSelect,
}: {
  node: FileNode;
  level?: number;
  onFileSelect?: (path: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = node.type === "folder";

  const handleClick = () => {
    if (isFolder) {
      setIsOpen(!isOpen);
    } else if (onFileSelect) {
      onFileSelect(node.name);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer"
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {isFolder ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : null}
        {isFolder ? (
          <Folder className="h-4 w-4" />
        ) : (
          <File className="h-4 w-4" />
        )}
        <span className="text-sm">{node.name}</span>
      </div>
      {isFolder && isOpen && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileTreeItem
              key={index}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({ data, onFileSelect }: FileTreeProps) => {
  return (
    <div className="h-full overflow-auto border-r">
      <div className="p-2 font-semibold border-b">Files</div>
      <div>
        {data.map((node, index) => (
          <FileTreeItem key={index} node={node} onFileSelect={onFileSelect} />
        ))}
      </div>
    </div>
  );
};
