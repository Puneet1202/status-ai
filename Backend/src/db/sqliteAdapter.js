// FILE: backend/src/db/sqliteAdapter.js
// A thin D1-compatible wrapper around Node's built-in `node:sqlite`, opening a
// SINGLE real database file directly — by default `keyss-status.prod.db`.
//
// WHY: the app code talks to Cloudflare D1's API
// (`db.prepare(sql).bind(...).first()/all()/run()` and `db.batch([...])`). This
// adapter implements exactly that surface on top of node:sqlite, so the SAME
// controllers/tools run unchanged while reading/writing ONE file you can also
// open in a SQLite viewer. No `.wrangler` working copy, no second database.
//
// We deliberately use the ROLLBACK journal (journal_mode=DELETE), NOT WAL: in WAL
// mode fresh rows can sit in a side `-wal` file that simple SQLite viewers don't
// read, making the DB "look empty". Rollback mode keeps EVERYTHING inside the one
// main file, so what the app writes is exactly what you see in the viewer. A
// busy_timeout lets a concurrent viewer read without "database is locked" errors.

import { DatabaseSync } from 'node:sqlite';

// One prepared-statement object per SQL string (node:sqlite caches the compiled
// plan internally; reusing the wrapper avoids re-compiling on every call).
class D1Statement {
    constructor(rawDb, cache, sql) {
        this._raw = rawDb;
        this._cache = cache;
        this._sql = sql;
        this._params = [];
    }

    bind(...params) {
        this._params = params;
        return this;
    }

    _stmt() {
        let s = this._cache.get(this._sql);
        if (!s) {
            s = this._raw.prepare(this._sql);
            this._cache.set(this._sql, s);
        }
        return s;
    }

    // D1: .first() → the first row object, or null.
    async first() {
        const row = this._stmt().get(...this._params);
        return row === undefined ? null : row;
    }

    // D1: .all() → { results: [...] }.
    async all() {
        const results = this._stmt().all(...this._params);
        return { results, success: true };
    }

    // D1: .run() → { meta: { changes, last_row_id } }.
    async run() {
        const info = this._stmt().run(...this._params);
        return {
            success: true,
            meta: {
                changes: Number(info.changes ?? 0),
                last_row_id: Number(info.lastInsertRowid ?? 0),
            },
        };
    }
}

class D1Database {
    constructor(rawDb) {
        this._raw = rawDb;
        this._cache = new Map();
    }

    prepare(sql) {
        return new D1Statement(this._raw, this._cache, sql);
    }

    // D1: .batch([stmt, ...]) — run all in one transaction, return per-stmt results.
    async batch(statements) {
        this._raw.exec('BEGIN');
        try {
            const out = [];
            for (const st of statements) out.push(await st.run());
            this._raw.exec('COMMIT');
            return out;
        } catch (err) {
            try { this._raw.exec('ROLLBACK'); } catch { /* ignore */ }
            throw err;
        }
    }
}

/**
 * Open `filePath` and return a D1-compatible database handle.
 * @param {string} filePath  path to the .db file (default: keyss-status.prod.db)
 */
export function makeSqliteD1(filePath = 'keyss-status.prod.db') {
    const raw = new DatabaseSync(filePath);
    // Keep all data in the single main file (see note above) + tolerate a viewer
    // holding a brief read lock.
    raw.exec('PRAGMA journal_mode = DELETE;');
    raw.exec('PRAGMA busy_timeout = 5000;');
    return new D1Database(raw);
}
