import React from "react";
import { Folder, File, Database, Table } from "lucide-react";
import { SourceIcon } from "../shared/TreeIcons";
import { getColumnTypeIcon } from "../../ColumnTypeIcons";
import type { FileNode } from "@/shared/lib/fileTreeUtils";

interface FileTreeIconProps {
  node: FileNode;
  isLoading?: boolean;
}

export const FileTreeIcon: React.FC<FileTreeIconProps> = ({ node, isLoading }) => {
  const isFolder = node.type === "folder";
  const isSource = node.type === "source";
  const isSchema = node.type === "schema";
  const isTable = node.type === "table";
  const isView = node.type === "view";
  const isColumn = node.type === "column";

  if (isFolder) {
    return <Folder className="h-4 w-4" strokeWidth={1} />;
  } else if (isSource) {
    return <SourceIcon dbtype={node.dbtype} isLoading={isLoading} size={4} />;
  } else if (isSchema) {
    return <Database className="h-4 w-4" strokeWidth={1} />;
  } else if (isTable || isView) {
    return <Table className="h-4 w-4" strokeWidth={1} />;
  } else if (isColumn) {
    return getColumnTypeIcon(node.dataType || "");
  } else {
    return <File className="h-4 w-4" strokeWidth={1} />;
  }
};
