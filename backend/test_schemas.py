from sqlalchemy import inspect

from app.core.database import engine


inspector = inspect(engine)

print("Connected to PostgreSQL successfully!")
print()

tables = inspector.get_table_names()

print("Existing database tables:")
for table in tables:
    print(f"- {table}")

print()

for table in tables:
    print(f"--- {table} ---")

    columns = inspector.get_columns(table)

    for column in columns:
        print(
            f"{column['name']} | "
            f"{column['type']} | "
            f"nullable={column['nullable']}"
        )

    print()