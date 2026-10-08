from pydantic import BaseModel


class CaseStatusUpdate(BaseModel):
    status: str