import React from "react";
import { Database, Loader2 } from "lucide-react";
import { PostgresIcon, MySQLIcon, SQLiteIcon } from "../../../icons";
import type { SourceIconProps } from "./types";

export const SourceIcon: React.FC<SourceIconProps> = ({ dbtype, isLoading, size = 4 }) => {
  if (isLoading) {
    return <Loader2 className={`h-${size} w-${size} animate-spin`} strokeWidth={1} />;
  }

  const dbType = dbtype?.toLowerCase();
  const sizeClass = `h-${size} w-${size}`;

  if (dbType === "postgres") {
    return (
      <div className={`${sizeClass} flex items-center justify-center`}>
        <PostgresIcon />
      </div>
    );
  } else if (dbType === "mysql") {
    return (
      <div className={`${sizeClass} flex items-center justify-center`}>
        <MySQLIcon />
      </div>
    );
  } else if (dbType === "sqlite") {
    return (
      <div className={`${sizeClass} flex items-center justify-center`}>
        <SQLiteIcon />
      </div>
    );
  } else {
    return <Database className={sizeClass} strokeWidth={1} />;
  }
};
