import type { TableData } from "../types/api";

/**
 * Converts an error to a standardized TableData format for display
 */
export const errorToTableData = (error: unknown, context?: string): TableData => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return [
    {
      error: context ? `${context}: ${errorMessage}` : errorMessage,
      timestamp: new Date().toISOString()
    }
  ];
};

/**
 * Creates a standardized "no data" message in TableData format
 */
export const createNoDataMessage = (message = "No data available"): TableData => {
  return [
    {
      message,
      timestamp: new Date().toISOString()
    }
  ];
};

/**
 * Creates a standardized loading message in TableData format
 */
export const createLoadingMessage = (message = "Loading data..."): TableData => {
  return [
    {
      status: message,
      timestamp: new Date().toISOString()
    }
  ];
};
