from app.core.database import SessionLocal
from app.recommendation.recommendation_service import get_recommendation_data,filter_eligible_teams,calculate_specialization_score,calculate_availability_score,calculate_workload_score,calculate_experience_score,calculate_historical_score,calculate_emergency_score,calculate_final_score,score_team,rank_teams,select_top_teams,handle_no_eligible_teams,generate_recommendations

from app.recommendation.recommendation_service import (
    generate_recommendations,
    save_recommendations
)
from app.assignment.assignment_service import approve_assignment

from sqlalchemy import text

db = SessionLocal()

try:
    data = get_recommendation_data("C0001", db)

    print("CASE:")
    print(data["case"])

    print("\nPREDICTION:")
    print(data["prediction"])

    eligible_teams = filter_eligible_teams(data["teams"])

    print("\nELIGIBLE TEAMS:")

    for team in eligible_teams:
        print(
            team["team_id"],
            "|",
            team["team_name"],
            "|",
            team["specialization"],
            "|",
            team["availability"],
            "|",
            team["current_workload_percentage"],
            "|",
            team["status"]
        )
        
    print("\nAVAILABILITY FUNCTION TEST:")

    print("Available:",calculate_availability_score("Available"))

    print("Busy:",calculate_availability_score("Busy"))
    
    print("\nWORKLOAD FUNCTION TEST:")

    test_values = [50, 51, 75, 76, 89, 90, 99]

    for workload in test_values:
        routine_score = calculate_workload_score(workload,False)

        emergency_score = calculate_workload_score(workload,True)

        print(f"{workload}% "f"| Routine: {routine_score} "f"| Emergency: {emergency_score}")
        
    print("\nEXPERIENCE FUNCTION TEST:")

    for years in [2, 5, 10, 15, 20, 25, 28]:
        score = calculate_experience_score(years)
        print(f"{years} years -> {score}")
        
    from app.recommendation.recommendation_service import (
    calculate_historical_score
)

    print("\nHISTORICAL FUNCTION TEST:")

    for rate in [0, 50, 75.5, 84.14, 93.67, 100]:
        score = calculate_historical_score(rate)
        print(f"{rate}% -> {score}")
        
    print("\nEMERGENCY FUNCTION TEST:")

    print("Routine:",calculate_emergency_score(False, False, 0, 0))

    print("Emergency + capable + history:",calculate_emergency_score(True, True, 20, 92.5))

    print("Emergency + capable + no history:",calculate_emergency_score(True, True, 0, 0))

    print("Emergency + not capable:",calculate_emergency_score(True, False, 10, 80))
    
    print("\nFINAL SCORE FUNCTION TEST:")

    routine_score = calculate_final_score(
        100,
        100,
        100,
        100,
        100,
        100,
        False
    )

    emergency_score = calculate_final_score(
        100,
        100,
        100,
        100,
        100,
        100,
        True
    )

    print("Routine:", routine_score)
    print("Emergency:", emergency_score)
    
    print("\nFINAL SCORE FUNCTION TEST:")

    routine_score = calculate_final_score(
        80,
        70,
        100,
        50,
        90,
        100,
        False
    )

    emergency_score = calculate_final_score(
        80,
        28,
        100,
        50,
        90,
        95,
        True
    )

    print("Routine example:", routine_score)
    print("Emergency example:", emergency_score)
    
    print("\nTEAM SCORES:")

    for team in eligible_teams:
        scored_team = score_team(
            data["case"],
            team
        )

        print(
            scored_team["team_id"],
            "|",
            scored_team["team_name"]
        )

        print(
            "Specialization:",
            scored_team["specialization_score"]
        )

        print(
            "Availability:",
            scored_team["availability_score"]
        )

        print(
            "Workload:",
            scored_team["workload_score"]
        )

        print(
            "Experience:",
            scored_team["experience_score"]
        )

        print(
            "Historical:",
            scored_team["historical_score"]
        )

        print(
            "Emergency:",
            scored_team["emergency_score"]
        )

        print(
            "Final:",
            scored_team["final_score"]
        )
        scored_teams = []

    for team in eligible_teams:
        scored_team = score_team(
            data["case"],
            team
        )
        scored_teams.append(scored_team)

    ranked_teams = rank_teams(scored_teams)

    print("\nRANKED TEAMS:")

    for team in ranked_teams:
        print(
            team["rank"],
            "|",
            team["team_id"],
            "|",
            team["team_name"],
            "| Score:",
            team["final_score"]
        )
                
    top_teams = select_top_teams(ranked_teams)

    print("\nTOP TEAMS:")

    for team in top_teams:
        print(
            team["rank"],
            "|",
            team["team_id"],
            "|",
            team["team_name"],
            "| Score:",
            team["final_score"]
        )
 
    print("\nNO ELIGIBLE TEAM TEST:")

    test_case = {
        "case_id": "C0001"
    }

    try:
        result = handle_no_eligible_teams(test_case, db)
        print(result)

        db.rollback()

    except Exception as e:
        db.rollback()
        print("Error:", e)  
        
    print("\nAPPROVE ASSIGNMENT TEST:")

    try:
        result = approve_assignment(
            "C0001",
            "department_head_test",
            db
        )

        print("Assignment ID:", result["assignment_id"])
        print("Case:", result["case_id"])
        print("AI Recommended Team:", result["ai_recommended_team_id"])
        print("AI Recommendation Score:", result["ai_recommendation_score"])
        print("Final Assigned Team:", result["final_assigned_team_id"])
        print("Decision:", result["human_decision"])
        print("Approving User:", result["approving_user"])

        db.rollback()
        print("Rollback successful")

    except Exception as e:
        db.rollback()
        print("Error:", e)       
      
            
finally:
    db.close()
    