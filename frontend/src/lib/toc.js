// postprocess.py / schedule.py의 "리프(leaf) 항목" 규칙을 프론트에서도 그대로 따른다.
export function getLeafUnits(parsedToc) {
  const leaves = [];
  for (const chapter of parsedToc?.chapters ?? []) {
    if (chapter.contentType !== "CONTENT") continue;
    const subunits = chapter.subunits ?? [];
    const subunitsHavePages = subunits.some((s) => s.startPage != null);
    if (subunits.length > 0 && subunitsHavePages) {
      subunits.forEach((sub) => {
        leaves.push({
          key: `${chapter.order}-${sub.order}`,
          chapterOrder: chapter.order,
          subOrder: sub.order,
          title: sub.title,
          parentTitle: chapter.title,
          pageInfo:
            sub.startPage != null
              ? `${sub.startPage}p ~ ${sub.endPage ?? "?"}p`
              : "페이지 확인 필요",
        });
      });
    } else {
      leaves.push({
        key: `${chapter.order}`,
        chapterOrder: chapter.order,
        subOrder: null,
        title: chapter.title,
        parentTitle: null,
        pageInfo:
          chapter.startPage != null
            ? `${chapter.startPage}p ~ ${chapter.endPage ?? "?"}p`
            : "페이지 확인 필요",
      });
    }
  }
  return leaves;
}

// 사용자가 체크 해제한 리프(key 목록)를 실제로 parsedToc에서 제거해
// 백엔드(schedule.py)로 보낼 최종 목차를 만든다.
export function filterParsedToc(parsedToc, excludedKeys) {
  const excluded = new Set(excludedKeys);
  const chapters = (parsedToc?.chapters ?? [])
    .map((chapter) => {
      const subunits = chapter.subunits ?? [];
      const subunitsHavePages = subunits.some((s) => s.startPage != null);
      if (chapter.contentType === "CONTENT" && subunits.length > 0 && subunitsHavePages) {
        const keptSubunits = subunits.filter(
          (sub) => !excluded.has(`${chapter.order}-${sub.order}`)
        );
        return { ...chapter, subunits: keptSubunits };
      }
      if (chapter.contentType === "CONTENT" && excluded.has(`${chapter.order}`)) {
        return null;
      }
      return chapter;
    })
    .filter(Boolean);

  return { ...parsedToc, chapters };
}

export function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function rangeMinutes(range) {
  const start = parseHHMM(range.start);
  const end = parseHHMM(range.end);
  return Math.max(0, end - start);
}