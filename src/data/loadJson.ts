/**
 * Type-safe wrapper for dynamic JSON imports.
 * Consolidates the `as unknown as T` cast into a single documented location.
 */
export async function loadJson<T>(importFn: () => Promise<{ default: unknown }>): Promise<T> {
  const mod = await importFn()
  return mod.default as T
}
