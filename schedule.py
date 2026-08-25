# -*- coding: utf-8 -*-
"""
파싱된 목차(postprocess_toc_result 결과)와 사용자의 학습 기간·요일별 가용 시간을 받아
날짜별 학습 플랜을 생성한다.
- 페이지 수는 챕터의 estimatedPageCount(실측 또는 평균 추정치)를 그대로 쓴다.
- "하루 가용 시간에 비례해서 전체 분량을 나눈다"는 단순한 방식이다.
  (읽는 속도를 따로 입력받지 않고, 시간이 2배인 날은 분량도 2배로 배정)
"""
from __future__ import annotations

import datetime

WEEKDAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]  # date.weekday(): 월=0 ... 일=6


def parse_hhmm(hhmm: str) -> int:
    """"1:30" 같은 "시:분" 문자열을 분 단위 정수로 변환한다."""
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def _get_leaf_items(parsed: dict) -> list[dict]:
    """
    스케줄링 대상 leaf 항목만 순서대로 모은다.
    - CONTENT로 분류된 항목만 대상으로 한다 (부록/머리말 등은 제외).
    - postprocess.py의 add_estimated_page_counts와 같은 규칙: 소단원이 실제
      페이지를 갖고 있으면 소단원을, 아니면 챕터 자신을 리프로 쓴다.
    - estimatedPageCount가 없는(=평균조차 못 낸) 항목은 스케줄링에서 제외한다.
    """
    leaves = []
    for chapter in parsed.get("chapters", []):
        if chapter.get("contentType") != "CONTENT":
            continue
        subunits = chapter.get("subunits", [])
        subunits_have_pages = any(sub.get("startPage") is not None for sub in subunits)
        if subunits and subunits_have_pages:
            for sub in subunits:
                if sub.get("estimatedPageCount"):
                    leaves.append({"title": sub["title"], "pageCount": sub["estimatedPageCount"]})
        else:
            if chapter.get("estimatedPageCount"):
                leaves.append({"title": chapter["title"], "pageCount": chapter["estimatedPageCount"]})
    return leaves


def _study_days(
    start_date: datetime.date,
    target_date: datetime.date,
    excluded_dates: list[datetime.date] | None,
) -> list[datetime.date]:
    excluded = set(excluded_dates or [])
    days = []
    d = start_date
    while d <= target_date:
        if d not in excluded:
            days.append(d)
        d += datetime.timedelta(days=1)
    return days


def generate_study_plan(
    parsed_toc: dict,
    start_date: datetime.date,
    target_date: datetime.date,
    weekday_minutes: dict[str, int],
    excluded_dates: list[datetime.date] | None = None,
) -> dict:
    """
    parsed_toc: postprocess_toc_result()의 반환값
    start_date, target_date: 학습 시작일/목표일 (둘 다 포함하는 범위)
    weekday_minutes: {"월": 60, "화": 60, ..., "토": 180, "일": 180} 형태의
                      요일별 가용 시간(분). parse_hhmm()으로 "시:분" 입력을 변환해 넣으면 된다.
    excluded_dates: 학습이 불가능한 날짜 목록

    반환값:
    {
        "days": [{"date": "2026-08-25", "minutes": 60,
                   "items": [{"title": ..., "pagesToday": 4.2, "totalPages": 9, "status": "시작"}]}],
        "totalPages": ...,
        "totalMinutes": ...,
        "warnings": [...],
    }
    """
    leaves = _get_leaf_items(parsed_toc)
    total_pages = sum(l["pageCount"] for l in leaves)

    days = _study_days(start_date, target_date, excluded_dates)
    day_minutes = [weekday_minutes.get(WEEKDAY_NAMES[d.weekday()], 0) for d in days]
    total_minutes = sum(day_minutes)

    warnings = []
    if not leaves:
        warnings.append("스케줄링할 수 있는 챕터가 없습니다 (CONTENT 항목이 없거나 페이지 정보가 없음).")
    if total_minutes <= 0:
        warnings.append("학습 가능한 시간이 0분입니다. 요일별 가용 시간이나 학습 기간을 확인해주세요.")
    if not leaves or total_minutes <= 0:
        return {"days": [], "totalPages": round(total_pages, 1), "totalMinutes": total_minutes, "warnings": warnings}

    pages_per_minute = total_pages / total_minutes

    leaf_idx = 0
    leaf_total_remaining = leaves[0]["pageCount"]
    leaf_consumed_so_far = 0.0

    day_plans = []
    for d, minutes in zip(days, day_minutes):
        pages_budget = minutes * pages_per_minute
        items = []

        while pages_budget > 1e-9 and leaf_idx < len(leaves):
            current = leaves[leaf_idx]
            take = min(pages_budget, leaf_total_remaining)
            starts_today = leaf_consumed_so_far == 0
            leaf_consumed_so_far += take
            leaf_total_remaining -= take
            finishes_today = leaf_total_remaining <= 1e-9

            status = (
                "완료" if starts_today and finishes_today else
                "시작" if starts_today else
                "마무리" if finishes_today else
                "진행중"
            )
            items.append({
                "title": current["title"],
                "pagesToday": round(take, 1),
                "totalPages": current["pageCount"],
                "status": status,
            })

            pages_budget -= take
            if finishes_today:
                leaf_idx += 1
                leaf_consumed_so_far = 0.0
                if leaf_idx < len(leaves):
                    leaf_total_remaining = leaves[leaf_idx]["pageCount"]

        day_plans.append({"date": d.isoformat(), "minutes": minutes, "items": items})

    if leaf_idx < len(leaves):
        warnings.append(f"학습 가능 시간이 부족해 {len(leaves) - leaf_idx}개 챕터가 목표일까지 배정되지 못했습니다.")

    return {
        "days": day_plans,
        "totalPages": round(total_pages, 1),
        "totalMinutes": total_minutes,
        "warnings": warnings,
    }