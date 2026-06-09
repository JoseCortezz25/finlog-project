import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import { runMigrations } from "@/main/infrastructure/database/migrations";

export class DatabaseManager {
  private database: Database.Database | null = null;
  private databasePath: string | null = null;

  getConnection(): Database.Database {
    if (this.database) {
      return this.database;
    }

    const userDataPath = app.getPath("userData");
    fs.mkdirSync(userDataPath, { recursive: true });
    const filePath = path.join(userDataPath, "finlog.sqlite");
    const connection = new Database(filePath);
    connection.pragma("foreign_keys = ON");
    connection.pragma("journal_mode = WAL");
    runMigrations(connection);

    this.database = connection;
    this.databasePath = filePath;

    return connection;
  }

  getDatabasePath(): string {
    const connection = this.getConnection();
    void connection;
    if (!this.databasePath) {
      throw new Error("La ruta de la base de datos no esta disponible.");
    }
    return this.databasePath;
  }

  close(): void {
    this.database?.close();
    this.database = null;
  }

  reopen(): Database.Database {
    this.close();
    return this.getConnection();
  }
}

export const databaseManager = new DatabaseManager();
