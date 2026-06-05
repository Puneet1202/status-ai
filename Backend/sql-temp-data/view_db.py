import sqlite3
import webbrowser
import os

conn = sqlite3.connect('keyss-status.prod.db')
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [t[0] for t in cur.fetchall()]

# Build HTML
html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DB Viewer — keyss-status.prod.db</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; }
  h1 { padding: 24px 32px; font-size: 22px; background: #1a1d2e;
       border-bottom: 1px solid #2d3148; color: #7c83f7; letter-spacing: 1px; }
  h1 span { color: #94a3b8; font-size: 14px; font-weight: 400; margin-left: 12px; }
  .sidebar { position: fixed; top: 0; left: 0; width: 220px; height: 100vh;
             background: #1a1d2e; border-right: 1px solid #2d3148; overflow-y: auto;
             padding-top: 70px; }
  .sidebar a { display: block; padding: 9px 20px; color: #94a3b8; text-decoration: none;
               font-size: 13px; border-left: 3px solid transparent; transition: all 0.2s; }
  .sidebar a:hover { color: #7c83f7; border-left-color: #7c83f7; background: #1e2235; }
  .main { margin-left: 220px; padding: 24px 32px; }
  .table-section { margin-bottom: 48px; scroll-margin-top: 20px; }
  .table-name { font-size: 16px; font-weight: 600; color: #7c83f7; margin-bottom: 12px;
                padding: 8px 14px; background: #1a1d2e; border-radius: 8px;
                border-left: 4px solid #7c83f7; display: inline-block; }
  .row-count { color: #64748b; font-size: 12px; margin-left: 8px; }
  .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #2d3148; }
  table { border-collapse: collapse; width: 100%; min-width: 400px; }
  th { background: #1e2235; color: #7c83f7; padding: 10px 14px; text-align: left;
       font-size: 12px; letter-spacing: 0.5px; white-space: nowrap;
       border-bottom: 2px solid #2d3148; }
  td { padding: 9px 14px; font-size: 12px; border-bottom: 1px solid #1e2235;
       color: #cbd5e1; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  tr:hover td { background: #1a1d2e; }
  tr:last-child td { border-bottom: none; }
  .empty { color: #475569; font-size: 13px; padding: 20px; font-style: italic; }
  .null { color: #475569; font-style: italic; }
</style>
</head>
<body>
<h1>🗄️ DB Viewer <span>keyss-status.prod.db</span></h1>
<div class="sidebar">
"""

for t in tables:
    html += f'  <a href="#{t}">{t}</a>\n'

html += "</div>\n<div class='main'>\n"

for t in tables:
    cur.execute(f"SELECT * FROM {t} LIMIT 50")
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description] if cur.description else []
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    total = cur.fetchone()[0]

    html += f'<div class="table-section" id="{t}">\n'
    html += f'<div class="table-name">{t} <span class="row-count">({total} rows)</span></div>\n'

    if not rows:
        html += '<p class="empty">No data found in this table.</p>\n'
    else:
        html += '<div class="table-wrap"><table>\n<tr>'
        for c in cols:
            html += f'<th>{c}</th>'
        html += '</tr>\n'
        for row in rows:
            html += '<tr>'
            for cell in row:
                if cell is None:
                    html += '<td><span class="null">NULL</span></td>'
                else:
                    val = str(cell).replace('<', '&lt;').replace('>', '&gt;')
                    html += f'<td title="{val}">{val}</td>'
            html += '</tr>\n'
        html += '</table></div>\n'
    html += '</div>\n'

html += "</div></body></html>"

conn.close()

# Save and open
out_path = os.path.abspath("db_viewer.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print(f"[OK] HTML file bana diya: {out_path}")
webbrowser.open(f"file:///{out_path}")
print("[OK] Browser mein khul gaya!")
