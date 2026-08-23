# -*- coding: utf-8 -*-
"""
LLM이 반환한 목차 파싱 결과(JSON)를 받아 후처리한다.
- endPage는 여기서 계산한다 (LLM에게 산수를 시키지 않는다).
- NON_CONTENT 키워드 2차 검증으로 LLM 분류 누락을 보정한다.
- JSON 파싱 실패에 대비한 안전 파서를 제공한다.
"""
import json
import re

# contentType 2차 검증용 키워드 (문서 6-1절과 동일)
NON_CONTENT_KEYWORDS = [
    "머리말", "들어가며", "서문", "저자", "감사의 글", "일러두기",
    "찾아보기", "색인", "참고문헌", "부록",
    "prologue", "index", "appendix", "preface", "acknowledg",
]


def safe_json_parse(raw_text: str) -> dict:
    """
    LLM 응답에서 JSON만 추출해 파싱한다.
    - 코드블록(```json ... ```)이 섞여 나오는 경우까지 방어.
    - 실패 시 예외를 던지므로 호출부에서 재시도 로직을 붙인다.
    """
    cleaned = raw_text.strip()
    # ```json ... ``` 혹은 ``` ... ``` 형태로 감싸져 오는 경우 제거
    fence_match = re.search(r"```(?:json)?\s*(.*?)\s*```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1)
    return json.loads(cleaned)


def _flatten_ordered(chapters: list[dict]) -> list[dict]:
    """최상위 챕터들을 order 기준으로 정렬한 리스트를 반환 (subunits는 건드리지 않음)."""
    return sorted(chapters, key=lambda c: c.get("order", 0))


def _find_next_start_page(items: list[dict], from_index: int) -> int | None:
    """
    from_index 다음부터 startPage가 실제로 존재하는 첫 항목을 찾아 그 값을 반환한다.
    - "첫째마당/둘째마당" 같은 PART 구분자처럼 startPage가 null인 항목은
      끝까지 건너뛰고, 그 뒤에 있는 진짜 다음 챕터의 startPage를 사용한다.
    - 이렇게 해야 구분자 바로 앞 챕터의 endPage가 null로 끊기지 않는다.
    """
    for item in items[from_index + 1:]:
        if item.get("startPage") is not None:
            return item["startPage"]
    return None


def compute_end_pages(parsed: dict, total_pages: int | None = None) -> dict:
    """
    각 최상위 챕터의 endPage를 '다음에 오는 startPage가 있는 항목의 startPage - 1'로
    계산해 채워 넣는다.
    - 바로 다음 항목이 PART 구분자 등으로 startPage가 null이면, 그 뒤를 계속 탐색해
      startPage가 있는 항목을 찾는다 (건너뛰기).
    - 마지막 챕터(뒤에 startPage 있는 항목이 전혀 없는 경우)는 total_pages가 주어지면
      그 값을, 없으면 None을 사용한다.
    - 챕터 자신의 startPage가 null이면(예: PART 구분자 자체) 계산을 건너뛰고
      needsFallback 플래그를 세운다.
    - 소단원(subunits)에도 동일한 규칙을 챕터 내부에서 적용한다.
    """
    chapters = _flatten_ordered(parsed.get("chapters", []))

    for i, chapter in enumerate(chapters):
        if chapter.get("startPage") is None:
            chapter["needsFallback"] = True
            chapter["endPage"] = None
            continue

        chapter["needsFallback"] = False
        next_start = _find_next_start_page(chapters, i)
        if next_start is not None:
            chapter["endPage"] = next_start - 1
        elif total_pages is not None:
            chapter["endPage"] = total_pages
        else:
            # 뒤에 참조할 페이지도 없고 total_pages도 없는 "진짜 마지막" 케이스
            # -> null로 남기되, 페이지 정보 부족 상태임을 명시적으로 플래그
            chapter["endPage"] = None
            chapter["needsFallback"] = True

        # 소단원 endPage도 같은 방식으로 계산 (챕터 내부 기준, 마지막 소단원은 챕터 endPage로)
        subunits = sorted(chapter.get("subunits", []), key=lambda s: s.get("order", 0))
        for j, sub in enumerate(subunits):
            if sub.get("startPage") is None:
                sub["needsFallback"] = True
                sub["endPage"] = None
                continue
            sub["needsFallback"] = False
            sub_next_start = _find_next_start_page(subunits, j)
            if sub_next_start is not None:
                sub["endPage"] = sub_next_start - 1
            elif chapter["endPage"] is not None:
                sub["endPage"] = chapter["endPage"]
            else:
                sub["endPage"] = None
                sub["needsFallback"] = True
        chapter["subunits"] = subunits

    parsed["chapters"] = chapters
    return parsed


def apply_non_content_keyword_filter(parsed: dict) -> dict:
    """
    LLM이 CONTENT로 분류했더라도, 제목에 NON_CONTENT 키워드가 포함되면
    NON_CONTENT로 재분류한다 (LLM 분류 누락 보정용 2차 검증).
    """
    for chapter in parsed.get("chapters", []):
        title_lower = chapter.get("title", "").lower()
        if any(kw.lower() in title_lower for kw in NON_CONTENT_KEYWORDS):
            chapter["contentType"] = "NON_CONTENT"
    return parsed


def detect_page_order_anomalies(parsed: dict) -> dict:
    """
    챕터의 startPage가 순서(order)대로 오름차순인지 자동 검증한다.
    - 사용자에게 절대 노출하지 않는다. 이 결과는 endPage 계산 전에 실행되어,
      이상치로 판정된 startPage를 null로 무효화한다 (이미 있는 '페이지 정보
      누락' 처리 경로 -> needsFallback/건너뛰기 로직을 그대로 재사용하기 위함).
    - order 기준으로 순회하면서 이전 값보다 작거나 같은 값이 나오면
      "믿을 수 없는 값"으로 보고 startPage를 null로 지운다.
    - 반드시 compute_end_pages보다 먼저 호출해야 한다. 그래야 잘못된 페이지
      번호가 다른 챕터의 endPage 계산까지 오염시키는 것을 막을 수 있다.
    """
    chapters = _flatten_ordered(parsed.get("chapters", []))
    has_anomaly = False
    prev_page = None

    for chapter in chapters:
        page = chapter.get("startPage")
        if page is None:
            prev_page = None  # 이미 페이지 정보가 없는 항목 -> 기준점 리셋
            continue
        if prev_page is not None and page <= prev_page:
            # 이전 챕터보다 작거나 같은 페이지 -> 명백히 잘못 읽은 값으로 간주
            chapter["startPage"] = None
            chapter["pageOrderAnomaly"] = True
            has_anomaly = True
            # prev_page는 갱신하지 않음 (이 값 자체를 못 믿으므로 기준에서 제외)
            continue
        chapter["pageOrderAnomaly"] = False
        prev_page = page

        # 소단원도 같은 방식으로 챕터 내부 기준 검사
        subunits = sorted(chapter.get("subunits", []), key=lambda s: s.get("order", 0))
        sub_prev = None
        for sub in subunits:
            sub_page = sub.get("startPage")
            if sub_page is None:
                sub_prev = None
                continue
            if sub_prev is not None and sub_page <= sub_prev:
                sub["startPage"] = None
                sub["pageOrderAnomaly"] = True
                has_anomaly = True
                continue
            sub["pageOrderAnomaly"] = False
            sub_prev = sub_page
        chapter["subunits"] = subunits

    parsed["chapters"] = chapters
    parsed["_hasPageOrderAnomaly"] = has_anomaly  # 내부용 플래그 (재검증 트리거용, 사용자 비노출)
    return parsed


def postprocess_toc_result(raw_llm_text: str, total_pages: int | None = None) -> dict:
    """
    파싱 -> 순서 이상치 탐지/제거 -> endPage 계산 -> 키워드 필터 순으로 처리하는 진입점.
    (이상치 탐지를 endPage 계산보다 먼저 해야, 잘못된 페이지 번호가
     다른 항목의 endPage 계산까지 오염시키지 않는다.)
    """
    parsed = safe_json_parse(raw_llm_text)
    if "error" in parsed:
        return parsed
    parsed = detect_page_order_anomalies(parsed)
    parsed = compute_end_pages(parsed, total_pages=total_pages)
    parsed = apply_non_content_keyword_filter(parsed)
    return parsed