import { useEffect, useMemo, useState } from "react";
import { s, theme } from "../theme";

const API_BASE = "http://localhost:8000";
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

export default function MainScreen() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = localStorage.getItem("userId"); // TODO: 로그인 파트와 협의해서 실제 식별자로 교체
    if (!userId) {
      setError("로그인 정보가 없어 플랜을 불러올 수 없습니다.");
      return;
    }
    fetch(`${API_BASE}/plans/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("저장된 학습 플랜이 없습니다.");
        return res.json();
      })
      .then(setPlan)
      .catch((e) => setError(e.message));
  }, []);

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

  if (error) return <p style={s.errorText}>{error}</p>;
  if (!plan) return <p style={s.subtitle}>학습 플랜을 불러오는 중...</p>;

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
      <span style={s.tag}>📅 메인</span>
      <h2 style={s.title}>학습 스케줄 달력</h2>

      {plan.warnings?.length > 0 && (
        <div style={s.warningBox}>
          {plan.warnings.map((w, i) => (
            <p key={i} style={s.warningText}>⚠ {w}</p>
          ))}
        </div>
      )}

      <p style={s.subtitle}>
        총 {plan.totalPages}페이지 · 총 {plan.totalMinutes}분 배정
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "4px 0 12px" }}>
        <button onClick={goPrevMonth} style={{ ...s.btnSecondary, padding: "6px 12px" }}>◀</button>
        <strong>{viewYear}년 {viewMonth + 1}월</strong>
        <button onClick={goNextMonth} style={{ ...s.btnSecondary, padding: "6px 12px" }}>▶</button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <thead>
          <tr>
            {WEEKDAY_LABELS.map((w) => (
              <th key={w} style={{ padding: 6, color: theme.colors.textSoft, fontWeight: 500, fontSize: 13 }}>{w}</th>
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
                  <td key={i} style={{ padding: 3, textAlign: "center" }}>
                    <button
                      onClick={() => day && setSelectedDate(key)}
                      disabled={!day}
                      style={{
                        width: "100%",
                        padding: "8px 4px",
                        borderRadius: theme.radius.sm,
                        border: isSelected ? `2px solid ${theme.colors.primary}` : `1px solid ${theme.colors.border}`,
                        background: day ? (isSelected ? theme.colors.primarySoft : "#fff") : "#F7F4FA",
                        color: day ? theme.colors.text : "#D8D3E0",
                        cursor: day ? "pointer" : "default",
                        fontFamily: theme.font,
                      }}
                    >
                      <div>{d}</div>
                      {day && <div style={{ fontSize: 11, color: theme.colors.primaryDark, fontWeight: 700 }}>{totalPages}p</div>}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: 16, marginBottom: 20, minHeight: 60, background: "#FBF9FE" }}>
        {!selectedDay ? (
          <p style={{ color: theme.colors.textSoft, margin: 0, fontSize: 14 }}>날짜를 선택하면 그날의 학습 항목을 보여줍니다.</p>
        ) : (
          <>
            <strong>{selectedDay.date} ({selectedDay.minutes}분)</strong>
            {selectedDay.items.length === 0 ? (
              <p style={{ color: theme.colors.textSoft, margin: "6px 0 0" }}>배정된 항목 없음</p>
            ) : (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                {selectedDay.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>
                    {item.title} — {item.pageRange ? item.pageRange : `${item.pagesToday}p`}
                    {" "}
                    <span style={{ color: theme.colors.textSoft }}>({item.pagesToday}p / {item.totalPages}p)</span>
                    {" "}({item.status})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <button onClick={() => downloadJson(plan)} style={s.btnSecondary}>JSON으로 저장</button>
    </div>
  );
}