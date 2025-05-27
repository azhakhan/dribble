import { useMutation, useQueryClient } from "@tanstack/react-query";
import { connectSource } from "@/lib/api";

export function useConnectSourceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => connectSource(sourceId),
    onSuccess: () => {
      // Invalidate the sources query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    }
  });
}
