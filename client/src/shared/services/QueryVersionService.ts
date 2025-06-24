import type { Query, QueryVersion } from "@/shared/lib/api";

export interface QueryVersionOptions {
  sql: string;
  saveTrigger: "run" | "ai";
}

export interface QueryCreationOptions {
  sourceId: string;
  name?: string;
}

export interface QueryVersionResult {
  success: boolean;
  version?: QueryVersion;
  error?: string;
}

export interface QueryCreationResult {
  success: boolean;
  query?: Query;
  error?: string;
}

export class QueryVersionService {
  /**
   * Save a new query version
   */
  static async saveQueryVersion(
    queryId: string,
    options: QueryVersionOptions
  ): Promise<QueryVersionResult> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      const newVersion = await queryStore.saveQueryVersion(
        queryId,
        options.sql,
        options.saveTrigger
      );

      return {
        success: true,
        version: newVersion
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to save query version: ${errorMessage}`
      };
    }
  }

  /**
   * Create a new query
   */
  static async createNewQuery(options: QueryCreationOptions): Promise<QueryCreationResult> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      const newQuery = await queryStore.createNewQuery(options);

      return {
        success: true,
        query: newQuery
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to create query: ${errorMessage}`
      };
    }
  }

  /**
   * Update query name and synchronize across all references
   */
  static async updateQueryName(queryId: string, newName: string): Promise<QueryVersionResult> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");

      const queryStore = useQueryStore.getState();
      const tabManagerStore = useTabManagerStore.getState();

      // Update the query name in the store
      const updatedQuery = await queryStore.updateQueryName(queryId, newName);

      // Update any open tabs that reference this query
      const updatedTabs = tabManagerStore.openTabs.map((tab) =>
        tab.queryId === queryId ? { ...tab, title: updatedQuery.name || newName } : tab
      );

      // Update the tab store with new titles
      useTabManagerStore.setState({ openTabs: updatedTabs });

      return {
        success: true,
        version: undefined // This method doesn't return a version
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to update query name: ${errorMessage}`
      };
    }
  }

  /**
   * Load the latest query version
   */
  static async loadLatestQueryVersion(queryId: string): Promise<QueryVersion | null> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      return await queryStore.loadLatestQueryVersion(queryId);
    } catch (error) {
      console.error(`Failed to load latest version for query ${queryId}:`, error);
      return null;
    }
  }

  /**
   * Check if current SQL differs from the latest saved version
   */
  static async shouldSaveNewVersion(queryId: string, currentSql: string): Promise<boolean> {
    try {
      const latestVersion = await this.loadLatestQueryVersion(queryId);

      if (!latestVersion) {
        return true; // No version exists, should save
      }

      return currentSql.trim() !== latestVersion.sql.trim();
    } catch (error) {
      console.error("Error checking if should save new version:", error);
      return true; // In case of error, err on the side of saving
    }
  }

  /**
   * Save query version if SQL has changed
   */
  static async saveVersionIfChanged(
    queryId: string,
    currentSql: string,
    saveTrigger: "run" | "ai" = "run"
  ): Promise<QueryVersionResult> {
    try {
      const shouldSave = await this.shouldSaveNewVersion(queryId, currentSql);

      if (shouldSave) {
        return await this.saveQueryVersion(queryId, {
          sql: currentSql,
          saveTrigger
        });
      }

      // Return the existing latest version
      const latestVersion = await this.loadLatestQueryVersion(queryId);
      return {
        success: true,
        version: latestVersion || undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to check and save version: ${errorMessage}`
      };
    }
  }

  /**
   * Convert ephemeral query to regular query
   */
  static async convertEphemeralToRegular(
    queryId: string,
    newName: string
  ): Promise<QueryCreationResult> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      const convertedQuery = await queryStore.convertEphemeralToRegular(queryId, newName);

      return {
        success: true,
        query: convertedQuery
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to convert ephemeral query: ${errorMessage}`
      };
    }
  }

  /**
   * Delete query and clean up all references
   */
  static async deleteQuery(queryId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");

      const queryStore = useQueryStore.getState();
      const tabManagerStore = useTabManagerStore.getState();

      // Close any open tabs for this query first
      const tabsToClose = tabManagerStore.openTabs.filter((tab) => tab.queryId === queryId);
      for (const tab of tabsToClose) {
        // Use the TabNavigationService to properly close tabs
        const { TabNavigationService } = await import("./TabNavigationService");
        await TabNavigationService.closeQueryTab(tab.id);
      }

      // Delete the query from the store
      await queryStore.deleteQuery(queryId);

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to delete query: ${errorMessage}`
      };
    }
  }

  /**
   * Load query versions for a given query
   */
  static async loadQueryVersions(queryId: string): Promise<QueryVersion[]> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      await queryStore.loadQueryVersions(queryId);
      return queryStore.queryVersions[queryId] || [];
    } catch (error) {
      console.error(`Failed to load versions for query ${queryId}:`, error);
      return [];
    }
  }

  /**
   * Get or create ephemeral query for table exploration
   */
  static async getOrCreateEphemeralQuery(
    sourceId: string,
    schema: string,
    table: string,
    nodeType: "table" | "view"
  ): Promise<QueryCreationResult> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      const ephemeralQuery = await queryStore.getOrCreateEphemeralQuery(
        sourceId,
        schema,
        table,
        nodeType
      );

      return {
        success: true,
        query: ephemeralQuery
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to get or create ephemeral query: ${errorMessage}`
      };
    }
  }

  /**
   * Update tab content after saving a version
   */
  static async updateTabAfterVersionSave(
    tabId: string,
    version: QueryVersion,
    sql: string
  ): Promise<void> {
    try {
      const { TabNavigationService } = await import("./TabNavigationService");

      // Update the tab's saved content tracking
      await TabNavigationService.updateTabContent(tabId, {
        lastSavedContent: sql,
        isDirty: false, // Mark as clean since we just saved
        queryVersionId: version.id // Ensure we track the version ID
      });

      // If this was a new query, also update the queryId
      if (version.query_id) {
        await TabNavigationService.updateTabContent(tabId, {
          queryId: version.query_id
        });
      }
    } catch (error) {
      console.error("Failed to update tab after version save:", error);
    }
  }

  /**
   * Generate a meaningful name for a converted ephemeral query
   */
  static generateQueryName(tableName?: string): string {
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];

    if (tableName) {
      return `${tableName} query ${dateStr}`;
    } else {
      return `Query ${dateStr}`;
    }
  }

  /**
   * Check if a query is ephemeral and needs conversion
   */
  static async isEphemeralQuery(queryId: string): Promise<boolean> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const queryStore = useQueryStore.getState();

      // Load the query if not already loaded
      if (!queryStore.queries[queryId]) {
        await queryStore.loadQuery(queryId);
      }

      const query = queryStore.queries[queryId];
      return query?.is_ephemeral || false;
    } catch (error) {
      console.error("Failed to check if query is ephemeral:", error);
      return false;
    }
  }
}
