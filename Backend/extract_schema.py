import re

def extract_tables_from_sql(input_file, output_file):
    try:
        # File ko read mode mein open karo
        with open(input_file, 'r', encoding='utf-8') as file:
            sql_content = file.read()

        # Regex pattern: 'CREATE TABLE' se start hoke pehle ';' tak match karega
        # re.IGNORECASE: case-insensitive match ke liye
        # re.DOTALL: multiline string mein newline character ko bhi capture karne ke liye
        pattern = re.compile(r'(CREATE\s+TABLE\s+.*?;)', re.IGNORECASE | re.DOTALL)

        # File mein se saare matches find karo
        tables = pattern.findall(sql_content)

        # Sirf extracted tables ko nayi file mein write karo
        with open(output_file, 'w', encoding='utf-8') as out_file:
            for i, table in enumerate(tables, 1):
                out_file.write(f"-- TABLE {i} =========================================\n")
                out_file.write(table + "\n\n")

        print(f"Success! Total {len(tables)} tables extract ho gaye hain.")
        print(f"Clean schema '{output_file}' mein save ho gaya hai.")

    except Exception as e:
        print(f"Script execution mein error aaya: {e}")

# Yahan apni actual file ka exact path daalo
input_sql_file = 'compnay_schema_Data_.sql' # Screenshot ke hisaab se tumhari file
output_sql_file = 'extracted_tables_only.sql'

# Function call
extract_tables_from_sql(input_sql_file, output_sql_file)