/**
 * Type-safe wrapper for dynamic JSON imports.
 * Consolidates the `as unknown as T` cast into a single documented location.
 */
export async function loadJson<T>(importFn: () => Promise<{ default: unknown }>): Promise<T> {
  const mod = await importFn()
  return mod.default as T
}

/**
 * Same, for multi-MB data files imported as raw strings (`?raw`). Keeps
 * TypeScript from literal-typing giant JSON (which OOMs tsc) — vite ships
 * the file as a string; we parse once at lazy-load time.
 */
export async function loadJsonRaw<T>(importFn: () => Promise<{ default: string }>): Promise<T> {
  const mod = await importFn()
  return JSON.parse(mod.default) as T
}
