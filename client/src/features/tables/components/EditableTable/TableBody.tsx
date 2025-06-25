interface TableBodyProps {
  data: Record<string, unknown>[];
  columns: string[];
  onCellClick?: (row: number, column: string, value: unknown) => void;
  onRowSelect?: (row: number) => void;
}

// This component is a placeholder for future body customization
// Currently, the DataEditor handles body rendering internally
export const TableBody = ({ data, columns, onCellClick, onRowSelect }: TableBodyProps) => {
  // For now, this is just a utility component that could be extended
  // in the future for custom body rendering if needed

  // Explicitly mark parameters as used for linter
  void data;
  void columns;
  void onCellClick;
  void onRowSelect;

  return null;
};

// Utility function for row validation
export const validateRow = (row: Record<string, unknown>, columns: string[]): boolean => {
  return columns.every((column) => column in row);
};

// Utility function for data transformation
export const transformRowData = (
  row: Record<string, unknown>,
  transformers: Record<string, (value: unknown) => unknown> = {}
): Record<string, unknown> => {
  const transformed = { ...row };

  Object.entries(transformers).forEach(([column, transformer]) => {
    if (column in transformed) {
      transformed[column] = transformer(transformed[column]);
    }
  });

  return transformed;
};

// Utility function for filtering data
export const filterData = (
  data: Record<string, unknown>[],
  filters: Record<string, (value: unknown) => boolean>
): Record<string, unknown>[] => {
  return data.filter((row) => {
    return Object.entries(filters).every(([column, filter]) => {
      return column in row ? filter(row[column]) : true;
    });
  });
};
