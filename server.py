from fastapi import HTTPException

PLANS_STORE: dict[str, dict] = {}  # TODO: 실 서비스에서는 DB로 교체 (지금은 서버 재시작하면 사라짐)

class GeneratePlanRequest(BaseModel):
    parsedToc: dict
    startDate: date
    targetDate: date
    weekdayMinutes: dict[str, int]
    checkedDates: list[date]
    userId: str | None = None  # 로그인 파트에서 내려주는 사용자 식별자


@app.post("/generate-plan")
def generate_plan(req: GeneratePlanRequest):
    excluded_dates = [
        d for d in _date_range(req.startDate, req.targetDate)
        if d not in req.checkedDates
    ]
    plan = schedule.generate_study_plan(
        req.parsedToc, req.startDate, req.targetDate, req.weekdayMinutes, excluded_dates
    )
    if req.userId:
        PLANS_STORE[req.userId] = plan
    return plan


@app.get("/plans/{user_id}")
def get_plan(user_id: str):
    plan = PLANS_STORE.get(user_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="저장된 플랜이 없습니다.")
    return plan