    print("\nFULL RECOMMENDATION TEST:")

    try:
        result = generate_recommendations("C0001", db)

        print("Case:", result["case_id"])
        print("Prediction:", result["prediction_id"])
        print("Department:", result["predicted_department_id"])

        print("\nSaved recommendations:")

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
        print("\nRollback successful")

    except Exception as e:
        db.rollback()
        print("Error:", e) 