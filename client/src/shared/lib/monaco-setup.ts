import { LanguageIdEnum } from "monaco-sql-languages";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import PGSQLWorker from "monaco-sql-languages/esm/languages/pgsql/pgsql.worker?worker";
import MySQLWorker from "monaco-sql-languages/esm/languages/mysql/mysql.worker?worker";

// Import language contributions directly
import "monaco-sql-languages/esm/languages/mysql/mysql.contribution";
import "monaco-sql-languages/esm/languages/pgsql/pgsql.contribution";

// Setup Monaco Environment for workers
(globalThis as typeof globalThis & { MonacoEnvironment?: unknown }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === LanguageIdEnum.PG) {
      return new PGSQLWorker();
    }
    if (label === LanguageIdEnum.MYSQL) {
      return new MySQLWorker();
    }
    return new EditorWorker();
  }
};

// Export language IDs for use in components
export { LanguageIdEnum };

// Export a function to get available SQL dialects
export const getAvailableSQLDialects = () => [
  { label: "MySQL", value: LanguageIdEnum.MYSQL },
  { label: "PostgreSQL", value: LanguageIdEnum.PG }
];
