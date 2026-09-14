from fastapi import FastAPI

from app.api.routes.departments import router as departments_router
from app.api.routes.teams import router as teams_router
from app.api.routes.team_performance import router as team_performance_router
from app.api.routes.cases import router as cases_router
from app.api.routes.predictions import router as predictions_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.assignments import router as assignments_router


app = FastAPI(
    title="MedRoute AI",
    description="Clinical NLP-based Medical Report Classification and Clinical Decision Support System",
    version="1.0.0"
)


app.include_router(departments_router)
app.include_router(teams_router)
app.include_router(team_performance_router)
app.include_router(cases_router)
app.include_router(predictions_router)
app.include_router(recommendations_router)
app.include_router(assignments_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "MedRoute AI Backend"
    }
    