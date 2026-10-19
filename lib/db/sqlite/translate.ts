/**
 * CloudE5 — SQL dialect bridge for the SQLite data layer.
 *
 * Application queries are written in a portable subset of SQL with PostgreSQL-style `$n`
 * placeholders. This module performs a small, deterministic set of rewrites so the same
 * statements run on SQLite, and converts values in both directions:
 *
 *   $n placeholders            -> positional `?` (repeats re-bound in order)
 *   ::type casts               -> removed (SQLite is dynamically typed)
 *   = ANY($n)                  -> IN (SELECT value FROM json_each($n))  (array bound as JSON)
 *   SELECT ... FOR UPDATE      -> FOR UPDATE removed (writes are serialized by the client lock)
 *   CURRENT_TIMESTAMP / NOW()  -> ISO-8601 UTC text identical to Date#toISOString()
 *   CURRENT_DATE               -> date('now')
 *   INSERT INTO t / UPDATE t / DELETE FROM t -> main.t (writes target base tables; reads go
 *                                 through the tenant policy views, see policies.ts)
 *
 * String literals and quoted identifiers are never rewritten.
 */

export const SQLITE_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

interface Segment {
  text: string;
  isCode: boolean;
}

/** Splits SQL into code and quoted (string literal / quoted identifier) segments. */
function splitQuoted(sql: string): Segment[] {
  const segments: Segment[] = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      if (current) segments.push({ text: current, isCode: true });
      current = "";
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j += 1;
      }
      segments.push({ text: sql.slice(i, j + 1), isCode: false });
      i = j + 1;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current) segments.push({ text: current, isCode: true });
  return segments;
}

const WRITE_TARGET =
  /^(\s*)(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?!main\.|temp\.)([A-Za-z_][A-Za-z0-9_]*)/i;

export interface TranslatedStatement {
  sql: string;
  params: unknown[];
}

/**
 * Rewrites one statement and re-orders parameters to match positional placeholders.
 */
export function translateStatement(
  sql: string,
  params: readonly unknown[] = []
): TranslatedStatement {
  const order: number[] = [];
  const rewritten = splitQuoted(sql)
    .map((segment) => {
      if (!segment.isCode) return segment.text;
      let code = segment.text;
      code = code.replace(
        /=\s*ANY\s*\(\s*(\$\d+)(?:::[A-Za-z_]+(?:\[\])?)?\s*\)/gi,
        "IN (SELECT value FROM json_each($1))"
      );
      code = code.replace(/::[A-Za-z_][A-Za-z0-9_]*(\s*\[\])?/g, "");
      code = code.replace(/\bFOR\s+UPDATE\b/gi, "");
      code = code.replace(/\bCURRENT_TIMESTAMP\b|\bNOW\(\)/gi, `(${SQLITE_NOW})`);
      code = code.replace(/\bCURRENT_DATE\b/gi, "(date('now'))");
      code = code.replace(/\$(\d+)/g, (_m, n: string) => {
        order.push(Number(n) - 1);
        return "?";
      });
      return code;
    })
    .join("")
    .replace(WRITE_TARGET, (_m, lead: string, verb: string, table: string) => `${lead}${verb} main.${table}`)
    .replace(/;\s*$/, "");

  return {
    sql: rewritten,
    params:
      order.length > 0
        ? order.map((index) => toSqliteValue(params[index]))
        : params.map(toSqliteValue),
  };
}

/** Converts a JavaScript parameter into a SQLite-bindable value. */
export function toSqliteValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  if (
    Buffer.isBuffer(value) ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "string"
  ) {
    return value;
  }
  return JSON.stringify(value);
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseTimestamp(value: unknown): unknown {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value)) return value;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /(Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? value : date;
}

function parseDate(value: unknown): unknown {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return parseTimestamp(value);
  const [y, m, d] = value.split("-").map(Number);
  // Matches node-postgres: DATE values become local-midnight Date objects.
  return new Date(y, m - 1, d);
}

export type ColumnKind = "timestamp" | "date" | "boolean" | "json" | "plain";

/** Maps a declared SQLite column type (see migrations/sqlite) to a value kind. */
export function columnKind(declaredType: string | null, columnName: string): ColumnKind {
  const type = (declaredType || "").toUpperCase();
  if (type === "TIMESTAMP_TEXT") return "timestamp";
  if (type === "DATE_TEXT") return "date";
  if (type === "BOOLEAN") return "boolean";
  if (type === "JSON_TEXT") return "json";
  if (!declaredType && /_at$/.test(columnName)) return "timestamp";
  return "plain";
}

/** Converts a raw SQLite value back into the JavaScript type node-postgres would return. */
export function fromSqliteValue(value: unknown, kind: ColumnKind): unknown {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case "timestamp":
      return parseTimestamp(value);
    case "date":
      return parseDate(value);
    case "boolean":
      return value === 1 || value === "1" || value === true;
    case "json":
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

const FORBIDDEN_IN_TENANT_CONTEXT = /\b(main|temp)\s*\.|\b(ATTACH|DETACH|PRAGMA|VACUUM)\b/i;

/**
 * True when a statement explicitly names a schema (main./temp.) or uses connection-level commands.
 * Such statements could address base tables behind the tenant policy views (for example to read
 * masked credential columns) or alter the policy context, so they are refused in tenant contexts.
 */
export function bypassesPolicyLayer(sql: string): boolean {
  return splitQuoted(sql).some((segment) => segment.isCode && FORBIDDEN_IN_TENANT_CONTEXT.test(segment.text));
}
