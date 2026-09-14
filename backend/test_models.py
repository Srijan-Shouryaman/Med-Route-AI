from sqlalchemy import inspect

from app.core.database import engine
from app.models import (
    Department,
    ClinicalTeam,
    TeamPerformance,
    Case,
    Prediction,
    Recommendation,
    Assignment,
    AuditLog,
)


models = [
    Department,
    ClinicalTeam,
    TeamPerformance,
    Case,
    Prediction,
    Recommendation,
    Assignment,
    AuditLog,
]

inspector = inspect(engine)

print("========== MEDFLOW AI SCHEMA TEST ==========\n")

all_passed = True

for model in models:
    table_name = model.__tablename__

    db_columns = {
        column["name"]
        for column in inspector.get_columns(table_name)
    }

    model_columns = {
        column.name
        for column in model.__table__.columns
    }

    missing_in_model = db_columns - model_columns
    extra_in_model = model_columns - db_columns

    print(f"Table: {table_name}")

    if not missing_in_model and not extra_in_model:
        print("  ✓ Columns match")
    else:
        all_passed = False

        if missing_in_model:
            print(f"  ✗ Missing in model: {missing_in_model}")

        if extra_in_model:
            print(f"  ✗ Extra in model: {extra_in_model}")

    print()

print("============================================")

if all_passed:
    print("✓ SCHEMA TEST PASSED")
    print("✓ SQLAlchemy models match PostgreSQL columns")
else:
    print("✗ SCHEMA TEST FAILED")
    print("Review the differences above.")