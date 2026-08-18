import { parse, type Statement } from "pgsql-ast-parser";

export const AI_READ_ONLY_ERROR_MESSAGE =
  "AI queries are read-only. Use exactly one SELECT, WITH ... SELECT, or EXPLAIN SELECT statement.";

export class AiReadOnlyQueryError extends Error {
  constructor() {
    super(AI_READ_ONLY_ERROR_MESSAGE);
    this.name = "AiReadOnlyQueryError";
  }
}

export class AiReadOnlyQueryCleanupError extends Error {
  constructor(queryError: unknown, cleanupError: unknown) {
    super("The AI query failed and its read-only transaction could not be cleaned up safely.", {
      cause: new AggregateError([queryError, cleanupError]),
    });
    this.name = "AiReadOnlyQueryCleanupError";
  }
}

/**
 * The AST check intentionally narrows the AI tool to SELECT-family statements.
 * PostgreSQL's READ ONLY transaction is still the write-security boundary; this
 * check rejects transaction control, COPY, writable CTEs, and writes to temporary
 * tables before they can exploit operations a read-only transaction may permit.
 */
export function assertAiSelectQuery(sql: string): void {
  const statementSql = explainBody(sql) ?? sql;

  let statements: Statement[];
  try {
    statements = parse(statementSql);
  } catch {
    throw new AiReadOnlyQueryError();
  }

  if (statements.length !== 1 || !isReadOnlySelect(statements[0])) {
    throw new AiReadOnlyQueryError();
  }
}

function isReadOnlySelect(statement: Statement): boolean {
  switch (statement.type) {
    case "select":
    case "values":
      return true;
    case "union":
    case "union all":
      return isReadOnlySelect(statement.left) && isReadOnlySelect(statement.right);
    case "with":
      return (
        statement.bind.every(({ statement: binding }) => isReadOnlySelect(binding)) &&
        isReadOnlySelect(statement.in)
      );
    case "with recursive":
      return isReadOnlySelect(statement.bind) && isReadOnlySelect(statement.in);
    default:
      return false;
  }
}

/** Return the statement wrapped by EXPLAIN, or null when this is not EXPLAIN. */
function explainBody(sql: string): string | null {
  let offset = skipTrivia(sql, 0);
  const first = readWord(sql, offset);
  if (!first || first.word.toLowerCase() !== "explain") return null;
  offset = skipTrivia(sql, first.end);

  if (sql[offset] === "(") {
    offset = skipParenthesizedOptions(sql, offset);
    if (offset < 0) throw new AiReadOnlyQueryError();
    offset = skipTrivia(sql, offset);
  } else {
    // PostgreSQL's legacy spelling is EXPLAIN [ANALYZE] [VERBOSE] statement.
    for (;;) {
      const option = readWord(sql, offset);
      if (!option || !["analyze", "verbose"].includes(option.word.toLowerCase())) break;
      offset = skipTrivia(sql, option.end);
    }
  }

  const body = sql.slice(offset);
  if (!body.trim()) throw new AiReadOnlyQueryError();
  return body;
}

function skipTrivia(sql: string, start: number): number {
  let offset = start;
  for (;;) {
    while (/\s/.test(sql[offset] ?? "")) offset++;
    if (sql.startsWith("--", offset)) {
      const newline = sql.indexOf("\n", offset + 2);
      offset = newline < 0 ? sql.length : newline + 1;
      continue;
    }
    if (sql.startsWith("/*", offset)) {
      let depth = 1;
      offset += 2;
      while (offset < sql.length && depth > 0) {
        if (sql.startsWith("/*", offset)) {
          depth++;
          offset += 2;
        } else if (sql.startsWith("*/", offset)) {
          depth--;
          offset += 2;
        } else {
          offset++;
        }
      }
      continue;
    }
    return offset;
  }
}

function readWord(sql: string, start: number): { word: string; end: number } | null {
  const match = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(sql.slice(start));
  return match ? { word: match[0], end: start + match[0].length } : null;
}

function skipParenthesizedOptions(sql: string, start: number): number {
  let depth = 0;
  for (let offset = start; offset < sql.length; offset++) {
    const char = sql[offset];
    if (char === "'") {
      offset = skipQuoted(sql, offset, "'");
    } else if (char === '"') {
      offset = skipQuoted(sql, offset, '"');
    } else if (sql.startsWith("--", offset)) {
      const newline = sql.indexOf("\n", offset + 2);
      offset = newline < 0 ? sql.length : newline;
    } else if (sql.startsWith("/*", offset)) {
      const afterComment = skipTrivia(sql, offset);
      offset = afterComment - 1;
    } else if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
      if (depth === 0) return offset + 1;
    }
  }
  return -1;
}

function skipQuoted(sql: string, start: number, quote: "'" | '"'): number {
  for (let offset = start + 1; offset < sql.length; offset++) {
    if (sql[offset] !== quote) continue;
    if (sql[offset + 1] === quote) {
      offset++;
      continue;
    }
    return offset;
  }
  return sql.length;
}
