import { useMemo, useState } from "react";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function downloadJson(plan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "study_plan.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function MainScreen({ plan, onRestart }) {
  const planByDate = useMemo(() => {
    const map = {};
    (plan?.days || []).forEach((day) => {
      map[day.date] = day;
    });
    return map;
  }, [plan]);

  const firstDayWithPlan = plan?.days?.[0]?.date;
  const initialMonth = firstDayWithPlan ? new Date(firstDayWithPlan) : new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());
  const [selectedDate, setSelectedDate] = useState(firstDayWithPlan || null);

  if (!plan) return null;

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrevMonth = () => {
    const m = viewMonth === 0 ? 11 : viewMonth - 1;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    setViewMonth(m);
    setViewYear(y);
  };
  const goNextMonth = () => {
    const m = viewMonth === 11 ? 0 : viewMonth + 1;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    setViewMonth(m);
    setViewYear(y);
  };

  const selectedDay = selectedDate ? planByDate[selectedDate] : null;

  return (
    <div>
      <h2>메인 - 학습 스케줄 달력</h2>

      {plan.warnings?.length > 0 && (
        <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          {plan.warnings.map((w, i) => (
            <p key={i} style={{ margin: 0, color: "#8a6d00" }}>⚠ {w}</p>
          ))}
        </div>
      )}

      <p style={{ color: "#555" }}>
        총 {plan.totalPages}페이지 · 총 {plan.totalMinutes}분 배정
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "12px 0" }}>
        <button onClick={goPrevMonth}>◀</button>
        <strong>{viewYear}년 {viewMonth + 1}월</strong>
        <button onClick={goNextMonth}>▶</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((w) => (
              <th key={w} style={{ padding: 6, color: "#888", fontWeight: "normal" }}>{w}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                if (d === null) return <td key={i} />;
                const key = toKey(viewYear, viewMonth, d);
                const day = planByDate[key];
                const totalPages = day ? day.items.reduce((sum, it) => sum + it.pagesToday, 0) : 0;
                const isSelected = key === selectedDate;
                return (
                  <td key={i} style={{ padding: 4, textAlign: "center" }}>
                    <button
                      onClick={() => day && setSelectedDate(key)}
                      disabled={!day}
                      style={{
                        width: "100%",
                        padding: "8px 4px",
                        borderRadius: 8,
                        border: isSelected ? "2px solid #2E5395" : "1px solid #ddd",
                        background: day ? (isSelected ? "#eaf0fb" : "#fff") : "#f5f5f5",
                        color: day ? "#000" : "#ccc",
                        cursor: day ? "pointer" : "default",
                      }}
                    >
                      <div>{d}</div>
                      {day && <div style={{ fontSize: 11, color: "#2E5395" }}>{totalPages}p</div>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 20, minHeight: 60 }}>
        {!selectedDay ? (
          <p style={{ color: "#aaa", margin: 0 }}>날짜를 선택하면 그날의 학습 항목을 보여줍니다.</p>
        ) : (
          <>
            <strong>{selectedDay.date} ({selectedDay.minutes}분)</strong>
            {selectedDay.items.length === 0 ? (
              <p style={{ color: "#aaa", margin: "6px 0 0" }}>배정된 항목 없음</p>
            ) : (
              <ul style={{ margin: "6px 0 0" }}>
                {selectedDay.items.map((item, i) => (
                  <li key={i}>
                    {item.title} — {item.pageRange ? item.pageRange : `${item.pagesToday}p`}
                    {" "}
                    <span style={{ color: "#999" }}>({item.pagesToday}p / {item.totalPages}p)</span>
                    {" "}({item.status})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => downloadJson(plan)}>JSON으로 저장</button>
        <button onClick={onRestart}>처음부터 다시</button>
      </div>
    </div>
  );
}