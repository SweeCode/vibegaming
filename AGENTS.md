AGENTS

Build/lint/test
- Dev: npm run dev (Next.js with Turbopack)
- Build: npm run build (Next.js production build)
- Start: npm run start (serve build)
- Lint: npm run lint (Next.js/ESLint)
- Tests: No test runner configured. If adding Vitest or Jest, document commands here. For a single test, prefer: npx vitest run path/to/file.test.ts --filter "name" or npx jest path/to/file.test.ts -t "name".

Code style
- Language: TypeScript, Next.js App Router, React 19
- Formatting: Use Prettier defaults if added; otherwise follow ESLint (eslint-config-next). Two-space indent, semicolons discouraged per Next default rules.
- Imports: Absolute imports via tsconfig baseUrl if configured; otherwise relative. Group: std/lib, third-party, internal, then local; keep side-effect imports separate.
- Types: Prefer explicit types on public exports; infer locals; use interfaces for object shapes and type for unions. Avoid any/unknown; use generics and readonly where applicable.
- React: Client components only when needed ('use client'); functional components; keep props typed; avoid default exports in shared libs; memoize heavy components/effects.
- Naming: camelCase for variables/functions, PascalCase for components/types/interfaces, SCREAMING_SNAKE_CASE for const enums. File names: PascalCase for React components, camelCase for utilities.
- State/data: Keep server/client boundaries clear; avoid non-serializable props; colocate hooks and UI in src/components; keep game logic in src/game/*.
- Error handling: Throw/return typed errors; use Result-like patterns or narrow with instance checks; handle async with try/catch at boundaries (API/routes, loaders). Avoid swallowing errors; log with context.
- Async: Prefer async/await; never forget awaits; abortable fetch with AbortController in client; debounce/throttle input-sensitive handlers.
- Performance: Avoid re-renders; use useMemo/useCallback selectively; in Phaser code avoid allocations in update loops; recycle objects where possible.
- CSS: Tailwind v4 present; keep styles in globals.css or component-level classes; avoid inline styles except dynamic values.
- Files/conventions: Follow existing folder structure: src/app (Next routes), src/components (UI), src/game (Phaser: scenes, objects, systems, ui). Keep scenes slim; systems manage progression and upgrades.

Copilot/Cursor rules
- No .cursor/ or Copilot instruction files present as of this commit. If added later, mirror key directives here and link to them.
