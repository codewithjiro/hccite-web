export function literatureEmptyState(searched: boolean, loading: boolean, resultCount: number, warningCount: number, requestFailed: boolean) {
  if (!searched || loading || resultCount > 0) return null;
  return requestFailed || warningCount > 0 ? "unavailable" : "no_matches";
}
