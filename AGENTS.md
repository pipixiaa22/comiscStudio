# Repository Guidelines

## Project Structure & Module Organization

This is an Electron desktop app with a React renderer. `src/` contains the UI: `app/` holds workspace shell components, `features/` groups domain workflows, `store/` holds project state and history, and `shared/` contains cross-feature utilities and bridge code. Reusable Radix/Tailwind primitives live in `src/components/ui/`.

Electron entry points are `main.js` and `preload.js`. Main-process services and IPC registration live under `electron/services/` and `electron/ipc/`. Vite emits production assets to `dist/`; treat it as generated output. Product notes and phased plans are root-level Markdown files.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies (the lockfile is `pnpm-lock.yaml`).
- `pnpm dev` starts the Vite development server for renderer work.
- `pnpm build` produces the renderer bundle in `dist/`.
- `pnpm start` builds the renderer, then launches Electron.

`pnpm test` is currently a placeholder that exits with an error. Add a real test command and colocated or clearly named test files when introducing automated coverage.

## Coding Style & Naming Conventions

Use JavaScript and JSX with the repository’s existing compact style: two-space indentation in Electron services, single quotes, and no unnecessary semicolons. Preserve the surrounding file’s formatting when editing older code. Name React components in `PascalCase` (`VoiceRecorderPanel.jsx`), hooks as `useThing`, and utilities/services in descriptive camelCase files (`projectNormalize.js`, `ExportPlanner.js`). Keep browser-only code in `src/`; expose main-process functionality through the preload bridge and IPC rather than importing Electron APIs into React components.

## Testing Guidelines

Manually exercise changed flows with `pnpm start`, especially project import/save, asset rendering, voice recording, and export. For new tests, cover pure functions in `src/**/model/`, `src/store/`, and `electron/services/`; use behavior-focused names such as `ExportPlanner.test.js`. Do not commit generated `dist/` updates unless the change specifically requires built artifacts.

## Commit & Pull Request Guidelines

Recent commits use short, imperative Chinese summaries (for example, `优化一下代码排版`); follow that concise style and keep each commit focused. Pull requests should explain the user-visible change, list validation performed, link relevant issues or phase notes, and include screenshots or a short recording for UI changes. Call out schema, export-format, or filesystem behavior changes explicitly.
