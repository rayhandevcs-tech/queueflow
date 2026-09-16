/**
 * A no-op stand-in for the `server-only` package, used by vitest alone.
 *
 * `server-only` works by throwing the moment it is imported outside a React
 * Server Component, which is exactly the protection we want in the build: an
 * AI tool module reaching a browser bundle should fail `next build`, not be
 * noticed in review. But vitest is neither a server nor a client component, so
 * it trips the same guard and the AI modules cannot be imported at all.
 *
 * Aliasing it here keeps both properties. The source files still say
 * `import "server-only"`, so Next still enforces the boundary for real; the
 * test runner just gets an empty module instead of a thrown error.
 *
 * This is why the stub lives under `src/test/` rather than anywhere importable
 * by application code — nothing but `vitest.config.ts` should ever point at it.
 */
export {};
