/**
 * Generate a random query name with format "Query {6-char-suffix}"
 */
export function generateQueryName(): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `Query ${randomSuffix}`;
}
