/**
 * CloudE5 — SQLite query client with a node-postgres compatible surface.
 *
 * Application code keeps using `pool.query(sql, params)` and `pool.connect()` /
 * `client.query("BEGIN;")` / `client.release()`. Underneath:
 *
 * - All statements run on the single process-wide SQLite connection.
 * - An async, re-entrant lock gives each logical unit of work (a single pool.query, or a checked
 *   out client until release()) exclusive use of the connection, so concurrent requests can never
 *   interleave statements inside each other's transactions or tenant policy context.
 *   Re-entrancy is tracked with AsyncLocalStorage: nested units of work started from inside a
 *   locked unit join it, and nested BEGIN/COMMIT/ROLLBACK become SAVEPOINT operations.
 * - Results mirror node-postgres: `{ rows, rowCount }` with Date, boolean and parsed JSON values.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { SqliteDatabase } from "./connection.ts";
import { getDatabase } from "./connection.ts";
import { bypassesPolicyLayer, columnKind, fromSqliteValue, translateStatement } from "./translate.ts";
import { SET_SYSTEM_CONTEXT_SQL } from "./policies.ts";

function inTenantContext(db: SqliteDatabase): boolean {
  const row = db.prepare("SELECT bypass FROM temp._ctx").get() as { bypass: number } | undefined;
  return row?.bypass === 0;
}

/** Every unit of work ends in the system context, whatever a caller left behind. */
function resetContext(db: SqliteDatabase): void {
  db.prepare(SET_SYSTEM_CONTEXT_SQL).run();
}

/**
 * Runs `work` inside the caller's active unit with policy enforcement suspended (the SQLite
 * equivalent of a PostgreSQL SECURITY DEFINER function), restoring the previous context afterwards.
 * Only for operations the calling service has already authorized.
 */
export async function withDefinerRights<T>(work: () => Promise<T>): Promise<T> {
  if (!activeUnit()) {
    throw new Error("Definer rights can only be used inside an active unit of work.");
  }
  const db = getDatabase();
  const previous = (db.prepare("SELECT bypass FROM temp._ctx").get() as { bypass: number }).bypass;
  db.prepare("UPDATE temp._ctx SET bypass = 1").run();
  try {
    return await work();
  } finally {
    db.prepare("UPDATE temp._ctx SET bypass = ?").run(previous);
  }
}

/**
 * Default row type for queries that do not declare one. Rows are plain objects keyed by column
 * name (values converted by declared column type, see translate.ts). This is the one deliberate
 * `any` in the data layer: the existing query sites read columns directly, as they did with
 * node-postgres. New code should pass an explicit Row type, e.g. client.query<{ id: string }>(...).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedRow = any;

export interface QueryResult<Row = UntypedRow> {
  rows: Row[];
  rowCount: number;
}

export interface Queryable {
  query<Row = UntypedRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
}

export interface PoolClient extends Queryable {
  release(error?: unknown): void;
}

export class DatabaseBusyError extends Error {
  constructor() {
    super("The database is busy. Please retry the request.");
    this.name = "DatabaseBusyError";
  }
}

const LOCK_TIMEOUT_MS = 15_000;

/** FIFO async mutex with an acquisition timeout (fails loudly instead of hanging). */
class AsyncMutex {
  private tail: Promise<void> = Promise.resolve();

  acquire(timeoutMs = LOCK_TIMEOUT_MS): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.tail;
    this.tail = previous.then(() => next);

    return new Promise((resolve, reject) => {
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new DatabaseBusyError());
      }, timeoutMs);
      previous.then(() => {
        clearTimeout(timer);
        if (timedOut) {
          // Our turn arrived after the caller gave up: pass the lock on immediately.
          release();
        } else {
          resolve(release);
        }
      });
    });
  }
}

interface UnitOfWork {
  transactionDepth: number;
  /** Set when the unit releases the connection; a finished unit can never be joined again. */
  finished: boolean;
}

/** Returns the caller's active unit of work. Work that outlives its unit (un-awaited promises) fails. */
function activeUnit(): UnitOfWork | undefined {
  const unit = currentUnit.getStore();
  if (unit?.finished) {
    throw new Error("Database work attempted after its unit of work finished (un-awaited promise?).");
  }
  return unit;
}

const mutex = new AsyncMutex();
const currentUnit = new AsyncLocalStorage<UnitOfWork>();

type CachedStatement = import("better-sqlite3").Statement<unknown[], unknown>;
const statementCache = new Map<string, CachedStatement>();
const STATEMENT_CACHE_LIMIT = 500;

function prepare(db: SqliteDatabase, sql: string) {
  let statement = statementCache.get(sql);
  if (!statement) {
    statement = db.prepare<unknown[], unknown>(sql);
    if (statementCache.size >= STATEMENT_CACHE_LIMIT) {
      statementCache.clear();
    }
    statementCache.set(sql, statement);
  }
  return statement;
}

/** Clears cached prepared statements (required after the connection is replaced). */
export function resetStatementCache(): void {
  statementCache.clear();
}

const TRANSACTION_CONTROL = /^\s*(BEGIN|START\s+TRANSACTION|COMMIT|END|ROLLBACK)\b\s*;?\s*$/i;

function runTransactionControl(db: SqliteDatabase, unit: UnitOfWork, command: string): QueryResult {
  const verb = command.trim().replace(/;\s*$/, "").split(/\s+/)[0].toUpperCase();
  if (verb === "BEGIN" || verb === "START") {
    if (unit.transactionDepth === 0) {
      db.exec("BEGIN IMMEDIATE");
    } else {
      db.exec(`SAVEPOINT sp_${unit.transactionDepth}`);
    }
    unit.transactionDepth += 1;
  } else if (verb === "COMMIT" || verb === "END") {
    if (unit.transactionDepth === 0) return { rows: [], rowCount: 0 };
    // The depth only drops once the statement succeeded: a failed COMMIT (e.g. SQLITE_BUSY) leaves
    // the transaction open, and the caller's ROLLBACK must still reach it.
    const depth = unit.transactionDepth - 1;
    db.exec(depth === 0 ? "COMMIT" : `RELEASE sp_${depth}`);
    unit.transactionDepth = depth;
  } else {
    if (unit.transactionDepth === 0) return { rows: [], rowCount: 0 };
    const depth = unit.transactionDepth - 1;
    if (depth === 0) {
      db.exec("ROLLBACK");
    } else {
      db.exec(`ROLLBACK TO sp_${depth}`);
      db.exec(`RELEASE sp_${depth}`);
    }
    unit.transactionDepth = depth;
  }
  return { rows: [], rowCount: 0 };
}

/**
 * Maps SQLite errors onto the PostgreSQL SQLSTATE codes the application already handles
 * (e.g. 23505 unique violation), keeping the original message.
 */
export function normalizeDatabaseError(err: unknown): unknown {
  if (!(err instanceof Error)) return err;
  const sqliteCode = (err as { code?: string }).code ?? "";
  const message = err.message;
  let sqlState: string | undefined;
  if (sqliteCode === "SQLITE_CONSTRAINT_UNIQUE" || sqliteCode === "SQLITE_CONSTRAINT_PRIMARYKEY") sqlState = "23505";
  else if (sqliteCode === "SQLITE_CONSTRAINT_FOREIGNKEY") sqlState = "23503";
  else if (sqliteCode === "SQLITE_CONSTRAINT_NOTNULL") sqlState = "23502";
  else if (sqliteCode === "SQLITE_CONSTRAINT_CHECK") sqlState = "23514";
  else if (/permission denied|row-level security policy/.test(message)) sqlState = "42501";
  else if (/FORENSIC_INTEGRITY_VIOLATION/.test(message)) sqlState = "23505";
  if (sqlState) {
    (err as { code?: string; sqliteCode?: string }).sqliteCode = sqliteCode;
    (err as { code?: string }).code = sqlState;
  }
  return err;
}

/** Executes one statement on the connection. Caller must hold the lock. */
export function executeStatement<Row = UntypedRow>(
  db: SqliteDatabase,
  unit: UnitOfWork,
  sql: string,
  params: readonly unknown[] = []
): QueryResult<Row> {
  try {
    return executeStatementUnchecked<Row>(db, unit, sql, params);
  } catch (err) {
    throw normalizeDatabaseError(err);
  }
}

function executeStatementUnchecked<Row>(
  db: SqliteDatabase,
  unit: UnitOfWork,
  sql: string,
  params: readonly unknown[]
): QueryResult<Row> {
  if (TRANSACTION_CONTROL.test(sql)) {
    return runTransactionControl(db, unit, sql);
  }

  if (inTenantContext(db) && bypassesPolicyLayer(sql)) {
    throw new Error("permission denied: statement addresses the database outside the tenant policy layer");
  }
  const translated = translateStatement(sql, params);
  const statement = prepare(db, translated.sql);

  if (!statement.reader) {
    const info = statement.run(...translated.params);
    return { rows: [], rowCount: info.changes };
  }

  const columns = statement.columns();
  const kinds = columns.map((column) => columnKind(column.type, column.name));
  // PostgreSQL names an unaliased function column after the function (count(*) -> "count").
  const outputNames = columns.map((column) => {
    const fn = /^([A-Za-z_]+)\(.*\)$/.exec(column.name);
    return fn ? fn[1].toLowerCase() : column.name;
  });
  const rawRows = statement.all(...translated.params) as Record<string, unknown>[];
  const rows = rawRows.map((raw) => {
    const row: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      row[outputNames[index]] = fromSqliteValue(raw[column.name], kinds[index]);
    });
    return row as Row;
  });
  return { rows, rowCount: rows.length };
}

/**
 * Runs `work` with exclusive use of the connection. Nested calls from inside a running unit of
 * work re-use it instead of waiting (which would deadlock).
 */
export async function withConnection<T>(work: (db: SqliteDatabase, unit: UnitOfWork) => Promise<T>): Promise<T> {
  const existing = activeUnit();
  const db = getDatabase();
  if (existing) {
    return work(db, existing);
  }
  const release = await mutex.acquire();
  const unit: UnitOfWork = { transactionDepth: 0, finished: false };
  try {
    return await currentUnit.run(unit, () => work(db, unit));
  } finally {
    if (db.inTransaction) {
      // A unit of work must never leave a transaction open on the shared connection, whatever its
      // bookkeeping says (a failed COMMIT or ROLLBACK can leave the two out of step).
      db.exec("ROLLBACK");
    }
    unit.finished = true;
    resetContext(db);
    release();
  }
}

class SqlitePoolClient implements PoolClient {
  private released = false;
  private readonly db: SqliteDatabase;
  private readonly unit: UnitOfWork;
  private readonly onRelease: () => void;

  constructor(db: SqliteDatabase, unit: UnitOfWork, onRelease: () => void) {
    this.db = db;
    this.unit = unit;
    this.onRelease = onRelease;
  }

  async query<Row = UntypedRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>> {
    if (this.released || this.unit.finished) {
      throw new Error("Database client used after release.");
    }
    return currentUnit.run(this.unit, () => executeStatement<Row>(this.db, this.unit, sql, params));
  }

  release(): void {
    if (this.released) return;
    this.released = true;
    this.onRelease();
  }
}

/** node-postgres compatible pool facade over the shared SQLite connection. */
export const pool = {
  async query<Row = UntypedRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<Row>> {
    return withConnection(async (db, unit) => executeStatement<Row>(db, unit, sql, params));
  },

  /**
   * Checks out the connection until release(). Statements issued through the returned client run
   * as one unit of work; an unfinished transaction is rolled back on release.
   */
  async connect(): Promise<PoolClient> {
    const existing = activeUnit();
    const db = getDatabase();
    if (existing) {
      return new SqlitePoolClient(db, existing, () => undefined);
    }
    const releaseLock = await mutex.acquire();
    const unit: UnitOfWork = { transactionDepth: 0, finished: false };
    return new SqlitePoolClient(db, unit, () => {
      if (db.inTransaction) {
        db.exec("ROLLBACK");
      }
      unit.transactionDepth = 0;
      unit.finished = true;
      resetContext(db);
      releaseLock();
    });
  },

  /** No-op kept for API compatibility; the shared connection lives for the process. */
  async end(): Promise<void> {},

  on(_event: string, _listener: (...args: unknown[]) => void) {
    return pool;
  },
};
