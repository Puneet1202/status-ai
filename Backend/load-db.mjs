// load-db.mjs — Loads full_setup_tidb.sql (24 tables + data) into your TiDB Cloud
// database in ONE go. Reliable: the server parses the SQL, so semicolons inside
// data, big size, zero-dates, etc. are all handled.
//
// HOW TO RUN (from the `backend` folder):
//   1) npm install mysql2
//   2) Fill the 4 values below from TiDB Cloud → your cluster → "Connect" button.
//   3) node load-db.mjs
//
// Delete this file afterwards if you like — it's a one-off loader.

import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

// ⬇️⬇️⬇️  FILL THESE 4 FROM TiDB "Connect"  ⬇️⬇️⬇️
const HOST     = 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com';      // e.g. gateway01.ap-southeast-1.prod.aws.tidbcloud.com
const USER     = '21KafatzWdTQyMt.root';      // e.g. 2xAbCd1234XyZ.root
const PASSWORD = '5wDGfqlHJ9unBWjg';  // the password you set/generated
const PORT     = 4000;                   // TiDB default — usually leave as is
// ⬆️⬆️⬆️  ----------------------------------  ⬆️⬆️⬆️

const sqlPath = new URL('./full_setup_tidb.sql', import.meta.url);
const sql = readFileSync(sqlPath, 'utf8');

let conn;
try {
  console.log('🔌 Connecting to TiDB...');
  conn = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'test',                 // initial DB; the SQL creates/uses keyss_hr itself
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, // TiDB requires TLS
    multipleStatements: true,         // lets one query run the whole file
  });

  console.log('📥 Loading schema + data (this can take 10-30 seconds)...');
  await conn.query(sql);

  const [tables] = await conn.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'keyss_hr'"
  );
  const [emp] = await conn.query('SELECT COUNT(*) AS n FROM keyss_hr.employee');
  const [usr] = await conn.query('SELECT COUNT(*) AS n FROM keyss_hr.users');

  console.log('\n✅ DONE!');
  console.log(`   Tables created : ${tables[0].n}`);
  console.log(`   Employees      : ${emp[0].n}`);
  console.log(`   Users          : ${usr[0].n}`);
} catch (err) {
  console.error('\n❌ Failed:', err.code || '', err.sqlMessage || err.message);
  console.error('   Tip: double-check HOST / USER / PASSWORD from the "Connect" button.');
  process.exitCode = 1;
} finally {
  if (conn) await conn.end();
}
