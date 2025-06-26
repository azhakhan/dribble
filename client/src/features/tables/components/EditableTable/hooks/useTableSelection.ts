import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { GridColumn } from "@glideapps/glide-data-grid";

// Helper functions for localStorage
const getStorageKey = (tableId?: string, source?: string, schema?: string) => {
  const parts = [source, schema, tableId].filter(Boolean);
  return parts.length > 0 ? `table_columns_${parts.join("_")}` : null;
};

const loadColumnSizes = (storageKey: string | null) => {
  if (!storageKey) return {};
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Failed to load column sizes:", e);
    return {};
  }
};

const saveColumnSizes = (storageKey: string | null, sizes: Record<string, number>) => {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sizes));
  } catch (e) {
    console.error("Failed to save column sizes:", e);
  }
};

interface UseTableSelectionParams {
  tableId?: string;
  source?: string;
  schema?: string;
  data: Record<string, unknown>[];
}

export const useTableSelection = ({
  tableId = "default",
  source,
  schema,
  data
}: UseTableSelectionParams) => {
  const initializedRef = useRef(false);
  const [columnSizes, setColumnSizes] = useState<Record<string, number>>({});

  const storageKey = useMemo(
    () => getStorageKey(tableId, source, schema),
    [tableId, source, schema]
  );

  // Load saved column sizes from localStorage on mount
  useEffect(() => {
    if (!initializedRef.current && storageKey) {
      const savedSizes = loadColumnSizes(storageKey);
      setColumnSizes(savedSizes);
      initializedRef.current = true;
    }
  }, [storageKey]);

  // Initialize column sizes when data changes
  useEffect(() => {
    if (data.length > 0 && initializedRef.current) {
      const keys = Object.keys(data[0]);
      const newSizes = { ...columnSizes };
      let changed = false;

      // Add any missing columns with default width
      keys.forEach((key) => {
        if (newSizes[key] === undefined) {
          newSizes[key] = 200;
          changed = true;
        }
      });

      if (changed) {
        setColumnSizes(newSizes);
        if (storageKey) saveColumnSizes(storageKey, newSizes);
      }
    }
  }, [data, columnSizes, storageKey]);

  const handleColumnResize = useCallback(
    (column: GridColumn, newSize: number) => {
      // Update the column size in state
      const newColumnSizes = {
        ...columnSizes,
        [column.title]: newSize
      };

      setColumnSizes(newColumnSizes);

      // Save to localStorage
      if (storageKey) {
        saveColumnSizes(storageKey, newColumnSizes);
      }
    },
    [columnSizes, storageKey]
  );

  return {
    columnSizes,
    handleColumnResize
  };
};
