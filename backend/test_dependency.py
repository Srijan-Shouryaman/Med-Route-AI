from app.api.dependencies import get_db


db_generator = get_db()

db = next(db_generator)

try:
    print("Database session created successfully!")
    print("Session:", db)

finally:
    db.close()
    print("Database session closed successfully!")