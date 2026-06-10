export interface DatabaseMigration {
  id: string
  name: string
  sql: string
}

// 迁移脚本按数组顺序执行。id 一旦发布就不要修改，
// 否则老用户本地数据库会无法判断哪些迁移已经执行过。
export const databaseMigrations: DatabaseMigration[] = [
  {
    id: '001',
    name: 'init-local-database',
    sql: `
      CREATE TABLE IF NOT EXISTS notebooks (
        id TEXT PRIMARY KEY,
        -- parent_id 形成多级笔记本树；删除父级时先保留子级，避免误删用户内容。
        parent_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        -- version/sync_status 现在就保留，是为了后续同步不用推翻本地 schema。
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'local'
          CHECK (sync_status IN ('local', 'pending', 'synced', 'conflicted'))
      );

      CREATE INDEX IF NOT EXISTS idx_notebooks_parent_id
        ON notebooks(parent_id);

      CREATE INDEX IF NOT EXISTS idx_notebooks_deleted_at
        ON notebooks(deleted_at);

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        -- 笔记和笔记本解耦：笔记本删除后，笔记仍可保留并进入未归档状态。
        notebook_id TEXT REFERENCES notebooks(id) ON DELETE SET NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        content_format TEXT NOT NULL DEFAULT 'tiptap-json',
        is_favorite INTEGER NOT NULL DEFAULT 0
          CHECK (is_favorite IN (0, 1)),
        is_pinned INTEGER NOT NULL DEFAULT 0
          CHECK (is_pinned IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'local'
          CHECK (sync_status IN ('local', 'pending', 'synced', 'conflicted'))
      );

      CREATE INDEX IF NOT EXISTS idx_notes_notebook_id
        ON notes(notebook_id);

      CREATE INDEX IF NOT EXISTS idx_notes_updated_at
        ON notes(updated_at);

      CREATE INDEX IF NOT EXISTS idx_notes_deleted_at
        ON notes(deleted_at);

      CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated
        ON notes(is_pinned, updated_at);

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'local'
          CHECK (sync_status IN ('local', 'pending', 'synced', 'conflicted'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_active_name
        ON tags(name)
        WHERE deleted_at IS NULL;

      CREATE TABLE IF NOT EXISTS note_tags (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'local'
          CHECK (sync_status IN ('local', 'pending', 'synced', 'conflicted'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_note_tags_active_pair
        ON note_tags(note_id, tag_id)
        WHERE deleted_at IS NULL;

      CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id
        ON note_tags(tag_id);

      CREATE INDEX IF NOT EXISTS idx_note_tags_deleted_at
        ON note_tags(deleted_at);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        -- 附件文件不存进 SQLite；这里仅保存可迁移的元数据和相对路径。
        note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER NOT NULL DEFAULT 0,
        sha256 TEXT,
        relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        deleted_at TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        sync_status TEXT NOT NULL DEFAULT 'local'
          CHECK (sync_status IN ('local', 'pending', 'synced', 'conflicted'))
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_note_id
        ON attachments(note_id);

      CREATE INDEX IF NOT EXISTS idx_attachments_deleted_at
        ON attachments(deleted_at);

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        -- 第一版暂不实现同步，但先保留队列表，后续本地操作可以自然接入后台上传。
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL
          CHECK (operation IN ('create', 'update', 'delete')),
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        locked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
        ON sync_queue(created_at);

      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
        ON sync_queue(entity_type, entity_id);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  }
]
