# Project Structure

## Status

Draft

## Background

The project starts with a Windows desktop notes application, but it should leave room for a future server, shared data types, private knowledge-base features, and mobile clients.

The initial structure should stay simple enough for fast development while avoiding a layout that would make sync, shared types, or cross-platform packaging painful later.

## Goals

- Keep the first implementation focused on the desktop app.
- Use a lightweight monorepo layout.
- Separate Electron main, preload, and renderer code clearly.
- Keep local data access out of the renderer process.
- Leave room for a future server app and shared package.
- Make design documents easy to find before feature work starts.

## Non-Goals

- Do not implement the server in the first structure pass.
- Do not add mobile app folders yet.
- Do not build a plugin system in the first version.
- Do not add complex package publishing workflows.

## Proposed Repository Layout

```text
qiushiNotes/
  AGENTS.md
  家庭服务器与私人云笔记计划书.md
  云笔记项目开发规则.md

  docs/
    designs/
      README.md
      template.md
      community-reference.md
      project-structure.md
      local-database.md
      notebook-tree.md
      rich-text-editor.md
      attachment-storage.md
      full-text-search.md
      sync-engine.md

  apps/
    desktop/
      package.json
      electron.vite.config.ts
      src/
        main/
          index.ts
          app.ts
          window.ts
          ipc/
          db/
            migrations/
          services/
          filesystem/
        preload/
          index.ts
          api.ts
        renderer/
          index.html
          main.ts
          App.vue
          styles/
          components/
          layouts/
          features/
            notes/
            notebooks/
            editor/
            search/
            attachments/
            trash/
          stores/
          composables/
          api/
      resources/
        icons/

    server/
      README.md

  packages/
    shared/
      package.json
      src/
        types/
        schemas/
        constants/

  scripts/

  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .editorconfig
  .gitignore
```

## Package Manager

Use `pnpm` with workspaces.

Required local tool versions:

```text
Node.js >= 22.13.0
pnpm 11.5.3
```

Reasons:

- Good monorepo support.
- Efficient dependency storage.
- Easy filtering by app or package.
- Works well when adding server and shared packages later.

In mainland China network environments, use project-level npm mirror settings:

```text
.npmrc
```

The current project uses npmmirror for npm packages and Electron binaries.

Root scripts should delegate to workspaces:

```json
{
  "scripts": {
    "dev": "pnpm --filter desktop dev",
    "build": "pnpm --filter desktop build",
    "typecheck": "pnpm -r typecheck"
  }
}
```

## Desktop App Boundaries

Electron code is split into three areas.

### Main Process

Location:

```text
apps/desktop/src/main/
```

Responsibilities:

- Create and manage windows.
- Manage application lifecycle.
- Open SQLite database.
- Run database migrations.
- Read and write local files.
- Store attachments.
- Create backups and exports.
- Register IPC handlers.
- Run background sync later.

The main process is the only layer that directly touches SQLite and the filesystem.

### Preload

Location:

```text
apps/desktop/src/preload/
```

Responsibilities:

- Expose a narrow, typed API to the renderer.
- Hide raw IPC channel names from UI code.
- Validate simple input shapes where useful.
- Avoid exposing Node.js primitives directly.

Example shape:

```ts
window.qiushi.notes.create(input)
window.qiushi.notes.update(id, patch)
window.qiushi.notebooks.list()
window.qiushi.attachments.saveFromPaste(input)
window.qiushi.search.query(input)
```

### Renderer

Location:

```text
apps/desktop/src/renderer/
```

Responsibilities:

- Vue application.
- Layouts and components.
- Feature UI.
- UI state stores.
- TipTap editor integration.
- Calls typed preload APIs for data operations.

The renderer must not directly access SQLite, local files, or unrestricted Node.js APIs.

## Feature Layout

Renderer feature folders:

```text
features/
  notes/
  notebooks/
  editor/
  search/
  attachments/
  trash/
```

Main-process services:

```text
services/
  note-service.ts
  notebook-service.ts
  attachment-service.ts
  search-service.ts
  backup-service.ts
```

IPC modules:

```text
ipc/
  notes-ipc.ts
  notebooks-ipc.ts
  attachments-ipc.ts
  search-ipc.ts
```

## Runtime Data Directory

User data must not be stored inside the repository.

Use:

```ts
app.getPath('userData')
```

Expected runtime data layout:

```text
userData/
  notes.db
  attachments/
  backups/
  exports/
```

Use `path.join(...)` for all paths.

## Shared Package

Location:

```text
packages/shared/
```

Purpose:

- Shared TypeScript types.
- Shared constants.
- Shared validation schemas.
- Sync status enums.
- Data transfer object definitions.

Do not put Electron-specific code in `packages/shared`.

## Server Placeholder

Location:

```text
apps/server/
```

The server folder should remain a placeholder until the local desktop app is stable.

The later server will likely contain:

- Sync API.
- Auth.
- PostgreSQL schema.
- Attachment upload/download.
- Backup jobs.
- Knowledge-base indexing.

## Design Documentation Requirement

Before implementing a feature module, create or update its design document under:

```text
docs/designs/
```

The project structure itself is defined by this document.

## Error Handling

The project structure should make failures local:

- Database errors are handled in main-process services.
- Filesystem errors are handled in filesystem or attachment services.
- IPC handlers return typed success or error results.
- Renderer displays user-facing messages and retry options.

## Privacy and Data Safety

- Local notes and attachments stay in the user data directory.
- No cloud or server dependency is introduced in the first version.
- Export and backup folders are explicit.
- Future AI or sync features must not change local-first behavior.

## Test Plan

- Confirm the workspace can install dependencies from the root.
- Confirm desktop dev script can run from the root.
- Confirm TypeScript can be checked across workspaces.
- Confirm renderer cannot import main-process database modules.
- Confirm runtime data is created under `app.getPath('userData')`.

## Open Questions

- Should the shared package use runtime validation with Zod from the start?
- Should database migrations live under `apps/desktop/migrations/` or `apps/desktop/src/main/db/migrations/`?
- Should feature APIs return `{ ok, data, error }` objects or throw typed IPC errors?
