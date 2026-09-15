from app.core.database import SessionLocal
from app.recommendation.recommendation_service import generate_recommendations


db = SessionLocal()

try:
    result = generate_recommendations(
        "C0003",
        db
    )

    print("\nRECOMMENDATION TEST:")
    print("Case:", result["case_id"])
    print("Prediction:", result["prediction_id"])
    print("Department:", result["predicted_department_id"])

    for recommendation in result["recommendations"]:
        print(
            recommendation["recommendation_id"],
            "|",
            recommendation["team_id"],
            "| Rank:",
            recommendation["rank"],
            "| Score:",
            recommendation["recommendation_score"]
        )

    db.rollback()

    print("Rollback successful")

except Exception as e:
    db.rollback()

    print("\nTEST FAILED:")
    print(type(e).__name__, ":", e)

finally:
    db.close()