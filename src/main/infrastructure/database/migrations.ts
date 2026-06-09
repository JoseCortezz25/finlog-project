import type Database from "better-sqlite3";
import migration001InitialSchema from "@/main/infrastructure/database/migrations/001_initial_schema.sql?raw";

interface MigrationEntry {
  sql: string;
  version: string;
}

export function runMigrations(database: Database.Database) {
  database.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );

  const appliedVersions = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row: unknown) => String((row as { version: string }).version))
  );

  const migrations: MigrationEntry[] = [
    {
      sql: migration001InitialSchema,
      version: "001",
    },
  ];

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const transaction = database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        )
        .run(migration.version, new Date().toISOString());
    });

    transaction();
  }
}
