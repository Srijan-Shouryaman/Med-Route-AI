from sqlalchemy import text

from app.core.database import engine


with engine.connect() as connection:

    result = connection.execute(
        text("SELECT COUNT(*) FROM departments")
    )

    department_count = result.scalar()

    print("Database query successful!")
    print("Departments:", department_count)