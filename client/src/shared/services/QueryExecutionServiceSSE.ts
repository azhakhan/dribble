import type { CreateQueryRunRequest } from "@/shared/lib/api";
import { executeQueryVersionTask } from "@/shared/lib/api";
import type { QueryTab } from "@/shared/store/types";
import { sseConnectionManager } from "./SSEConnectionManager";

export interface QueryExecutionOptions {
  sql?: string;
  overrideFilters?: { where?: string; order_by?: string };
}

export interface QueryExecutionResult {
  success: boolean;
  queryRunId?: string;
  error?: string;
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
      // Determine what SQL to run
      const queryToRun = options.sql || tab.editorContent;
      if (!queryToRun.trim()) {
        return {
          success: false,
          error: "No SQL to execute"
        };
      }

      // Ensure we have a version ID for execution
      const versionId = await this.ensureQueryVersionExists(tab, queryToRun);
      if (!versionId) {
        return {
          success: false,
          error: "No valid query version ID available. Cannot execute query."
        };
      }

      // Create and start the query task
      const taskId = await this.createQueryTask(tab, versionId, options.overrideFilters);

      // Track the query-task mapping for SSE
      if (tab.queryId) {
        sseConnectionManager.trackQueryTask(tab.queryId, taskId);
      }

      // Ensure SSE connection is established
      sseConnectionManager.connect().catch(console.error);

      // Return immediately with the task ID
      return {
        success: true,
        queryRunId: taskId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Query execution failed: ${errorMessage}`
      };
    }
  }

  /**
   * Ensure a query version exists for execution
   */
  private static async ensureQueryVersionExists(
    tab: QueryTab,
    sql: string
  ): Promise<string | null> {
    try {
      // Import services dynamically to avoid circular dependencies
      const { useQueryStore } = await import("@/shared/store");
      const queryStore = useQueryStore.getState();

      // If we don't have a query ID, create a new ephemeral query
      if (!tab.queryId) {
        const newQuery = await queryStore.createNewQuery({
          sourceId: tab.sourceId
        });

        // Save the SQL as the first version
        const newVersion = await queryStore.saveQueryVersion(newQuery.id, sql, "run");

        // Update tab with the new query and version info
        const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
        const tabManagerStore = useTabManagerStore.getState();
        tabManagerStore.updateTabContent(tab.id, {
          queryId: newQuery.id,
          queryVersionId: newVersion.id,
          isDirty: false,
          lastSavedContent: sql,
          originalContent: sql
        });

        return newVersion.id;
      }

      // Get the latest version to compare against
      const latestVersion = await queryStore.loadLatestQueryVersion(tab.queryId);

      // Check if the editor content differs from the latest saved version
      const shouldSaveNewVersion = !latestVersion || sql.trim() !== latestVersion.sql.trim();

      if (shouldSaveNewVersion) {
        // Save the current editor content as a new version
        const newVersion = await queryStore.saveQueryVersion(tab.queryId, sql, "run");

        // Update tab with new version ID and mark as clean
        const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
        const tabManagerStore = useTabManagerStore.getState();
        tabManagerStore.updateTabContent(tab.id, {
          queryVersionId: newVersion.id,
          isDirty: false,
          lastSavedContent: sql,
          originalContent: sql
        });

        return newVersion.id;
      } else {
        // Content is the same as latest version, use existing version
        return latestVersion.id;
      }
    } catch (error) {
      console.error("Failed to ensure query version:", error);
      return null;
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
}
