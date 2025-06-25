import type { SQLBlock } from "./types";

// Utility function to extract SQL code blocks from a message
export const extractSQLBlocks = (content: string): SQLBlock[] => {
  const regex = /```sql\n([\s\S]*?)```/g;
  const blocks: SQLBlock[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      sql: match[1],
      index: match.index
    });
  }

  return blocks;
};

// Function to format session date
export const formatSessionDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
};
