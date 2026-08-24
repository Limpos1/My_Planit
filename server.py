# -*- coding: utf-8 -*-
"""
React 프론트엔드와 연결하기 위한 FastAPI 서버.
- 로컬 개발용. `uvicorn server:app --reload`로 실행한다.
- 사진(vision) 파싱과 PDF 텍스트 파싱을 각각 엔드포인트로 노출한다.
"""
import base64
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from api_call import parse_toc_from_image, parse_toc_from_text
from pdf_extract import extract_toc_text

app = FastAPI(title="Planit TOC Parser")

# React 개발 서버(CRA는 3000, Vite는 5173)에서의 요청을 허용한다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/parse-toc/image")
async def parse_toc_image(
    file: UploadFile = File(...),
    total_pages: int | None = Form(None),
):
    """목차 사진을 업로드하면 구조화된 챕터 JSON을 반환한다."""
    image_bytes = await file.read()
    image_base64 = base64.b64encode(image_bytes).decode()
    media_type = file.content_type or "image/jpeg"

    try:
        result = parse_toc_from_image(image_base64, media_type=media_type, total_pages=total_pages)
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


@app.get("/health")
async def health():
    """React 쪽에서 서버가 켜져있는지 확인할 때 쓸 수 있는 간단한 상태 체크용."""
    return {"status": "ok"}