/**
 * Hook for selective subscriptions to prevent unnecessary re-renders
 * This is a simple wrapper around Zustand's built-in selector functionality
 */
export function useSelectiveSubscription<T, U>(
  store: (selector: (state: T) => U, equalityFn?: (a: U, b: U) => boolean) => U,
  selector: (state: T) => U,
  equalityFn?: (a: U, b: U) => boolean
): U {
  return store(selector, equalityFn);
}
