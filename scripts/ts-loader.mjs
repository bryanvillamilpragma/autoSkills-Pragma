// Remaps .js imports to .ts when the .js file doesn't exist.
// Node 24+ strips TypeScript types natively but no longer auto-falls back
// from .js to .ts during module resolution. This loader restores that behaviour.
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js')) {
    const tsSpecifier = specifier.slice(0, -3) + '.ts'
    try {
      return await nextResolve(tsSpecifier, context)
    } catch {
      // .ts counterpart not found — fall through to original specifier
    }
  }
  return nextResolve(specifier, context)
}
