# AGENTS.md

## Project

This repository is for a private cloud notes application.

The product should be built as a local-first personal notes system:

- Windows desktop first.
- Offline usage must work.
- Local data is the source of truth.
- The server is for sync, backup, device recovery, and future knowledge-base features.
- All user data must be exportable and portable.

Do not treat the first version as a full clone of Youdao Cloud Notes. Use Youdao Cloud Notes only as a reference for common note-taking workflows.

## Product Priorities

Build the first version as a stable local desktop app before adding cloud sync.

Required first-version capabilities:

- Create, edit, and delete notes.
- Auto-save notes locally.
- Multi-level notebooks.
- Rich text editing.
- Image paste support.
- Local attachment storage.
- Full-text search.
- Trash and restore.
- Local backup.
- Data import and export.

Defer these until the local app is stable:

- Mobile apps.
- Collaboration.
- Complex permissions.
- AI Q&A.
- Template marketplace.
- Server sync.
- Full feature parity with Youdao Cloud Notes.

## Design Documentation Rule

Before implementing a major feature area or changing first-version scope, create or update the relevant PRD first.

PRD documents live under:

```text
docs/prd/zh-CN/
```

The first-version PRD is:

```text
docs/prd/zh-CN/v1-local-first-desktop.md
```

Before implementing any feature module, create or update a design document first.

Design documents live under:

```text
docs/designs/zh-CN/
```

Use one document per feature module. Examples:

```text
docs/designs/zh-CN/local-database.md
docs/designs/zh-CN/notebook-tree.md
docs/designs/zh-CN/rich-text-editor.md
docs/designs/zh-CN/attachment-storage.md
docs/designs/zh-CN/full-text-search.md
docs/designs/zh-CN/sync-engine.md
```

Each design document should explain:

- What problem the feature solves.
- Goals and non-goals.
- User workflow.
- UI behavior.
- Data model.
- Local storage behavior.
- IPC or API boundaries.
- Sync implications, even if sync is not implemented yet.
- Error handling and edge cases.
- Privacy and data safety considerations.
- Test and verification plan.
- Open questions or later improvements.

Implementation should follow the approved design document. If coding reveals that the design is wrong or incomplete, update the design document before or alongside the code change.

Small bug fixes do not need a new design document, but they should update an existing design document when they change feature behavior.

Design documents should be written in Chinese by default. English documents may exist as references, but Chinese documents are the primary source for future project maintenance.

## Code Comment Rule

Use comments more generously than a minimal library project would, because this is a long-term personal project.

Comments should explain:

- Why a module boundary exists.
- Why local-first behavior is protected.
- Why sync-related fields are kept before sync exists.
- Why a migration or data model choice was made.
- Any edge case that future maintenance might miss.

Avoid comments that only repeat the code literally.

## Technical Direction

Preferred desktop stack:

- Electron.
- Vue 3.
- TypeScript.
- SQLite.
- TipTap.
- Vite.

Recommended Electron version for the first implementation:

```json
{
  "devDependencies": {
    "electron": "41.7.2"
  }
}
```

Keep Electron pinned. Do not use a caret range for Electron until the project has a stable upgrade process.

## Local-First Rules

- Never require the server for local editing, reading, creating, deleting, or searching notes.
- Write all user operations to local SQLite first.
- Store images and attachments locally before any upload attempt.
- Use soft deletes instead of physical deletes.
- Preserve conflict copies instead of overwriting user data.
- Keep sync-related fields in local records even before sync is implemented.
- Design exports so the user can move data away from the app.

## Cross-Platform Rules

The first target is Windows, but code should be written so macOS support remains practical.

- Do not hard-code Windows paths.
- Use `path.join(...)` for filesystem paths.
- Use `app.getPath('userData')` for app data.
- Use `process.platform` for platform-specific behavior.
- Use `CommandOrControl` for shortcuts.
- Keep macOS menu and window-close behavior isolated for later adaptation.

## Data Model Expectations

Expected local data directory:

```text
userData/
  notes.db
  attachments/
  backups/
  exports/
```

Expected core tables:

```text
notes
notebooks
tags
note_tags
attachments
sync_queue
settings
```

Notes should include fields suitable for future sync:

```text
id
title
content
notebook_id
created_at
updated_at
deleted_at
version
sync_status
```

Use UUIDs for user data records that may sync later.

## UI Direction

Prefer a quiet, practical productivity interface.

Use the standard notes layout unless there is a strong reason not to:

```text
Left: notebook tree
Middle: note list
Right: editor
```

Prioritize:

1. Fast startup.
2. Reliable editing.
3. Reliable auto-save.
4. Fast search.
5. Data safety.
6. Correct sync.
7. Visual polish.

Avoid decorative UI, complex animation, and non-core features in the first version.

## Agent Workflow Guidance

This repository includes project-specific agent workflow guidance under:

```text
docs/agent-guidance/zh-CN/
```

Use these files selectively. Do not load every workflow or persona by default.

Available workflow files:

- `docs/agent-guidance/zh-CN/skills/spec-driven-development.md`
- `docs/agent-guidance/zh-CN/skills/doubt-driven-development.md`
- `docs/agent-guidance/zh-CN/skills/security-and-hardening.md`
- `docs/agent-guidance/zh-CN/skills/test-driven-development.md`
- `docs/agent-guidance/zh-CN/skills/code-review-and-quality.md`
- `docs/agent-guidance/zh-CN/skills/source-driven-development.md`

Available persona files:

- `docs/agent-guidance/zh-CN/personas/code-reviewer.md`
- `docs/agent-guidance/zh-CN/personas/test-engineer.md`
- `docs/agent-guidance/zh-CN/personas/security-auditor.md`
- `docs/agent-guidance/zh-CN/personas/web-performance-auditor.md`

Default trigger rules:

- For any non-trivial feature module, read `spec-driven-development.md` before coding and update the relevant Chinese design document in `docs/designs/zh-CN/`.
- For changes involving framework APIs, Electron, Vue, TipTap, SQLite, Vite, or dependency behavior, read `source-driven-development.md` and verify claims against local versions and official sources.
- For changes involving local data, SQLite migrations, soft delete, restore, import/export, backup, attachments, file paths, IPC boundaries, or sync-related fields, read `doubt-driven-development.md` and `security-and-hardening.md`.
- When adding or changing behavior, read `test-driven-development.md` and add tests or explicit verification steps proportional to the risk.
- Before finishing a substantial change, use `code-review-and-quality.md` or the `code-reviewer.md` persona for a final self-review.
- For renderer performance, startup speed, long lists, search responsiveness, or measured Web performance work, use `web-performance-auditor.md`. If no measurement artifact exists, report only source-level potential impact and do not invent metrics.

## Reference

The longer human-readable planning document is:

- `家庭服务器与私人云笔记计划书.md`
- `云笔记项目开发规则.md`
- `docs/designs/zh-CN/`
