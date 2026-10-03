import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

function applyMigrations(database, migrationsDirectory) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const appliedStatement = database.prepare(
    "SELECT 1 FROM schema_migrations WHERE version = ?"
  );
  const recordStatement = database.prepare(
    "INSERT INTO schema_migrations (version) VALUES (?)"
  );
  const migrationFiles = readdirSync(migrationsDirectory)
    .filter((file) => /^\d+.*\.sql$/u.test(file))
    .sort();

  for (const migrationFile of migrationFiles) {
    if (appliedStatement.get(migrationFile)) continue;

    const sql = readFileSync(join(migrationsDirectory, migrationFile), "utf8");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(sql);
      recordStatement.run(migrationFile);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(`Could not apply database migration ${migrationFile}.`, {
        cause: error
      });
    }
  }
}

export function openDatabase(databasePath, migrationsDirectory) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA busy_timeout = 5000");
  applyMigrations(database, migrationsDirectory);
  database.exec("PRAGMA optimize");

  return database;
}
