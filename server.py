# -*- coding: utf-8 -*-
"""
React 프론트엔드와 연결하기 위한 FastAPI 서버.
- 로컬 개발용. `uvicorn server:app --reload`로 실행한다.
- 목차 파싱(사진 여러 장/PDF)과 학습 플랜 생성을 각각 엔드포인트로 노출한다.
"""
import base64
import tempfile
from datetime import date, timedelta
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from api_call import parse_toc_from_images, parse_toc_from_text
from pdf_extract import extract_toc_text
from schedule import generate_study_plan

app = FastAPI(title="Planit TOC Parser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

PLANS_STORE: dict[str, dict] = {}  # TODO: 실 서비스에서는 DB로 교체 (지금은 서버 재시작하면 사라짐)


@app.post("/parse-toc/image")
async def parse_toc_image(
    files: list[UploadFile] = File(...),
    total_pages: int | None = Form(None),
):
    """
    목차 사진을 한 장 이상 업로드하면 구조화된 챕터 JSON을 반환한다.
    목차가 여러 장으로 나뉘어 촬영된 경우, 여러 파일을 같은 요청에 함께 보내면
    하나로 이어 붙여 파싱한다.
    """
    images = []
    for f in files:
        image_bytes = await f.read()
        images.append({
            "data": base64.b64encode(image_bytes).decode(),
            "media_type": f.content_type or "image/jpeg",
        })

    try:
        result = parse_toc_from_images(images, total_pages=total_pages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return result


@app.post("/parse-toc/pdf")
async def parse_toc_pdf(
    file: UploadFile = File(...),
    total_pages: int | None = Form(None),
):
    """목차가 포함된 PDF를 업로드하면 구조화된 챕터 JSON을 반환한다."""
    pdf_bytes = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    try:
        toc_text = extract_toc_text(tmp_path)
        result = parse_toc_from_text(toc_text, total_pages=total_pages)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return result


class GeneratePlanRequest(BaseModel):
    """
    parsedToc: postprocess_toc_result() 형태의 결과. 사용자가 과목 선택 화면에서
               체크 해제한 챕터는 프론트에서 이미 제외하고 보내는 것을 전제로 한다.
    startDate/targetDate: 학습 시작일/목표일 (둘 다 포함).
    weekdayMinutes: {"월": 120, ..., "토": 0, "일": 0} 형태의 요일별 가용 시간(분).
                    프론트에서 평일/주말 범위를 분으로 환산해 7일치로 채워서 보낸다.
    checkedDates: 캘린더에서 사용자가 체크한(=학습 가능한) 날짜 목록. 이 목록에
                  없는, 시작일~목표일 범위 안의 날짜는 전부 제외일로 처리한다.
    userId: 로그인 파트에서 내려주는 사용자 식별자. 있으면 생성된 플랜을 저장해서
            메인페이지가 나중에 /plans/{user_id}로 다시 조회할 수 있게 한다.
    """
    parsedToc: dict
    startDate: date
    targetDate: date
    weekdayMinutes: dict[str, int]
    checkedDates: list[date]
    userId: str | None = None


@app.post("/generate-plan")
async def generate_plan(req: GeneratePlanRequest):
    """선택된 챕터 + 기간/시간 설정을 받아 날짜별 학습 플랜을 생성한다."""
    all_days = []
    d = req.startDate
    while d <= req.targetDate:
        all_days.append(d)
        d += timedelta(days=1)

    checked_set = set(req.checkedDates)
    excluded_dates = [d for d in all_days if d not in checked_set]

    try:
        result = generate_study_plan(
            req.parsedToc,
            start_date=req.startDate,
            target_date=req.targetDate,
            weekday_minutes=req.weekdayMinutes,
            excluded_dates=excluded_dates,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if req.userId:
        PLANS_STORE[req.userId] = result

    return result


@app.get("/plans/{user_id}")
async def get_plan(user_id: str):
    """메인페이지가 로그인한 사용자의 최근 학습 플랜을 조회할 때 쓰는 엔드포인트."""
    plan = PLANS_STORE.get(user_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="저장된 플랜이 없습니다.")
    return plan

class ProgressUpdateRequest(BaseModel):
    date: str
    items: list[int]  # 그날 items 배열과 순서를 맞춘 진도율(%) 리스트


@app.post("/plans/{user_id}/progress")
async def update_progress(user_id: str, req: ProgressUpdateRequest):
    """오늘 할 일 화면에서 사용자가 고른 항목별 진도율(%)을 저장한다."""
    plan = PLANS_STORE.get(user_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="저장된 플랜이 없습니다.")

    day = next((d for d in plan["days"] if d["date"] == req.date), None)
    if day is None:
        raise HTTPException(status_code=404, detail="해당 날짜의 플랜이 없습니다.")

    for item, progress in zip(day["items"], req.items):
        item["progress"] = progress

    PLANS_STORE[user_id] = plan
    return plan

@app.get("/health")
async def health():
    """React 쪽에서 서버가 켜져있는지 확인할 때 쓸 수 있는 간단한 상태 체크용."""
    return {"status": "ok"}