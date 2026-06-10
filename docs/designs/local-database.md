# Local Database

## Status

Draft

## Background

The desktop app must work when the home server is offline or unavailable. Local data is the source of truth, so the first real feature module is the local SQLite database.

This module creates and owns the local database file, migrations, base schema, and database access boundary for the Electron main process.

## Goals

- Store notes, notebooks, tags, attachments, settings, and future sync queue data in local SQLite.
- Create the database automatically under Electron `userData`.
- Run schema migrations safely and idempotently.
- Keep database access inside the Electron main process.
- Design records with future server sync in mind.
- Keep all user data exportable and portable.

## Non-Goals

- Do not implement note CRUD UI in this module.
- Do not implement server sync yet.
- Do not implement full-text search yet.
- Do not implement database backup and restore yet.
- Do not expose raw SQL access to the renderer.

## User Workflow

The user does not directly interact with this module.

Expected behavior:

- When the app starts, it creates the local data directory if missing.
- It creates `notes.db` if missing.
- It runs all pending migrations.
- Later feature modules use main-process services to read and write data.

If initialization fails, the app should eventually show a user-facing error and avoid silently losing data. The first implementation can fail fast and log the error during development.

## UI Behavior

No direct UI is required for the first implementation.

Later UI surfaces may include:

- Data location display.
- Manual backup button.
- Export all data.
- Database repair or diagnostics.

## Data Model

The first schema includes these tables:

```text
schema_migrations
notebooks
notes
tags
note_tags
attachments
sync_queue
settings
```

### `schema_migrations`

Tracks applied migrations.

```text
id
name
applied_at
```

### `notebooks`

Stores notebook tree nodes.

```text
id
parent_id
name
sort_order
created_at
updated_at
deleted_at
version
sync_status
```

### `notes`

Stores note content and metadata.

```text
id
notebook_id
title
content
content_format
is_favorite
is_pinned
created_at
updated_at
deleted_at
version
sync_status
```

`content` is text. In the first rich-text version it will likely store TipTap JSON serialized as text. Export modules can convert it to HTML or Markdown later.

### `tags`

Stores tag names.

```text
id
name
created_at
updated_at
deleted_at
version
sync_status
```

### `note_tags`

Stores many-to-many note/tag relationships.

```text
id
note_id
tag_id
created_at
deleted_at
version
sync_status
```

The relationship has its own UUID because note/tag links are syncable records. Active duplicate links are prevented with a partial unique index on `(note_id, tag_id)` where `deleted_at IS NULL`.

### `attachments`

Stores attachment metadata. Attachment binary files are stored in the local attachments directory, not inside SQLite.

```text
id
note_id
file_name
mime_type
size
sha256
relative_path
created_at
deleted_at
version
sync_status
```

### `sync_queue`

Reserved for future background sync.

```text
id
entity_type
entity_id
operation
payload
created_at
attempt_count
last_error
locked_at
```

### `settings`

Stores local settings.

```text
key
value
updated_at
```

## Local Storage

Runtime data must live under:

```text
app.getPath('userData')/
  notes.db
  attachments/
  backups/
  exports/
```

The repository must not contain real user notes, attachments, backups, or exports.

## IPC / API Boundary

The renderer must not access SQLite directly.

Allowed access path:

```text
renderer -> preload typed API -> main IPC handler -> main service -> database
```

This module only creates the database foundation. Feature-specific services will expose typed operations later, such as:

```text
notes.create
notes.update
notebooks.list
attachments.save
search.query
```

## Sync Implications

Even before server sync exists, records include future sync fields:

```text
version
sync_status
deleted_at
```

Rules:

- Use UUID text IDs for syncable user data.
- Use soft deletes through `deleted_at`.
- Preserve local changes while offline.
- Do not design tables that require a server-generated ID.
- Leave room for conflict copies when sync is implemented.

Valid first-version sync statuses:

```text
local
pending
synced
conflicted
```

## Error Handling

Expected failures:

- User data directory cannot be created.
- Database file cannot be opened.
- A migration fails.
- Database is locked or corrupted.

First implementation:

- Throw during startup if initialization fails.
- Log the failing migration name.
- Do not delete or recreate an existing database automatically.

Later improvements:

- Show a clear recovery screen.
- Offer backup before repair.
- Offer export from readable data when possible.

## Privacy and Data Safety

- The database is local by default.
- No database content is sent to a server in the first version.
- Attachments are stored as files so they can be backed up and inspected.
- Deletion is soft by default.
- Future AI features must respect sensitive-note rules before sending content to cloud models.

## Implementation Choice

The first implementation uses the SQLite support available in the Electron main process Node runtime.

Reasoning:

- Avoid native module rebuild complexity during the first skeleton phase.
- Keep SQLite access inside the main process.
- Keep the database layer small enough to replace later if needed.

Possible later replacement:

- `better-sqlite3`, if the built-in SQLite module is insufficient for migrations, backups, performance, or packaging.

## Test Plan

- Typecheck the workspace.
- Build the desktop app.
- Verify Electron can still start after database initialization is added.
- Verify first startup creates the data directories and `notes.db`.
- Verify rerunning startup does not reapply completed migrations.
- Verify foreign keys are enabled.

## Open Questions

- Should note content store TipTap JSON only, or keep a plain-text shadow column for search snippets?
- Should FTS tables be introduced in the first database migration or in the search feature migration?
- Should notebook hierarchy allow one note in multiple notebooks later?
- Should database backup use SQLite online backup APIs or file snapshots while the database is closed?

## Later Improvements

- Add full-text search migration.
- Add backup and restore service.
- Add database diagnostics.
- Add export service.
- Add typed repository classes for each feature module.
