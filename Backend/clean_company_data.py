import re

input_file = "statusk_test_2026.sql"
output_file = "company_data_for_puneet_db.sql"

print("⌛ Company file se data nikaalna shuru ho raha hai...")

with open(input_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

output_lines = []

for line in lines:
    # 1. Sirf INSERT INTO waali data rows ko pakdo, baki sab (CREATE TABLE, settings) chhod do
    if line.strip().startswith("INSERT INTO"):
        
        # 2. Table ka naam badlo: daily_status_entries -> timesheets
        line = line.replace("`daily_status_entries`", "timesheets")
        line = line.replace("daily_status_entries", "timesheets")
        
        # 3. Backticks (`) saaf karo jo Cloudflare D1 ko pasand nahi hain
        line = line.replace("`", "")
        
        # 4. Column ka naam badlo: duration_minutes -> duration_hours
        line = line.replace("duration_minutes", "duration_hours")
        
        output_lines.append(line)

with open(output_file, "w", encoding="utf-8") as f:
    f.writelines(output_lines)

print(f"🎯 SUCCESS! Tera pure data ready hai is file mein: {output_file}")
print("👉 Is file mein sirf INSERT queries hain, koi schema nahi hai!")