import { useState } from "react";
import { submitTaskAndWait, type TaskResult } from "@/shared/lib/taskUtils";

interface UseTaskSubmissionOptions {
  onSuccess?: (result: unknown) => void;
  onError?: (error: string) => void;
}

export function useTaskSubmission<T = unknown>(options: UseTaskSubmissionOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (endpoint: string, data: unknown): Promise<TaskResult<T> | null> => {
    try {
      setLoading(true);
      setError(null);

      const result = await submitTaskAndWait<T>(endpoint, data);

      if (result.status === "success") {
        options.onSuccess?.(result.result);
      } else {
        const errorMessage = result.error || "Task failed";
        setError(errorMessage);
        options.onError?.(errorMessage);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
  };

  return {
    submit,
    loading,
    error,
    reset
  };
}
