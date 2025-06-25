import type { CreateQueryRunRequest } from "@/shared/lib/api";
import { executeQueryVersionRun, getQueryRunResults } from "@/shared/lib/api";
import type { QueryTab } from "@/shared/store/types";
import type { TableData } from "@/shared/types/api";
import { convertToTableData } from "@/shared/utils/typeUtils";
import { createNoDataMessage } from "@/shared/utils/errorUtils";

export interface QueryExecutionOptions {
  sql?: string;
  overrideFilters?: { where?: string; order_by?: string };
}

export interface QueryExecutionResult {
  success: boolean;
  results?: TableData;
  error?: string;
}

export class QueryExecutionService {
  private static readonly POLLING_INTERVAL = 500;
  private static readonly MAX_POLLING_ATTEMPTS = 50;

  /**
   * Execute a query for a given tab
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

      // Step 2: Prepare and execute the query run
      const runId = await this.createQueryRun(tab, versionId, options.overrideFilters);

      // Step 3: Poll for results
      const results = await this.pollForResults(runId);

      // Step 4: Process and format results
      const processedResults = this.processResults(results);

      return {
        success: true,
        results: processedResults
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
   * Create a query run with filters
   */
  private static async createQueryRun(
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

    const runRequest: CreateQueryRunRequest = {
      query_version_id: versionId,
      modifiers: finalFilters
    };

    return await executeQueryVersionRun(runRequest);
  }

  /**
   * Poll for query results until completion
   */
  private static async pollForResults(runId: string): Promise<TableData> {
    const pollOnce = async (maxAttempts: number): Promise<TableData> => {
      if (maxAttempts <= 0) {
        throw new Error("Max polling attempts reached - query may still be running");
      }

      try {
        const results = await getQueryRunResults(runId);

        // Check if results is an array (query completed successfully)
        if (Array.isArray(results)) {
          return results;
        } else {
          // If not an array, we need to keep polling
          await new Promise((resolve) => setTimeout(resolve, this.POLLING_INTERVAL));
          return pollOnce(maxAttempts - 1);
        }
      } catch (error) {
        console.error("Error during polling:", error);
        throw error;
      }
    };

    return pollOnce(this.MAX_POLLING_ATTEMPTS);
  }

  /**
   * Process and format query results
   */
  private static processResults(results: TableData): TableData {
    if (!Array.isArray(results)) {
      return convertToTableData(results);
    }
    return results.length > 0 ? results : createNoDataMessage("Query returned no data");
  }

  /**
   * Refresh query runs and versions after successful execution
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
