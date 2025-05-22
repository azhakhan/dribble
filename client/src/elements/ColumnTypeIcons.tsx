import {
  Hash,
  Type,
  ToggleLeft,
  Calendar,
  Clock,
  Key,
  Database,
  AlignLeft,
  CircleDot,
  Binary,
  Brackets,
  SigmaSquare,
  ListTree,
} from "lucide-react";

// Function to determine icon based on data type
export const getColumnTypeIcon = (dataType: string) => {
  // Normalize the data type for comparison (lowercase and trim)
  const type = dataType.toLowerCase().trim();

  // Text types
  if (
    type.includes("char") ||
    type.includes("text") ||
    type.includes("varchar") ||
    type.includes("string")
  ) {
    return <Type className="h-4 w-4" strokeWidth={1} />;
  }

  // Integer types
  if (
    type.includes("int") ||
    type.includes("serial") ||
    type.includes("smallint") ||
    type.includes("bigint") ||
    type.includes("integer")
  ) {
    return <Hash className="h-4 w-4" strokeWidth={1} />;
  }

  // Decimal/Numeric/Float types
  if (
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("float") ||
    type.includes("double") ||
    type.includes("real") ||
    type.includes("money")
  ) {
    return <SigmaSquare className="h-4 w-4" strokeWidth={1} />;
  }

  // Boolean types
  if (type.includes("bool")) {
    return <ToggleLeft className="h-4 w-4" strokeWidth={1} />;
  }

  // Date types
  if (type.includes("date")) {
    return <Calendar className="h-4 w-4" strokeWidth={1} />;
  }

  // Time types
  if (type.includes("time")) {
    return <Clock className="h-4 w-4" strokeWidth={1} />;
  }

  // UUID types
  if (type.includes("uuid")) {
    return <Key className="h-4 w-4" strokeWidth={1} />;
  }

  // JSON types
  if (type.includes("json")) {
    return <Brackets className="h-4 w-4" strokeWidth={1} />;
  }

  // Array types
  if (type.includes("array") || type.includes("[]")) {
    return <ListTree className="h-4 w-4" strokeWidth={1} />;
  }

  // Binary types
  if (
    type.includes("binary") ||
    type.includes("bytea") ||
    type.includes("blob")
  ) {
    return <Binary className="h-4 w-4" strokeWidth={1} />;
  }

  // Enum types
  if (type.includes("enum")) {
    return <ListTree className="h-4 w-4" strokeWidth={1} />;
  }

  // Geometry types
  if (
    type.includes("point") ||
    type.includes("line") ||
    type.includes("polygon") ||
    type.includes("geometry")
  ) {
    return <CircleDot className="h-4 w-4" strokeWidth={1} />;
  }

  // Network types
  if (
    type.includes("inet") ||
    type.includes("cidr") ||
    type.includes("macaddr")
  ) {
    return <Database className="h-4 w-4" strokeWidth={1} />;
  }

  // Default fallback for unknown types
  return <AlignLeft className="h-4 w-4" strokeWidth={1} />;
};
