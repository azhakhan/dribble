import { memo } from "react";
import { TabContent } from "./components/QueryTabs/TabContent";

interface QueryProps {
  tabId: string;
}

function QueryComponent({ tabId }: QueryProps) {
  return <TabContent tabId={tabId} />;
}

// Memoize the component to prevent unnecessary re-renders
// Only re-render if the tabId changes
export const Query = memo(QueryComponent);
