import { memo } from "react";
import { OptimizedTabContent } from "./components/QueryTabs/OptimizedTabContent";

interface QueryProps {
  tabId: string;
}

function QueryComponent({ tabId }: QueryProps) {
  return <OptimizedTabContent tabId={tabId} />;
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render if the tabId changes
export const Query = memo(QueryComponent);
