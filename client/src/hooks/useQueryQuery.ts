import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { executeQuery, getQueryResults } from "@/lib/api";
import axios from "axios";

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
  options?: Omit<UseQueryOptions<object[], Error>, "queryKey" | "queryFn">
) {
  return useQuery<object[], Error>({
    queryKey: ["query", database_id, query],
    queryFn: async () => {
      // Step 1: Execute query and get a query ID
      const query_id = await executeQuery(database_id, query);

      // Step 2: Poll for results until we get a final response
      const pollForResults = async (maxAttempts = 100): Promise<object[]> => {
        // Limit the number of attempts to prevent infinite loops
        if (maxAttempts <= 0) {
          throw new Error("Max polling attempts reached");
        }

        try {
          // Try to get the query results
          const response = await getQueryResults(query_id);
          return response; // Success (200 response)
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 202) {
              // Still processing (202 response), wait and try again
              await new Promise((resolve) => setTimeout(resolve, 200));
              return pollForResults(maxAttempts - 1);
            } else if (error.response?.status === 500) {
              // Server error (500 response)
              throw new Error(`Query failed: ${error.response.data?.message || "Server error"}`);
            }
          }
          // Any other error
          throw error;
        }
      };

      // Start polling for results
      return pollForResults();
    },
    enabled: !!database_id && !!query,
    ...options
  });
}
