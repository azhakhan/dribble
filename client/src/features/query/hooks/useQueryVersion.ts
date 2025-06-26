import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryStore } from "@/shared/store";
import { useTabManagerStore } from "@/shared/store/useTabManagerStore";
import { type QueryVersion } from "@/shared/lib/api";

export function useQueryVersion(queryId: string | undefined, tabId: string) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [userSelectedVersion, setUserSelectedVersion] = useState(false);

  const { queryVersions, loadingVersions, loadQueryVersions } = useQueryStore();
  const { updateTabContent } = useTabManagerStore();

  // Get versions for this query from the store
  const versions = useMemo(
    () => (queryId ? queryVersions[queryId] || [] : []),
    [queryId, queryVersions]
  );

  const isLoadingVersions = queryId ? loadingVersions.has(queryId) : false;

  // Load versions when query changes
  useEffect(() => {
    if (queryId) {
      // Reset state when query changes
      setSelectedVersionId(null);
      setUserSelectedVersion(false);

      // Load fresh data from store (with caching)
      loadQueryVersions(queryId);
    }
  }, [queryId, loadQueryVersions]);

  // Set selected version to latest when versions change
  useEffect(() => {
    if (versions.length > 0) {
      const latestVersionId = versions[0].id;
      // Auto-select the latest version when no version is selected yet
      // OR when the latest version changes and user hasn't manually selected one
      const shouldSelectLatest =
        !selectedVersionId || (!userSelectedVersion && selectedVersionId !== latestVersionId);
      if (shouldSelectLatest) {
        setSelectedVersionId(latestVersionId);
        // Update tab content with the latest version
        updateTabContent(tabId, {
          queryVersionId: latestVersionId,
          editorContent: versions[0].sql
        });
      }
    }
  }, [versions, selectedVersionId, userSelectedVersion, tabId, updateTabContent]);

  // Format version display text
  const formatVersionDisplay = useCallback((version: QueryVersion, index: number) => {
    const shortId = version.id.substring(0, 4);
    const date = new Date(version.created_at);
    const shortDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    const isLatest = index === 0;
    return `${shortId} • ${shortDate}${isLatest ? " (latest)" : ""}`;
  }, []);

  // Handle version change
  const handleVersionChange = useCallback(
    (versionId: string) => {
      setSelectedVersionId(versionId);
      setUserSelectedVersion(true);
      const selectedVersion = versions.find((v) => v.id === versionId);
      if (selectedVersion) {
        updateTabContent(tabId, {
          queryVersionId: versionId,
          editorContent: selectedVersion.sql
        });
      }
    },
    [versions, tabId, updateTabContent]
  );

  // Reset user selection flag (used after query execution)
  const resetUserSelection = useCallback(() => {
    setUserSelectedVersion(false);
  }, []);

  return {
    versions,
    selectedVersionId,
    userSelectedVersion,
    isLoadingVersions,
    formatVersionDisplay,
    handleVersionChange,
    resetUserSelection,
    setSelectedVersionId
  };
}
