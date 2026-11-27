/** Merges `patch` into `base`, object by object. Lists are replaced whole. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (Array.isArray(patch)) return patch;
  if (!patch || typeof patch !== "object" || !base || typeof base !== "object") return patch ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out;
}
