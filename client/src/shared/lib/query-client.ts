import { QueryClient } from "@tanstack/react-query";

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      staleTime: 1000 * 60 * 5 // 5 minutes
    }
  }
});
