#!/usr/bin/env python3
"""
dump_prod_db.py
===============
Generate a D1-import-ready SQL dump from `keyss-status.prod.db`.

WHY: D1 cannot load a binary `.db` file directly. To push prod data to a REMOTE
D1 you need a `.sql` text dump. This script produces one. (For LOCAL dev you can
usually just file-swap the .db — see the guide — but this dump also works local.)

Windows note: sqlite3 CLI is NOT installed on this machine, so we use Python's
built-in `sqlite3` module (no pip install needed).

RUN (from the Backend/ folder):
    python docs/dump_prod_db.py

OUTPUT:
    docs/prod_dump.sql   (schema + data, idempotent via DROP TABLE IF EXISTS)

THEN load into D1:
    LOCAL : npx wrangler d1 execute keyss-timesheet-db --local  --file=docs/prod_dump.sql
    REMOTE: npx wrangler d1 import  keyss-timesheet-db --remote --file=docs/prod_dump.sql
"""

import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "keyss-status.prod.db")
OUT = os.path.join(HERE, "prod_dump.sql")

# Tables we deliberately leave OUT of the dump:
#   d1_migrations  -> D1's own migration ledger; let the live D1 manage its own.
#   sqlite_sequence-> AUTOINCREMENT counters; SQLite rebuilds these as needed.
SKIP = ("d1_migrations", "sqlite_sequence")


def is_skipped(stmt: str) -> bool:
    s = stmt.lstrip()
    for t in SKIP:
        if s.startswith('CREATE TABLE "%s"' % t) or s.startswith("CREATE TABLE %s" % t):
            return True
        if s.startswith('INSERT INTO "%s"' % t) or s.startswith("INSERT INTO %s" % t):
            return True
        if s.startswith('DELETE FROM "%s"' % t) or s.startswith("DELETE FROM %s" % t):
            return True
    return False


def main() -> None:
    if not os.path.exists(SRC):
        raise SystemExit("ERROR: %s not found. Run this from the Backend/ folder." % SRC)

    con = sqlite3.connect(SRC)
    cur = con.cursor()

    # Real tables in creation order (rowid order of sqlite_master ~= dependency order).
    cur.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid"
    )
    tables = [r[0] for r in cur.fetchall() if r[0] not in SKIP]

    n = 0
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("-- D1 import dump generated from keyss-status.prod.db\n")
        f.write("-- LOAD LOCAL : npx wrangler d1 execute keyss-timesheet-db --local  --file=docs/prod_dump.sql\n")
        f.write("-- LOAD REMOTE: npx wrangler d1 import  keyss-timesheet-db --remote --file=docs/prod_dump.sql\n\n")

        # Phase 1 — drop existing tables in REVERSE creation order (FK-safe even
        # if foreign keys are enforced), so re-imports never fail on "exists".
        for t in reversed(tables):
            f.write('DROP TABLE IF EXISTS "%s";\n' % t)
        f.write("\n")

        # Phase 2 — schema + data in creation order. iterdump() emits parents
        # before children, so FK references resolve cleanly.
        for stmt in con.iterdump():
            s = stmt.strip()
            if s in ("BEGIN TRANSACTION;", "COMMIT;"):
                continue  # let wrangler manage its own transaction batching
            if is_skipped(stmt):
                continue
            f.write(stmt + "\n")
            n += 1

    con.close()
    print("Wrote %s  (%d schema+data statements, %d tables)" % (OUT, n, len(tables)))


if __name__ == "__main__":
    main()
