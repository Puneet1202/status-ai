// FILE: backend/src/db/mysqlAdapter.js
// KAAM: MariaDB (mysql2) ko Cloudflare D1 jaisa "dikhata" hai, taaki poora app
// (jo `c.env.DB.prepare(sql).bind(...).first()/.all()/.run()` + `.batch()` use
// karta hai) bina badle MariaDB par chal jaye.
//
// D1 API surface jo app use karta hai — yahi yahan emulate kiya hai:
//   db.prepare(sql).bind(...args).first()  -> single row | null
//   db.prepare(sql).bind(...args).all()    -> { results: [...] }
//   db.prepare(sql).bind(...args).run()    -> { success, meta:{ last_row_id, changes } }
//   db.batch([stmt, stmt, ...])            -> ek transaction me sab (atomic)

import mysql from 'mysql2/promise';

let _pool;

export function getPool() {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'statusk_test_2026',
      waitForConnections: true,
      connectionLimit: 10,
      // D1 dates aate the as TEXT; MariaDB DATE/DATETIME ko bhi string hi rakho
      // taaki frontend/JSON behaviour D1 jaisa rahe (no Date objects).
      dateStrings: true,
    });
  }
  return _pool;
}

// Ek prepared-jaisa statement. sql + bound args yaad rakhta hai; .batch() inhi
// ko transaction me chala sake isliye sql/args public rakhe hai.
class Statement {
  constructor(pool, sql) {
    this.pool = pool;
    this.sql = sql;
    this.args = [];
  }
  bind(...args) {
    this.args = args;
    return this;
  }
  async first() {
    const [rows] = await this.pool.query(this.sql, this.args);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  async all() {
    const [rows] = await this.pool.query(this.sql, this.args);
    return { results: Array.isArray(rows) ? rows : [] };
  }
  async run() {
    const [res] = await this.pool.query(this.sql, this.args);
    return {
      success: true,
      meta: {
        last_row_id: res?.insertId ?? null,
        changes: res?.affectedRows ?? 0,
      },
    };
  }
}

// Ye object hi `c.env.DB` ki jagah inject hota hai (server.node.js me).
export function makeD1CompatDB() {
  const pool = getPool();
  return {
    prepare(sql) {
      return new Statement(pool, sql);
    },
    // D1 ka batch atomic hota hai — yahan ek hi connection + transaction me.
    async batch(statements) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const out = [];
        for (const st of statements) {
          const [res] = await conn.query(st.sql, st.args);
          out.push({
            success: true,
            meta: {
              last_row_id: res?.insertId ?? null,
              changes: res?.affectedRows ?? 0,
            },
            results: Array.isArray(res) ? res : [],
          });
        }
        await conn.commit();
        return out;
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },
  };
}
