from pydantic import BaseModel


class PredictionRequest(BaseModel):
    report_text: str