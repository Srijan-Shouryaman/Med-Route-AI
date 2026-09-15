from sqlalchemy import text
from sqlalchemy.orm import Session

import json


def get_recommendation_data(case_id: str, db: Session):

    case_result = db.execute(
        text("""
            SELECT
                case_id,
                requested_specialization,
                is_emergency,
                priority,
                status
            FROM cases
            WHERE case_id = :case_id
        """),
        {"case_id": case_id}
    )

    case = case_result.mappings().fetchone()

    if case is None:
        raise ValueError("Case not found")

    prediction_result = db.execute(
        text("""
            SELECT
                prediction_id,
                predicted_department_id
            FROM predictions
            WHERE case_id = :case_id
            ORDER BY prediction_id DESC
            LIMIT 1
        """),
        {"case_id": case_id}
    )

    prediction = prediction_result.mappings().fetchone()

    if prediction is None:
        raise ValueError(
            "Prediction not found for this case"
        )

    team_result = db.execute(
        text("""
            SELECT
                ct.team_id,
                ct.team_name,
                ct.department_id,
                ct.specialization,
                ct.experience_years,
                ct.availability,
                ct.active_cases,
                ct.maximum_capacity,
                ct.current_workload_percentage,
                ct.emergency_handling_capability,
                ct.shift,
                ct.status,

                tp.total_cases_handled,
                tp.successful_cases,
                tp.success_rate,
                tp.average_case_resolution_time_hours,
                tp.emergency_cases_handled,
                tp.emergency_success_rate

            FROM clinical_teams ct

            LEFT JOIN team_performance tp
                ON ct.team_id = tp.team_id

            WHERE ct.department_id = :department_id

            ORDER BY ct.team_id
        """),
        {
            "department_id": prediction["predicted_department_id"]
        }
    )

    teams = team_result.mappings().all()

    return {
        "case": case,
        "prediction": prediction,
        "teams": teams
    }
    
def filter_eligible_teams(teams):
    """
    Remove teams that cannot receive a recommendation.

    Exclude:
        - Inactive teams
        - Unavailable teams
        - Teams on leave
        - Teams at or above maximum capacity
    """

    eligible_teams = []

    for team in teams:

        if team["status"] == "Inactive":
            continue

        if team["availability"] in ("Unavailable", "On Leave"):
            continue

        if team["active_cases"] >= team["maximum_capacity"]:
            continue

        eligible_teams.append(team)

    return eligible_teams


def calculate_specialization_score(
    requested_specialization,
    team_specialization
):
    """
    Calculate specialization score.

    NULL requested specialization:
        80

    Exact match:
        100

    Different specialization within the predicted department:
        50
    """

    if requested_specialization is None:
        return 80.0

    if requested_specialization == team_specialization:
        return 100.0

    return 50.0

def calculate_availability_score(availability):
        """
        Calculate availability score.

        Available:
            100

        Busy:
            60

        Unavailable / On Leave:
            should never reach this function because
            those teams are removed during eligibility filtering.
        """

        if availability == "Available":
            return 100.0

        if availability == "Busy":
            return 60.0

        raise ValueError(
            f"Unexpected availability value: {availability}"
        )
        
        
def calculate_workload_score(
    workload_percentage,
    is_emergency
):
    """
    Calculate workload score.

    Routine / normal workload:
        <= 50%  -> 100
        51-75% -> 70
        76-89% -> 40
        90-99% -> 15

    Teams at 100% or above should already have been
    removed by the eligibility filter.

    Emergency modifier:
        If emergency AND workload > 75%,
        multiply the base score by 0.7.
    """

    if workload_percentage <= 50:
        score = 100.0

    elif workload_percentage <= 75:
        score = 70.0

    elif workload_percentage <= 89:
        score = 40.0

    else:
        score = 15.0
        
    if is_emergency and workload_percentage > 75:
        score *= 0.7

    return score

def calculate_experience_score(experience_years):
    """
    Calculate experience score.

    20 years or more = 100
    Below 20 years = proportional score
    """

    return min(
        100.0,
        (experience_years / 20.0) * 100.0
    )
    
    
def calculate_historical_score(success_rate):
    """
    Historical success score.

    success_rate is already normalized to 0-100.
    """

    return float(success_rate)


def calculate_emergency_score(
    is_emergency,
    emergency_handling_capability,
    emergency_cases_handled,
    emergency_success_rate
):
    """
    Calculate emergency score.

    Routine case:
        100

    Emergency + capable + emergency history:
        emergency_success_rate

    Emergency + capable + no emergency history:
        75

    Emergency + not capable:
        0
    """

    if not is_emergency:
        return 100.0

    if not emergency_handling_capability:
        return 0.0

    if emergency_cases_handled > 0:
        return float(emergency_success_rate)

    return 75.0


def calculate_final_score(
    specialization_score,
    workload_score,
    availability_score,
    experience_score,
    historical_score,
    emergency_score,
    is_emergency
):
    if is_emergency:
        return (
            0.25 * specialization_score
            + 0.15 * workload_score
            + 0.15 * availability_score
            + 0.10 * experience_score
            + 0.15 * historical_score
            + 0.20 * emergency_score
        )

    return (
        0.30 * specialization_score
        + 0.20 * workload_score
        + 0.15 * availability_score
        + 0.15 * experience_score
        + 0.15 * historical_score
        + 0.05 * emergency_score
    )
    
    
def score_team(case, team):
    specialization_score = calculate_specialization_score(
        case["requested_specialization"],
        team["specialization"]
    )

    availability_score = calculate_availability_score(
        team["availability"]
    )

    workload_score = calculate_workload_score(
        team["current_workload_percentage"],
        case["is_emergency"]
    )

    experience_score = calculate_experience_score(
        team["experience_years"]
    )

    historical_score = calculate_historical_score(
        team["success_rate"]
    )

    emergency_score = calculate_emergency_score(
        case["is_emergency"],
        team["emergency_handling_capability"],
        team["emergency_cases_handled"],
        team["emergency_success_rate"]
    )

    final_score = calculate_final_score(
        specialization_score,
        workload_score,
        availability_score,
        experience_score,
        historical_score,
        emergency_score,
        case["is_emergency"]
    )

    return {
        "team_id": team["team_id"],
        "team_name": team["team_name"],
        "specialization": team["specialization"],
        "specialization_score": specialization_score,
        "availability_score": availability_score,
        "workload_score": workload_score,
        "current_workload_percentage": team["current_workload_percentage"],
        "experience_score": experience_score,
        "historical_score": historical_score,
        "emergency_score": emergency_score,
        "final_score": final_score
    }
    
def rank_teams(scored_teams):
    ranked_teams = sorted(
        scored_teams,
        key=lambda team: (
            -team["final_score"],
            -float(team["historical_score"]),
            float(team["current_workload_percentage"]),
            -team["experience_score"],
            team["team_id"]
        )
    )

    for index, team in enumerate(ranked_teams, start=1):
        team["rank"] = index

    return ranked_teams

def select_top_teams(ranked_teams, limit=3):
    return ranked_teams[:limit]

def handle_no_eligible_teams(case, db):
    case_id = case["case_id"]

    db.execute(
        text("""
            UPDATE cases
            SET status = 'Flagged - No Eligible Team'
            WHERE case_id = :case_id
        """),
        {"case_id": case_id}
    )

    db.execute(
        text("""
            INSERT INTO audit_logs (
                case_id,
                event_type,
                actor,
                details
            )
            VALUES (
                :case_id,
                :event_type,
                :actor,
                CAST(:details AS JSONB)
            )
        """),
        {
            "case_id": case_id,
            "event_type": "NO_ELIGIBLE_TEAM_FLAGGED",
            "actor": "recommendation_engine",
            "details": json.dumps({
                "message": "No eligible clinical team available for this case",
                "manual_assignment_required": True
            })
        }
    )

    return {
        "case_id": case_id,
        "status": "Flagged - No Eligible Team",
        "manual_assignment_required": True
    }
    
def update_case_status(case_id, status, db):
    result = db.execute(
        text("""
            UPDATE cases
            SET status = :status
            WHERE case_id = :case_id
        """),
        {
            "case_id": case_id,
            "status": status
        }
    )

    if result.rowcount == 0:
        raise ValueError("Case not found")

    return {
        "case_id": case_id,
        "status": status
    }
    
def generate_recommendations(case_id, db):
    data = get_recommendation_data(case_id, db)

    case = data["case"]
    prediction = data["prediction"]
    teams = data["teams"]

    eligible_teams = filter_eligible_teams(teams)

    if not eligible_teams:
        return handle_no_eligible_teams(case, db)

    scored_teams = []

    for team in eligible_teams:
        scored_team = score_team(case, team)
        scored_teams.append(scored_team)

    ranked_teams = rank_teams(scored_teams)

    top_teams = select_top_teams(ranked_teams)

    saved_recommendations = save_recommendations(
        case_id,
        prediction["prediction_id"],
        top_teams,
        db
    )
    
    update_case_status(
        case_id,
        "Pending Human Review",
        db
    )

    return {
        "case_id": case_id,
        "prediction_id": prediction["prediction_id"],
        "predicted_department_id": prediction["predicted_department_id"],
        "recommendations": saved_recommendations
    }
    
def generate_recommendation_id(db):
    result = db.execute(
        text("""
            SELECT recommendation_id
            FROM recommendations
            WHERE recommendation_id LIKE 'R%'
            ORDER BY CAST(SUBSTRING(recommendation_id FROM 2) AS INTEGER) DESC
            LIMIT 1
        """)
    )

    latest_id = result.scalar()

    if latest_id is None:
        return "R0001"

    latest_number = int(latest_id[1:])

    return f"R{latest_number + 1:04d}"


def save_recommendations(case_id, prediction_id, top_teams, db):
    saved_recommendations = []

    for team in top_teams:
        recommendation_id = generate_recommendation_id(db)

        recommendation_id_result = db.execute(
            text("""
                INSERT INTO recommendations (
                    recommendation_id,
                    case_id,
                    prediction_id,
                    rank,
                    team_id,
                    recommendation_score,
                    score_breakdown
                )
                VALUES (
                    :recommendation_id,
                    :case_id,
                    :prediction_id,
                    :rank,
                    :team_id,
                    :recommendation_score,
                    CAST(:score_breakdown AS JSONB)
                )
                RETURNING recommendation_id
            """),
            {
                "recommendation_id": recommendation_id,
                "case_id": case_id,
                "prediction_id": prediction_id,
                "rank": team["rank"],
                "team_id": team["team_id"],
                "recommendation_score": team["final_score"],
                "score_breakdown": json.dumps({
                    "specialization": team["specialization_score"],
                    "availability": team["availability_score"],
                    "workload": team["workload_score"],
                    "experience": team["experience_score"],
                    "historical": team["historical_score"],
                    "emergency": team["emergency_score"]
                })
            }
        )

        saved_id = recommendation_id_result.scalar()

        saved_recommendations.append({
            "recommendation_id": saved_id,
            "case_id": case_id,
            "prediction_id": prediction_id,
            "rank": team["rank"],
            "team_id": team["team_id"],
            "recommendation_score": team["final_score"]
        })

    return saved_recommendations