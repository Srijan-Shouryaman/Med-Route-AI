from pydantic import BaseModel


class ApprovalRequest(BaseModel):
    approving_user: str


class OverrideRequest(BaseModel):
    selected_team_id: str
    override_reason: str
    approving_user: str