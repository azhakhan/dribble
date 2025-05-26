import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { executeQuery, getQueryResults } from "@/lib/api";

/**
 * Custom hook to execute a query against a database and poll for results
 *
 * The flow is:
 * 1. Execute query and get a query_id
 * 2. Poll getQueryResults with the query_id until we get a final response:
 *    - 200: Success with data
 *    - 202: Still processing, continue polling
 *    - 500 or other: Error
 */
export function useQueryQuery(
  database_id: string,
  query: string,
  options?: Omit<UseQueryOptions<object[], Error>, "queryKey" | "queryFn">,
  queryType: "table" | "manual" = "table"
) {
  return useQuery<object[], Error>({
    queryKey: ["query", database_id, query, queryType],
    queryFn: async () => {
      // Step 1: Execute query and get a query ID
      const query_id = await executeQuery(database_id, query);

      // Step 2: Poll for results until we get a final response
      const pollForResults = async (maxAttempts = 50): Promise<object[]> => {
        // Limit the number of attempts to prevent infinite loops
        if (maxAttempts <= 0) {
          throw new Error("Max polling attempts reached");
        }

        const results = await getQueryResults(query_id);

        // Check if results is an array (query completed)
        if (Array.isArray(results)) {
          return results;
        } else {
          // If not an array, we need to keep polling
          await new Promise((resolve) => setTimeout(resolve, 500));
          return pollForResults(maxAttempts - 1);
        }
      };

      // Start polling for results
      return pollForResults();
    },
    ...options
  });
}
