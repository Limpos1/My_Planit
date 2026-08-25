import { useState } from "react";
import { getLeafUnits } from "../lib/toc";

export default function SelectUnitsScreen({ parsedToc, onNext, onBack }) {
  const leaves = getLeafUnits(parsedToc);
  const [checked, setChecked] = useState(() => {
    const initial = {};
    leaves.forEach((l) => (initial[l.key] = true));
    return initial;
  });

  const toggle = (key) => setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const excludedKeys = Object.keys(checked).filter((k) => !checked[k]);
  const checkedCount = leaves.length - excludedKeys.length;

  return (
    <div>
      <h2>2. 학습할 과목 선택</h2>
      <p>기본적으로 전부 체크되어 있어요. 이번에 공부하지 않을 항목은 체크를 해제하세요.</p>

      <div
        style={{
          maxHeight: 420,
          overflowY: "auto",
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 8,
          marginBottom: 16,
        }}
      >
        {leaves.map((leaf) => (
          <label
            key={leaf.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 4px",
              borderBottom: "1px solid #eee",
            }}
          >
            <input type="checkbox" checked={checked[leaf.key]} onChange={() => toggle(leaf.key)} />
            <span style={{ flex: 1 }}>
              {leaf.parentTitle && <span style={{ color: "#999" }}>{leaf.parentTitle} · </span>}
              {leaf.title}
            </span>
            <span style={{ color: "#888", fontSize: 13 }}>{leaf.pageInfo}</span>
          </label>
        ))}
        {leaves.length === 0 && <p style={{ color: "#888" }}>선택 가능한 학습 항목이 없어요.</p>}
      </div>

      <p style={{ color: "#555" }}>
        {checkedCount} / {leaves.length}개 선택됨
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack}>이전</button>
        <button onClick={() => onNext(excludedKeys)} disabled={checkedCount === 0}>
          다음
        </button>
      </div>
    </div>
  );
}