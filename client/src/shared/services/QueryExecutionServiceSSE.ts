import type { CreateQueryRunRequest } from "@/shared/lib/api";
import { executeQueryVersionTask } from "@/shared/lib/api";
import type { QueryTab } from "@/shared/store/types";
import type { TableData, TableRow } from "@/shared/types/api";
import { convertToTableData } from "@/shared/utils/typeUtils";
import { createNoDataMessage } from "@/shared/utils/errorUtils";
import { useSSEStore } from "@/shared/store/useSSEStore";
import { sseConnectionManager } from "./SSEConnectionManager";

export interface QueryExecutionOptions {
  sql?: string;
  overrideFilters?: { where?: string; order_by?: string };
}

export interface QueryExecutionResult {
  success: boolean;
  results?: TableData;
  error?: string;
  queryRunId?: string;
}

export class QueryExecutionServiceSSE {
  /**
   * Execute a query for a given tab using SSE streaming
   */
  static async executeQuery(
    tab: QueryTab,
    options: QueryExecutionOptions = {}
  ): Promise<QueryExecutionResult> {
    try {
      // Determine what SQL to run - prioritize the passed sql parameter over tab content
      const queryToRun = options.sql || tab.editorContent;
      if (!queryToRun.trim()) {
        return {
          success: false,
          error: "No SQL to execute"
        };
      }

      // Step 1: Ensure we have a version ID for execution
      const versionId = await this.ensureQueryVersionExists(tab, queryToRun);
      if (!versionId) {
        return {
          success: false,
          error: "No valid query version ID available. Cannot execute query."
        };
      }

      // Step 2: Create and start the query task
      const taskId = await this.createQueryTask(tab, versionId, options.overrideFilters);

      // Step 3: Ensure SSE connection is established and track the query
      try {
        await sseConnectionManager.connect();
        if (tab.queryId) {
          sseConnectionManager.trackQueryTask(tab.queryId, taskId);
        }
      } catch {
        // SSE connection failed, but continue with execution
        // The hook will handle fallback polling if needed
      }

      // Step 4: Return immediately with the task ID
      // The SSE stream will be managed by the useQueryStream hook
      return {
        success: true,
        queryRunId: taskId, // Keep the same field name for compatibility
        results: undefined // Results will come via SSE
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Query execution failed: ${errorMessage}`,
        results: [{ error: errorMessage }]
      };
    }
  }

  /**
   * Execute a query and wait for results via Promise (for backward compatibility)
   * This method uses SSE internally but presents a Promise-based interface
   */
  static async executeQueryAndWait(
    tab: QueryTab,
    options: QueryExecutionOptions = {},
    timeoutMs: number = 30000
  ): Promise<QueryExecutionResult> {
    const result = await this.executeQuery(tab, options);

    if (!result.success || !result.queryRunId) {
      return result;
    }

    // Wait for SSE result
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Query execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const sseStore = useSSEStore.getState();

      // Check if result is already available (need queryId for this)
      if (tab.queryId) {
        const existingResult = sseStore.getQueryLatestTask(tab.queryId!);
        if (existingResult && existingResult.status !== "running") {
          clearTimeout(timeoutId);

          if (existingResult.status === "success") {
            resolve({
              success: true,
              results: this.processResults(existingResult.data || []),
              queryRunId: result.queryRunId
            });
          } else {
            resolve({
              success: false,
              error: existingResult.error || "Query execution failed",
              queryRunId: result.queryRunId
            });
          }
          return;
        }
      }

      // Set up a polling mechanism to check for updates
      // This is a fallback - normally the UI would use useQueryStream hook
      if (tab.queryId) {
        const checkInterval = setInterval(() => {
          const currentResult = sseStore.getQueryLatestTask(tab.queryId!);

          if (currentResult && currentResult.status !== "running") {
            clearTimeout(timeoutId);
            clearInterval(checkInterval);

            if (currentResult.status === "success") {
              resolve({
                success: true,
                results: this.processResults(currentResult.data || []),
                queryRunId: result.queryRunId
              });
            } else {
              resolve({
                success: false,
                error: currentResult.error || "Query execution failed",
                queryRunId: result.queryRunId
              });
            }
          }
        }, 100);
      } else {
        // No queryId available, reject after timeout
        reject(new Error("No query ID available for polling results"));
      }
    });
  }

  /**
   * Ensure a query version exists for the given SQL content
   */
  private static async ensureQueryVersionExists(
    tab: QueryTab,
    queryToRun: string
  ): Promise<string | null> {
    // Dynamic imports to avoid circular dependencies
    const { useQueryStore } = await import("@/shared/store/useQueryStore");
    const { useSourceStore } = await import("@/shared/store/useSourceStore");

    const queryStore = useQueryStore.getState();
    const sourceStore = useSourceStore.getState();

    if (tab.queryId) {
      // Check if it's an ephemeral query that should be converted
      const query = queryStore.queries[tab.queryId];
      if (query?.is_ephemeral) {
        await this.convertEphemeralQueryIfNeeded(tab, queryStore, sourceStore);
      }

      // Get the latest version to compare against
      const currentLatestVersion = await queryStore.loadLatestQueryVersion(tab.queryId);

      // Check if what user wants to execute is different from the latest saved version
      const shouldSaveNewVersion =
        !currentLatestVersion || queryToRun.trim() !== currentLatestVersion.sql.trim();

      if (shouldSaveNewVersion) {
        // Save the current editor content as a new version
        const newVersion = await queryStore.saveQueryVersion(tab.queryId, queryToRun, "run");

        // Update tab to mark it as clean
        const { QueryVersionService } = await import("./QueryVersionService");
        await QueryVersionService.updateTabAfterVersionSave(tab.id, newVersion, queryToRun);

        return newVersion.id;
      } else {
        // Content is the same as latest version, use existing version
        return currentLatestVersion.id;
      }
    } else {
      // Create a new ephemeral query and save the version
      const newQuery = await queryStore.createNewQuery({
        sourceId: tab.sourceId
      });

      // Save the current editor content as the first version
      const newVersion = await queryStore.saveQueryVersion(newQuery.id, queryToRun, "run");

      // Update tab to mark it as clean
      const { QueryVersionService } = await import("./QueryVersionService");
      await QueryVersionService.updateTabAfterVersionSave(tab.id, newVersion, queryToRun);

      return newVersion.id;
    }
  }

  /**
   * Convert ephemeral query to regular if needed
   */
  private static async convertEphemeralQueryIfNeeded(
    tab: QueryTab,
    queryStore: ReturnType<typeof import("@/shared/store/useQueryStore").useQueryStore.getState>,
    sourceStore: ReturnType<typeof import("@/shared/store/useSourceStore").useSourceStore.getState>
  ): Promise<void> {
    if (!tab.queryId) return;

    const query = queryStore.queries[tab.queryId];
    if (query?.is_ephemeral && tab.isDirty) {
      // Generate name for the converted query
      const date = new Date();
      const sourceName = sourceStore.sources[tab.sourceId]?.name || "Unknown";
      const queryName = `${sourceName} query ${date.toISOString().split("T")[0]}`;

      // Convert to regular query
      const updatedQuery = await queryStore.convertEphemeralToRegular(tab.queryId, queryName);

      // Update the tab title to match the converted query name
      const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
      const tabManagerStore = useTabManagerStore.getState();

      const updatedTabs = tabManagerStore.openTabs.map((t) =>
        t.id === tab.id ? { ...t, title: updatedQuery.name || queryName } : t
      );

      useTabManagerStore.setState({ openTabs: updatedTabs });
    }
  }

  /**
   * Create a query task with filters
   */
  private static async createQueryTask(
    tab: QueryTab,
    versionId: string,
    overrideFilters?: { where?: string; order_by?: string }
  ): Promise<string> {
    // Get the tab-specific filters
    const { useTableFilterStore } = await import("@/shared/store/useTableFilterStore");
    const filterStore = useTableFilterStore.getState();
    const tabFilters = filterStore.getTabFilterState(tab.id);

    const finalFilters = {
      limit: tabFilters.pageSize,
      offset: tabFilters.currentOffset,
      where: overrideFilters?.where ?? (tabFilters.whereInput.trim() || undefined),
      order_by: overrideFilters?.order_by ?? (tabFilters.orderByInput.trim() || undefined)
    };

    const taskRequest: CreateQueryRunRequest = {
      query_version_id: versionId,
      modifiers: finalFilters
    };

    return await executeQueryVersionTask(taskRequest);
  }

  /**
   * Process and format query results
   */
  private static processResults(results: TableRow[]): TableData {
    if (!results || results.length === 0) {
      return createNoDataMessage();
    }

    return convertToTableData(results);
  }

  /**
   * Refresh query data after successful execution (for compatibility)
   */
  static async refreshQueryData(queryId: string): Promise<void> {
    // Add delay to ensure the run is fully persisted
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { useQueryStore } = await import("@/shared/store/useQueryStore");
    const queryStore = useQueryStore.getState();

    // Force refresh to get the latest runs including the one just created
    await queryStore.loadQueryRuns(queryId, true);

    // Also trigger a reload of query versions to ensure version count is accurate
    await queryStore.loadQueryVersions(queryId);
  }
}
