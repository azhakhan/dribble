import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Database,
  Table,
  Columns,
  Loader2,
  PlusCircle,
  MoreVertical
} from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../icons";
import { getColumnTypeIcon } from "./ColumnTypeIcons";
import type { FileNode } from "@/lib/fileTreeUtils";
import { AddSourceDialog } from "@/elements/FileTree/AddSourceDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { EditSourceDialog } from "./EditSourceDialog";
import { RenameSourceDialog } from "./RenameSourceDialog";
import { DeleteSourceDialog } from "./DeleteSourceDialog";

interface FileTreeProps {
  data: FileNode[];
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
  loadingSourceId?: string;
}

const FileTreeItem = ({
  node,
  level = 0,
  onSourceSelect,
  onTableDoubleClick,
  loadingSourceId,
  selectedNodeId,
  setSelectedNodeId
}: {
  node: FileNode;
  level?: number;
  onSourceSelect?: (source: { id: string; name: string; dbtype: string }) => void;
  onTableDoubleClick?: (sourceId: string, tableName: string) => void;
  loadingSourceId?: string;
  selectedNodeId?: string;
  setSelectedNodeId: (id: string | undefined) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const isColumn = node.type === "column";
  const hasChildren = Boolean(node.children?.length);
  const isLoading = isSource && loadingSourceId === node.id;
  const isSelected = selectedNodeId === node.id;

  // Handle item selection (single click)
  const handleItemClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Set this node as selected
    if (node.id) {
      setSelectedNodeId(node.id);
    }

    // For all database objects, just select them
    if (isSource && onSourceSelect && node.id) {
      onSourceSelect({
        id: node.id,
        name: node.name,
        dbtype: node.dbtype || ""
      });
    }
  };

  // Handle chevron click to toggle children visibility
  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Handle double-click behavior
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if ((isSource || isSchema || isFolder) && hasChildren) {
      // For sources, schemas, and folders (including Tables folder), show children on double-click
      setIsOpen(!isOpen);
    } else if (isTable && onTableDoubleClick && node.id) {
      // For tables and views, query them (both are "table" type)
      if (node.sourceId) {
        onTableDoubleClick(node.sourceId, node.name);
      }
    }
  };

  const renderIcon = () => {
    if (isFolder) {
      return <Folder className="h-4 w-4" strokeWidth={1} />;
    } else if (isSource) {
      // Show loading spinner if this source is being loaded
      if (isLoading) {
        return <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1} />;
      }

      // Use SVG components with constrained size
      const dbType = node.dbtype?.toLowerCase();
      if (dbType === "postgres") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <PostgresIcon />
          </div>
        );
      } else if (dbType === "mysql") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <MySQLIcon />
          </div>
        );
      } else if (dbType === "sqlite") {
        return (
          <div className="h-4 w-4 flex items-center justify-center">
            <SQLiteIcon />
          </div>
        );
      } else {
        return <Database className="h-4 w-4" strokeWidth={1} />;
      }
    } else if (isSchema) {
      return <Database className="h-4 w-4" strokeWidth={1} />;
    } else if (isTable) {
      // Both tables and views are "table" type
      return <Table className="h-4 w-4" strokeWidth={1} />;
    } else if (isColumn) {
      // If it's a column, use the column type icon instead of the generic Columns icon
      if (node.dataType) {
        return getColumnTypeIcon(node.dataType);
      }
      return <Columns className="h-4 w-4" strokeWidth={1} />;
    }
    return <File className="h-4 w-4" strokeWidth={1} />;
  };

  const renderChevron = () => {
    if ((isFolder || isSchema || isTable || isSource) && hasChildren) {
      return (
        <div onClick={handleChevronClick}>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 cursor-pointer" />
          ) : (
            <ChevronRight className="h-4 w-4 cursor-pointer" />
          )}
        </div>
      );
    }
    // Return null or empty div with same width to maintain alignment
    return <div className="w-4"></div>;
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 hover:bg-accent cursor-pointer select-none group ${
          isSelected ? "bg-accent" : ""
        }`}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleItemClick}
        onDoubleClick={handleDoubleClick}
      >
        {renderChevron()}
        {renderIcon()}
        <span className="text-sm font-light">{node.name}</span>
        {isColumn && node.nullable === false && (
          <span className="text-xs text-red-500 ml-1">*</span>
        )}
        {isSource && (
          <div
            className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground scale-75 flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                  <MoreVertical className="h-3 w-3" />
                  <span className="sr-only">Source options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropdownOpen(false);

                    // Small delay to ensure dropdown is closed before opening dialog
                    setTimeout(() => {
                      setEditDialogOpen(true);
                    }, 100);
                  }}
                >
                  Edit Credentials
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropdownOpen(false);

                    // Small delay to ensure dropdown is closed before opening dialog
                    setTimeout(() => {
                      setRenameDialogOpen(true);
                    }, 100);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDropdownOpen(false);

                    // Small delay to ensure dropdown is closed before opening dialog
                    setTimeout(() => {
                      setDeleteDialogOpen(true);
                    }, 100);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Separate Dialogs */}
      {isSource && node.id && (
        <>
          <EditSourceDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
            }}
            sourceId={node.id}
          />

          <RenameSourceDialog
            open={renameDialogOpen}
            onOpenChange={(open) => {
              setRenameDialogOpen(open);
            }}
            sourceId={node.id}
            sourceName={node.name}
          />

          <DeleteSourceDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
            }}
            sourceId={node.id}
            sourceName={node.name}
          />
        </>
      )}

      {(isFolder || isSchema || isTable || isSource) && isOpen && (
        <div>
          {node.children &&
            node.children.map((child, index) => (
              <FileTreeItem
                key={index}
                node={child}
                level={level + 1}
                onSourceSelect={onSourceSelect}
                onTableDoubleClick={onTableDoubleClick}
                loadingSourceId={loadingSourceId}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
              />
            ))}
          {isSource && (!node.children || node.children.length === 0) && !isLoading && (
            <div
              className="flex items-center gap-1 px-2 py-1 text-muted-foreground select-none"
              style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
            >
              <span className="text-sm font-light">No schemas found</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const FileTree = ({
  data,
  onSourceSelect,
  onTableDoubleClick,
  loadingSourceId
}: FileTreeProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);

  return (
    <div className="h-full overflow-auto border-r select-none">
      <div className="p-2 font-semibold border-b flex items-center justify-between">
        <span>Sources</span>
        <AddSourceDialog className="hover:text-foreground text-muted-foreground" />
      </div>
      <div>
        {data.map((node, index) => (
          <FileTreeItem
            key={index}
            node={node}
            onSourceSelect={onSourceSelect}
            onTableDoubleClick={onTableDoubleClick}
            loadingSourceId={loadingSourceId}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
          />
        ))}
        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-sm">
            <p className="mb-2">No sources found</p>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => {
                // This is just a placeholder to open the add source dialog
                // The actual implementation would dispatch a click event to the AddSourceDialog
                const addButton = document.querySelector('[data-testid="add-source-button"]');
                if (addButton) {
                  (addButton as HTMLButtonElement).click();
                }
              }}
            >
              <PlusCircle className="h-4 w-4" />
              Add Source
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
