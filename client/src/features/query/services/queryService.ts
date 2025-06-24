import { generateQueryName } from "@/shared/lib/queryUtils";

export interface CreateQueryParams {
  name: string;
  sourceId: string;
}

export interface QueryCreationResult {
  success: boolean;
  queryId?: string;
  error?: string;
}

/**
 * Service functions for query-related operations
 */
export const queryService = {
  /**
   * Generate a unique query name
   */
  generateQueryName(): string {
    return generateQueryName();
  },

  /**
   * Validate query creation parameters
   */
  validateCreateQueryParams(params: CreateQueryParams): { isValid: boolean; error?: string } {
    if (!params.name.trim()) {
      return { isValid: false, error: "Query name is required" };
    }

    if (!params.sourceId) {
      return { isValid: false, error: "Data source is required" };
    }

    return { isValid: true };
  },

  /**
   * Format query name for display
   */
  formatQueryName(name: string, isDirty: boolean = false): string {
    return isDirty ? `${name} •` : name;
  },

  /**
   * Get query display status based on latest run
   */
  getQueryStatus(latestRun: { error_message?: string } | null): { text: string; color: string } {
    if (!latestRun) {
      return { text: "No runs yet", color: "text-muted-foreground" };
    }

    if (latestRun.error_message) {
      return { text: "Failed", color: "text-red-600" };
    }

    return { text: "Success", color: "text-green-600" };
  },

  /**
   * Format row count for display
   */
  formatRowCount(rowCount: number | null): string {
    if (rowCount === null) return "";
    return `(${rowCount} rows)`;
  }
};
