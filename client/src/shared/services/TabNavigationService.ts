import type { QueryTab } from "@/shared/store/types";

export interface OpenTabOptions {
  queryId?: string | null;
  queryVersionId?: string | null;
  sourceId: string;
  title: string;
  editorContent?: string;
  isDirty?: boolean;
  isLoadingQuery?: boolean;
  isLoadingVersions?: boolean;
  lastSavedContent?: string;
  originalContent?: string;
  selectedTableData?: { sourceId: string; tableName: string; query: string } | null;
}

export interface TabNavigationResult {
  success: boolean;
  tabId?: string;
  error?: string;
}

export class TabNavigationService {
  /**
   * Open a new query tab
   */
  static async openQueryTab(options: OpenTabOptions): Promise<TabNavigationResult> {
    try {
      const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
      const tabManagerStore = useTabManagerStore.getState();

      const newTabId = crypto.randomUUID();
      const newTab: QueryTab = {
        id: newTabId,
        queryId: options.queryId || null,
        queryVersionId: options.queryVersionId || null,
        sourceId: options.sourceId,
        title: options.title,
        editorContent: options.editorContent || "",
        queryResults: null,
        queryRunning: false,
        queryRunId: null,
        selectedTableData: options.selectedTableData || null,
        isLoadingQuery: options.isLoadingQuery ?? false,
        isLoadingVersions: options.isLoadingVersions ?? false,
        lastSavedContent: options.lastSavedContent || "",
        originalContent: options.originalContent || "",
        isDirty:
          options.isDirty ??
          (options.editorContent || "").trim() !== (options.lastSavedContent || "").trim()
      };

      // Add tab to store
      const currentTabs = tabManagerStore.openTabs;
      useTabManagerStore.setState({
        openTabs: [...currentTabs, newTab],
        activeTabId: newTabId
      });

      // Auto-execute if conditions are met
      if (await this.shouldAutoExecuteQuery(newTab)) {
        await this.executeQueryForTab(newTabId);
      }

      return {
        success: true,
        tabId: newTabId
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to open tab: ${errorMessage}`
      };
    }
  }

  /**
   * Set active tab and handle state synchronization
   */
  static async setActiveTab(tabId: string | null): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const { useTabContentStore } = await import("@/shared/store/useTabContentStore");
    const { useSourceStore } = await import("@/shared/store/useSourceStore");
    const { useQueryStore } = await import("@/shared/store/useQueryStore");

    // Set the active tab immediately for UI responsiveness
    useTabManagerStore.setState({ activeTabId: tabId });

    if (!tabId) return;

    const tabManagerStore = useTabManagerStore.getState();
    const activeTab = tabManagerStore.openTabs.find((tab) => tab.id === tabId);

    if (!activeTab) return;

    const contentStore = useTabContentStore.getState();
    const queryStore = useQueryStore.getState();
    const sourceStore = useSourceStore.getState();

    // Handle tab with query
    if (activeTab.queryId) {
      try {
        // Load query and its source
        await queryStore.loadQuery(activeTab.queryId);
        const query = queryStore.queries[activeTab.queryId];
        const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;

        // Only load latest version from server if tab is not dirty AND
        // the tab doesn't already have a version loaded
        if (!activeTab.isDirty && !activeTab.queryVersionId) {
          const latestVersion = await queryStore.loadLatestQueryVersion(activeTab.queryId);

          // Update the tab with the latest content
          const currentTabs = useTabManagerStore.getState().openTabs;
          useTabManagerStore.setState({
            openTabs: currentTabs.map((tab) =>
              tab.id === tabId
                ? {
                    ...tab,
                    queryVersionId: latestVersion?.id || tab.queryVersionId,
                    editorContent: latestVersion?.sql || tab.editorContent,
                    lastSavedContent: latestVersion?.sql || tab.lastSavedContent,
                    originalContent: latestVersion?.sql || tab.originalContent
                  }
                : tab
            )
          });

          // Update global editorContent for backward compatibility
          contentStore.setEditorContent(latestVersion?.sql || activeTab.editorContent);
        } else {
          // Tab has unsaved changes or already has a version loaded,
          // just update global editorContent without making API calls
          contentStore.setEditorContent(activeTab.editorContent);
        }

        // Set the selected source
        if (querySource) {
          sourceStore.setSelectedSource(querySource);
        }

        // Auto-execute if conditions are met (only if not dirty)
        if (!activeTab.isDirty) {
          const updatedTab = useTabManagerStore.getState().openTabs.find((tab) => tab.id === tabId);
          if (updatedTab && (await this.shouldAutoExecuteQuery(updatedTab))) {
            await this.executeQueryForTab(tabId);
          }
        }
      } catch (error) {
        console.error("Failed to load latest query version when switching tabs:", error);
        // Still set the source even if loading fails
        const query = queryStore.queries[activeTab.queryId];
        const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;
        if (querySource) {
          sourceStore.setSelectedSource(querySource);
        }
        // Update global editorContent with tab content
        contentStore.setEditorContent(activeTab.editorContent);
      }
    } else {
      // For tabs without a queryId, just update the global editorContent
      contentStore.setEditorContent(activeTab.editorContent);

      // Set the source for the tab
      const tabSource = sourceStore.sources[activeTab.sourceId];
      if (tabSource) {
        sourceStore.setSelectedSource(tabSource);
      }

      // Auto-execute if conditions are met for tabs without queryId
      if (await this.shouldAutoExecuteQuery(activeTab)) {
        await this.executeQueryForTab(tabId);
      }
    }
  }

  /**
   * Close a query tab
   */
  static async closeQueryTab(tabId: string): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const tabManagerStore = useTabManagerStore.getState();

    const newOpenTabs = tabManagerStore.openTabs.filter((tab) => tab.id !== tabId);
    const newActiveTabId =
      tabManagerStore.activeTabId === tabId
        ? newOpenTabs.length > 0
          ? newOpenTabs[newOpenTabs.length - 1].id
          : null
        : tabManagerStore.activeTabId;

    useTabManagerStore.setState({
      openTabs: newOpenTabs,
      activeTabId: newActiveTabId
    });
  }

  /**
   * Close a query tab with confirmation if there are unsaved changes
   */
  static async closeQueryTabWithConfirmation(tabId: string): Promise<boolean> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const { useUnsavedChangesStore } = await import("@/shared/store/useUnsavedChangesStore");

    const tabManagerStore = useTabManagerStore.getState();
    const tab = tabManagerStore.openTabs.find((t) => t.id === tabId);

    // Check if tab has unsaved changes
    if (tab && tab.isDirty) {
      // Show unsaved changes dialog
      const unsavedChangesStore = useUnsavedChangesStore.getState();
      const shouldClose = await unsavedChangesStore.showUnsavedChangesDialog(tabId, "close");

      if (!shouldClose) {
        return false;
      }
    }

    await this.closeQueryTab(tabId);
    return true;
  }

  /**
   * Close all tabs with a specific query ID
   */
  static async closeTabsByQueryId(queryId: string): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const tabManagerStore = useTabManagerStore.getState();

    const tabsToClose = tabManagerStore.openTabs.filter((tab) => tab.queryId === queryId);
    const newOpenTabs = tabManagerStore.openTabs.filter((tab) => tab.queryId !== queryId);

    // If the active tab is being closed, set a new active tab
    const isActiveTabClosed = tabsToClose.some((tab) => tab.id === tabManagerStore.activeTabId);
    const newActiveTabId = isActiveTabClosed
      ? newOpenTabs.length > 0
        ? newOpenTabs[newOpenTabs.length - 1].id
        : null
      : tabManagerStore.activeTabId;

    useTabManagerStore.setState({
      openTabs: newOpenTabs,
      activeTabId: newActiveTabId
    });
  }

  /**
   * Update tab title
   */
  static async updateTabTitle(tabId: string, title: string): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const tabManagerStore = useTabManagerStore.getState();

    useTabManagerStore.setState({
      openTabs: tabManagerStore.openTabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab))
    });
  }

  /**
   * Update tab content
   */
  static async updateTabContent(tabId: string, content: Partial<QueryTab>): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const tabManagerStore = useTabManagerStore.getState();

    const updatedTabs = tabManagerStore.openTabs.map((tab) => {
      if (tab.id === tabId) {
        const updatedTab = { ...tab, ...content };

        // If editor content is being updated and isDirty wasn't explicitly provided, calculate it
        if (content.editorContent !== undefined && content.isDirty === undefined) {
          updatedTab.isDirty = content.editorContent.trim() !== (tab.lastSavedContent || "").trim();
        }

        return updatedTab;
      }
      return tab;
    });

    useTabManagerStore.setState({ openTabs: updatedTabs });
  }

  /**
   * Load query in existing tab
   */
  static async loadQueryInTab(tabId: string, queryId: string): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const { useTabContentStore } = await import("@/shared/store/useTabContentStore");
    const { useQueryStore } = await import("@/shared/store/useQueryStore");
    const { useSourceStore } = await import("@/shared/store/useSourceStore");

    const tabManagerStore = useTabManagerStore.getState();
    const tab = tabManagerStore.openTabs.find((t) => t.id === tabId);
    if (!tab) return;

    // Set loading state
    await this.updateTabContent(tabId, { isLoadingQuery: true, isLoadingVersions: true });

    try {
      const queryStore = useQueryStore.getState();
      const sourceStore = useSourceStore.getState();

      // Load query and latest version concurrently
      await queryStore.loadQuery(queryId);
      const query = queryStore.queries[queryId];
      const latestVersion = await queryStore.loadLatestQueryVersion(queryId);

      // Get the source for this query to set as selected source
      const querySource = query?.source_id ? sourceStore.sources[query.source_id] : null;

      // Update tab with loaded data
      await this.updateTabContent(tabId, {
        queryId,
        queryVersionId: latestVersion?.id || null,
        title: query?.name || `Query ${queryId.slice(0, 8)}`,
        editorContent: latestVersion?.sql || "",
        originalContent: latestVersion?.sql || "",
        lastSavedContent: latestVersion?.sql || "",
        isLoadingQuery: false,
        isLoadingVersions: false
      });

      // Update global editorContent if this is the active tab
      if (tabManagerStore.activeTabId === tabId) {
        const contentStore = useTabContentStore.getState();
        contentStore.setEditorContent(latestVersion?.sql || "");
      }

      // Set the query's source as the selected source
      if (querySource) {
        sourceStore.setSelectedSource(querySource);
      }

      // Auto-execute if conditions are met
      const updatedTab = useTabManagerStore.getState().openTabs.find((t) => t.id === tabId);
      if (updatedTab && (await this.shouldAutoExecuteQuery(updatedTab))) {
        await this.executeQueryForTab(tabId);
      }
    } catch (error) {
      console.error("Failed to load query:", error);
      // Reset loading state on error
      await this.updateTabContent(tabId, { isLoadingQuery: false, isLoadingVersions: false });
    }
  }

  /**
   * Initialize runtime states - called on app start to reset runtime states
   */
  static async initializeQueryTabsRuntimeStates(): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const { sseConnectionManager } = await import("@/shared/services/SSEConnectionManager");
    const tabManagerStore = useTabManagerStore.getState();

    useTabManagerStore.setState({
      openTabs: tabManagerStore.openTabs.map((tab) => ({
        ...tab,
        // Reset runtime states to defaults on app load
        queryResults: null,
        queryRunning: false,
        isLoadingQuery: false,
        isLoadingVersions: false
      }))
    });

    // After resetting runtime states, wait for SSE connection and connected sources
    // before checking if active tab should auto-execute
    setTimeout(async () => {
      try {
        // First, establish SSE connection before executing any queries
        await sseConnectionManager.connect();
        console.log("SSE connection established, checking for auto-execution");

        const currentState = useTabManagerStore.getState();
        if (currentState.activeTabId) {
          const activeTab = currentState.openTabs.find(
            (tab) => tab.id === currentState.activeTabId
          );
          if (activeTab && (await this.shouldAutoExecuteQuery(activeTab))) {
            try {
              await this.executeQueryForTab(currentState.activeTabId);
            } catch (error) {
              console.error("Failed to auto-execute query on page reload:", error);
            }
          }
        }
      } catch (error) {
        console.error("Failed to establish SSE connection:", error);
        // Continue without auto-execution if SSE connection fails
      }
    }, 1000); // Increased to 1000ms to give more time for SSE connection
  }

  /**
   * Helper function to determine if a query should auto-execute
   */
  private static async shouldAutoExecuteQuery(tab: QueryTab): Promise<boolean> {
    // Don't auto-execute if query is already running
    if (tab.queryRunning) return false;

    // Don't auto-execute if there are already results
    if (tab.queryResults && tab.queryResults.length > 0) return false;

    // Don't auto-execute if no SQL content
    const sql = tab.editorContent?.trim();
    if (!sql) return false;

    // Check if the source is connected (this would require importing useSourceStore)
    // For now, we'll delegate this check to the calling code
    try {
      const { useSourceStore } = await import("@/shared/store/useSourceStore");
      const sourceStore = useSourceStore.getState();

      if (!sourceStore.connectedSources.has(tab.sourceId)) {
        // During page load, connected sources might not be loaded yet
        if (sourceStore.connectedSourcesData.length > 0) {
          const isConnected = sourceStore.connectedSourcesData.some(
            (source: { id: string }) => source.id === tab.sourceId
          );
          if (!isConnected) return false;
        } else {
          // No connected sources data yet, don't auto-execute
          return false;
        }
      }
    } catch {
      // If we can't check source connection, don't auto-execute
      return false;
    }

    // Check if it's a SELECT query (case-insensitive, allowing for comments and whitespace)
    const cleanSql = sql.replace(/^\/\*[\s\S]*?\*\/|^--.*$/gm, "").trim();
    const isSelectQuery = /^\s*select\s+/i.test(cleanSql);

    return isSelectQuery;
  }

  /**
   * Execute query for a tab (helper method)
   */
  private static async executeQueryForTab(tabId: string): Promise<void> {
    try {
      const { useTabExecutionStore } = await import("@/shared/store/useTabExecutionStore");
      await useTabExecutionStore.getState().executeQuery(tabId);
    } catch (error) {
      console.error("Failed to execute query for tab:", error);
    }
  }

  /**
   * Open query from tree (unified helper)
   */
  static async openQueryFromTree(queryId: string): Promise<void> {
    const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
    const { useQueryStore } = await import("@/shared/store/useQueryStore");

    try {
      const tabManagerStore = useTabManagerStore.getState();
      const queryStore = useQueryStore.getState();

      // Check if this query is already open in a tab
      const existingTab = tabManagerStore.openTabs.find((tab) => tab.queryId === queryId);
      if (existingTab) {
        // Just switch to the existing tab
        await this.setActiveTab(existingTab.id);
        return;
      }

      // Load the query to get its details
      await queryStore.loadQuery(queryId);
      const query = queryStore.queries[queryId];

      if (!query) {
        console.error("Query not found:", queryId);
        return;
      }

      // Load the latest version
      const latestVersion = await queryStore.loadLatestQueryVersion(queryId);

      // Open new tab for this query
      await this.openQueryTab({
        queryId: queryId,
        queryVersionId: latestVersion?.id || null,
        sourceId: query.source_id,
        title: query.name || `Query ${queryId.slice(0, 8)}`,
        editorContent: latestVersion?.sql || "",
        lastSavedContent: latestVersion?.sql || "",
        originalContent: latestVersion?.sql || "",
        isDirty: false
      });
    } catch (error) {
      console.error("Failed to open query from tree:", error);
    }
  }

  /**
   * Open table from tree (unified helper)
   */
  static async openTableFromTree(
    sourceId: string,
    tableName: string,
    nodeType: "table" | "view",
    schemaName?: string
  ): Promise<void> {
    try {
      const { useQueryStore } = await import("@/shared/store/useQueryStore");
      const { useTabManagerStore } = await import("@/shared/store/useTabManagerStore");
      const { useSourceStore } = await import("@/shared/store/useSourceStore");

      const queryStore = useQueryStore.getState();
      const tabManagerStore = useTabManagerStore.getState();
      const sourceStore = useSourceStore.getState();

      // Parse table name and determine schema
      const parts = tableName.split(".");
      let schema: string;
      let table: string;

      if (schemaName) {
        // Use the provided schema name
        schema = schemaName;
        table = parts.length > 1 ? parts[1] : parts[0];
      } else if (parts.length > 1) {
        // Schema was included in table name
        schema = parts[0];
        table = parts[1];
      } else {
        // No schema provided, need to determine default based on database type
        table = parts[0];

        // Get source information to determine database type
        const source = sourceStore.sources[sourceId];

        if (source?.dbtype === "mysql") {
          // MySQL doesn't use schemas in the same way, use the database name as schema
          // For now, we'll use just the table name without schema prefix
          schema = "";
        } else if (source?.dbtype === "sqlite") {
          // SQLite doesn't use schemas, use just table name
          schema = "";
        } else {
          // PostgreSQL and unknown types default to "public"
          schema = "public";
        }
      }

      // Get or create ephemeral query for this table
      const ephemeralQuery = await queryStore.getOrCreateEphemeralQuery(
        sourceId,
        schema,
        table,
        nodeType
      );

      // Load the latest version
      const latestVersion = await queryStore.loadLatestQueryVersion(ephemeralQuery.id);

      // Generate SQL based on whether schema should be included
      const sqlTableRef = schema ? `${schema}.${table}` : table;
      const sql = latestVersion?.sql || `SELECT * FROM ${sqlTableRef} LIMIT 101`;

      // Check if this ephemeral query is already open in a tab
      const existingTab = tabManagerStore.openTabs.find((tab) => tab.queryId === ephemeralQuery.id);

      if (existingTab) {
        // Switch to existing tab and ensure it has the latest SQL
        await this.setActiveTab(existingTab.id);

        // Update the tab content with the latest SQL and ensure it's not dirty
        await this.updateTabContent(existingTab.id, {
          editorContent: sql,
          lastSavedContent: sql,
          originalContent: sql,
          isDirty: false
        });

        // Wait a bit for state to settle before auto-execution
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Auto-execute if conditions are met
        const updatedTab = tabManagerStore.openTabs.find((tab) => tab.id === existingTab.id);
        if (updatedTab && (await this.shouldAutoExecuteQuery(updatedTab))) {
          await this.executeQueryForTab(existingTab.id);
        }
      } else {
        // Create a new tab for this ephemeral query
        await this.openQueryTab({
          queryId: ephemeralQuery.id,
          queryVersionId: latestVersion?.id || null,
          sourceId: sourceId,
          title: schema ? `${schema}.${table}` : table,
          editorContent: sql,
          lastSavedContent: sql,
          originalContent: sql,
          selectedTableData: {
            sourceId,
            tableName,
            query: sql
          },
          isDirty: false
        });
      }
    } catch (error) {
      console.error("Failed to open table from tree:", error);

      // Fallback to simple query - auto-execution will handle running
      const query = `SELECT * FROM ${tableName} LIMIT 101`;
      await this.openQueryTab({
        queryId: null,
        queryVersionId: null,
        sourceId,
        title: tableName,
        editorContent: query,
        lastSavedContent: "",
        originalContent: "",
        selectedTableData: { sourceId, tableName, query },
        isDirty: false
      });
    }
  }
}
