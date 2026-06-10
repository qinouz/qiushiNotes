import { DatabaseSync } from 'node:sqlite'
import { databaseMigrations } from './migrations'
import { ensureUserDataPaths, type UserDataPaths } from '../filesystem/user-data-paths'

export interface DatabaseContext {
  db: DatabaseSync
  paths: UserDataPaths
}

let databaseContext: DatabaseContext | null = null

export function initializeDatabase(): DatabaseContext {
  const paths = ensureUserDataPaths()
  const db = new DatabaseSync(paths.databasePath)

  // 数据库初始化集中在 main 进程完成，renderer 永远不直接碰 SQLite。
  // 这个边界能保护本地文件，也方便以后把操作统一记入 sync_queue。
  configureDatabase(db)
  runMigrations(db)

  databaseContext = { db, paths }

  return databaseContext
}

export function getDatabaseContext(): DatabaseContext {
  if (!databaseContext) {
    throw new Error('Database has not been initialized.')
  }

  return databaseContext
}

export function closeDatabase(): void {
  databaseContext?.db.close()
  databaseContext = null
}

function configureDatabase(db: DatabaseSync): void {
  db.exec(`
    -- 外键默认可能是关闭的，必须显式开启，避免产生孤儿附件或标签关系。
    PRAGMA foreign_keys = ON;

    -- WAL 更适合桌面应用：读写并发更友好，也为后续后台同步/备份留空间。
    PRAGMA journal_mode = WAL;

    -- 遇到短暂锁等待时先等一会儿，减少自动保存和后台任务互相打断。
    PRAGMA busy_timeout = 5000;
  `)
}

function runMigrations(db: DatabaseSync): void {
  // schema_migrations 是迁移历史，不属于业务数据。
  // 它让应用可以安全重复启动，而不会重复执行已经完成的 schema 变更。
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const appliedRows = db
    .prepare('SELECT id FROM schema_migrations')
    .all() as Array<{ id: string }>
  const appliedMigrationIds = new Set(appliedRows.map((row) => row.id))

  for (const migration of databaseMigrations) {
    if (appliedMigrationIds.has(migration.id)) {
      continue
    }

    // 每个迁移单独开事务。
    // 如果某个迁移失败，必须完整回滚，不能留下半张表或半个索引。
    db.exec('BEGIN')

    try {
      db.exec(migration.sql)
      db.prepare(
        `
          INSERT INTO schema_migrations (id, name, applied_at)
          VALUES (?, ?, ?)
        `
      ).run(migration.id, migration.name, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Failed to apply database migration ${migration.id}: ${migration.name}`, {
        cause: error
      })
    }
  }
}
