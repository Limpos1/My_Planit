import { useState } from "react";

export default function AvailabilityScreen({ onNext, onBack }) {
  const [weekdayRange, setWeekdayRange] = useState({ start: "20:00", end: "22:00" });
  const [weekendRange, setWeekendRange] = useState({ start: "10:00", end: "14:00" });
  const [weekendExcluded, setWeekendExcluded] = useState(false);

  const weekdayValid = weekdayRange.end > weekdayRange.start;
  const weekendValid = weekendExcluded || weekendRange.end > weekendRange.start;

  const handleNext = () => {
    onNext({ weekdayRange, weekendRange, weekendExcluded });
  };

  return (
    <div>
      <h2>4. 공부 가능 시간 설정</h2>
      <p>평일과 주말의 공부 가능 시간대를 각각 정해주세요.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 24 }}>
        <div>
          <strong>평일 (월~금)</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <input
              type="time"
              value={weekdayRange.start}
              onChange={(e) => setWeekdayRange((r) => ({ ...r, start: e.target.value }))}
            />
            <span>~</span>
            <input
              type="time"
              value={weekdayRange.end}
              onChange={(e) => setWeekdayRange((r) => ({ ...r, end: e.target.value }))}
            />
          </div>
          {!weekdayValid && <p style={{ color: "crimson", fontSize: 13 }}>종료 시간이 시작 시간보다 늦어야 해요.</p>}
        </div>

        <div>
          <strong>주말 (토·일)</strong>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                type="checkbox"
                checked={weekendExcluded}
                onChange={(e) => setWeekendExcluded(e.target.checked)}
              />
              주말 학습 제외
            </label>
          </div>
          {!weekendExcluded && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <input
                type="time"
                value={weekendRange.start}
                onChange={(e) => setWeekendRange((r) => ({ ...r, start: e.target.value }))}
              />
              <span>~</span>
              <input
                type="time"
                value={weekendRange.end}
                onChange={(e) => setWeekendRange((r) => ({ ...r, end: e.target.value }))}
              />
            </div>
          )}
          {!weekendValid && <p style={{ color: "crimson", fontSize: 13 }}>종료 시간이 시작 시간보다 늦어야 해요.</p>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack}>이전</button>
        <button onClick={handleNext} disabled={!weekdayValid || !weekendValid}>
          플랜 생성하기
        </button>
      </div>
    </div>
  );
}