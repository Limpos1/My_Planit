import { useEffect, useMemo, useState } from "react";
import { theme } from "../theme";

const API_BASE = "http://localhost:8000";
// 팀원의 "할일 체크리스트" 백엔드(Planit-Web-Checklist-main). 진도율 체크와
// "오늘 학습 마무리하기"는 파이썬을 거치지 않고 이 서버를 직접 호출한다
// (팀원이 이미 검증해둔 로직을 그대로 쓰기 위해).
const JAVA_API_BASE = "http://localhost:8080";
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const PROGRESS_STEPS = [25, 50, 75, 100];
const DAY_CELL_HEIGHT = 168;

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function formatStopwatch(totalSeconds) {
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
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

const page = {
  minHeight: "100vh",
  background: theme.colors.bg,
  fontFamily: theme.font,
  color: theme.colors.text,
};
const topbar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 28px",
  background: "#fff",
  borderBottom: `1px solid ${theme.colors.border}`,
  position: "sticky",
  top: 0,
  zIndex: 10,
};
const hamburgerBtn = {
  position: "fixed",
  top: 64,
  left: 28,
  zIndex: 9,
  border: "none",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
  color: theme.colors.text,
  padding: 4,
};
const topMenuLink = {
  color: theme.colors.textSoft,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const layout = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1090px) 320px",
  gap: 24,
  width: 1450,
  marginLeft: 100,
  marginTop: 28,
  marginBottom: 28,
  alignItems: "start",
};
const s_btnSecondary = {
  fontFamily: theme.font,
  background: "#fff",
  color: theme.colors.text,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.pill,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
function s_btnPrimary(disabled) {
  return {
    fontFamily: theme.font,
    background: disabled ? theme.colors.disabled : theme.colors.primary,
    color: "#fff",
    border: "none",
    borderRadius: theme.radius.pill,
    padding: "12px 0",
    fontSize: 14,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    width: "100%",
  };
}

export default function MainScreen() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [dragOverDate, setDragOverDate] = useState(null);
  const [actionMsg, setActionMsg] = useState("");

  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);

  useEffect(() => {
    if (!stopwatchRunning) return;
    const id = setInterval(() => setStopwatchSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [stopwatchRunning]);

  const userId = localStorage.getItem("userId") || "guest"; // TODO: 로그인 붙으면 이 fallback 제거

  const reloadPlan = () =>
    fetch(`${API_BASE}/plans/${userId}`)
      .then((res) => {
        if (!res.ok) throw new Error("저장된 학습 플랜이 없습니다.");
        return res.json();
      })
      .then((data) => {
        setPlan(data);
        setError("");
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    reloadPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [selectedDate, setSelectedDate] = useState(todayKey());

  const todayItems = planByDate[todayKey()]?.items || [];
  const memberId = plan?.memberId;

  // 진도율 버튼을 누르면 파이썬을 거치지 않고 팀원의 체크리스트 API로 바로 반영한다.
  const handleSetProgress = async (itemId, progressRate) => {
    if (memberId == null) return;
    setActionMsg("");
    try {
      const res = await fetch(
        `${JAVA_API_BASE}/api/study-plan-items/${itemId}/progress?memberId=${memberId}&progressRate=${progressRate}`,
        { method: "PATCH" }
      );
      if (!res.ok) throw new Error("진도율 저장에 실패했습니다.");
      await reloadPlan();
    } catch (e) {
      setActionMsg(e.message);
    }
  };

  // "오늘 학습 마무리하기": 다 못 채웠어도 팀원 API로 하루 완료 기록을 남긴다.
  const handleCompleteDay = async () => {
    if (memberId == null) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch(
        `${JAVA_API_BASE}/api/study-plan-items/complete-day?memberId=${memberId}&date=${todayKey()}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("오늘 학습 마무리에 실패했습니다.");
      setSaveMsg("오늘 학습을 마무리했어요!");
    } catch (e) {
      setSaveMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (targetDate, e) => {
    e.preventDefault();
    setDragOverDate(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    const { itemId, date: fromDate } = JSON.parse(raw);
    if (fromDate === targetDate) return;

    try {
      const res = await fetch(`${API_BASE}/plans/${userId}/move-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, toDate: targetDate }),
      });
      if (!res.ok) throw new Error("항목 이동에 실패했습니다.");
      const updated = await res.json();
      setPlan(updated);
      setActionMsg("");
    } catch (e2) {
      setActionMsg(e2.message);
    }
  };

  if (error) {
    return (
      <div style={page}>
        <div style={topbar}>
          <strong>Planit</strong>
        </div>
        <p style={{ padding: 28, color: theme.colors.danger }}>{error}</p>
      </div>
    );
  }
  if (!plan) {
    return (
      <div style={page}>
        <div style={topbar}>
          <strong>Planit</strong>
        </div>
        <p style={{ padding: 28, color: theme.colors.textSoft }}>학습 플랜을 불러오는 중...</p>
      </div>
    );
  }

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
  const totalItems = (plan.days || []).reduce((sum, d) => sum + d.items.length, 0);
  const totalMinutes = (plan.days || []).reduce((sum, d) => sum + d.minutes, 0);

  return (
    <div style={page}>
      <div style={topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <strong style={{ fontSize: 18 }}>Planit</strong>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          {/* TODO: 로그인 파트와 연결 — 로그아웃/마이페이지 */}
          <span style={topMenuLink}>마이페이지</span>
          <span style={topMenuLink}>로그아웃</span>
        </div>
      </div>
      {/* TODO: 사이드 메뉴 내용은 팀과 협의 후 구현 */}
      <button style={hamburgerBtn} title="메뉴">☰</button>

      <div style={layout}>
        <div style={{ background: "#fff", border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: 24, boxShadow: theme.shadow }}>
          <p style={{ color: theme.colors.textSoft, margin: "0 0 12px", fontSize: 14 }}>
            총 {totalItems}개 항목 · 총 {totalMinutes}분 배정 · 항목을 다른 날짜로 드래그해서 옮길 수 있어요
          </p>
          {actionMsg && <p style={{ color: theme.colors.danger, fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>{actionMsg}</p>}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 }}>
            <button onClick={goPrevMonth} style={s_btnSecondary}>◀</button>
            <strong style={{ fontSize: 18 }}>{viewYear}년 {viewMonth + 1}월</strong>
            <button onClick={goNextMonth} style={s_btnSecondary}>▶</button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                {WEEKDAY_LABELS.map((w) => (
                  <th key={w} style={{ padding: 8, color: theme.colors.textSoft, fontWeight: 500, fontSize: 13 }}>{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
                <tr key={row}>
                  {cells.slice(row * 7, row * 7 + 7).map((d, i) => {
                    if (d === null) return <td key={i} style={{ verticalAlign: "top", padding: 4 }} />;
                    const key = toKey(viewYear, viewMonth, d);
                    const day = planByDate[key];
                    const isSelected = key === selectedDate;
                    const isToday = key === todayKey();
                    const isDragOver = dragOverDate === key;
                    return (
                      <td key={i} style={{ verticalAlign: "top", padding: 4 }}>
                        <div
                          onClick={() => day && setSelectedDate(key)}
                          onDragOver={(e) => {
                            if (!day) return;
                            e.preventDefault();
                            setDragOverDate(key);
                          }}
                          onDragLeave={() => setDragOverDate((cur) => (cur === key ? null : cur))}
                          onDrop={(e) => day && handleDrop(key, e)}
                          style={{
                            height: DAY_CELL_HEIGHT,
                            display: "flex",
                            flexDirection: "column",
                            borderRadius: theme.radius.sm,
                            border: isDragOver
                              ? `2px dashed ${theme.colors.primary}`
                              : isSelected
                              ? `2px solid ${theme.colors.primary}`
                              : isToday
                              ? `1.5px solid ${theme.colors.primaryDark}`
                              : `1px solid ${theme.colors.border}`,
                            background: day ? (isDragOver ? theme.colors.primarySoft : isSelected ? "#FBF9FE" : "#fff") : "#F7F4FA",
                            padding: 6,
                            cursor: day ? "pointer" : "default",
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 700, color: day ? theme.colors.text : "#D8D3E0", marginBottom: 5, flexShrink: 0 }}>
                            {d}
                          </div>
                          <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                            {day &&
                              day.items.map((item) => (
                                <div
                                  key={item.id}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    e.dataTransfer.setData("text/plain", JSON.stringify({ itemId: item.id, date: key }));
                                  }}
                                  title={item.content}
                                  style={{
                                    background: theme.colors.primarySoft,
                                    color: theme.colors.primaryDark,
                                    borderRadius: 6,
                                    padding: "4px 7px",
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    marginBottom: 4,
                                    cursor: "grab",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.content} · {item.durationMinutes}분
                                </div>
                              ))}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, padding: 16, marginTop: 16, background: "#FBF9FE" }}>
            {!selectedDay ? (
              <p style={{ color: theme.colors.textSoft, margin: 0, fontSize: 14 }}>날짜를 선택하면 그날의 학습 항목을 보여줍니다.</p>
            ) : (
              <>
                <strong>{selectedDay.date} ({selectedDay.minutes}분)</strong>
                {selectedDay.items.length === 0 ? (
                  <p style={{ color: theme.colors.textSoft, margin: "6px 0 0" }}>배정된 항목 없음</p>
                ) : (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {selectedDay.items.map((item) => (
                      <li key={item.id} style={{ marginBottom: 4, fontSize: 14 }}>
                        {item.subject ? `${item.subject} · ` : ""}{item.content}
                        {" "}
                        <span style={{ color: theme.colors.textSoft }}>({item.durationMinutes}분)</span>
                        {" "}({item.progressRate}%{item.completed ? ", 완료" : ""})
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => downloadJson(plan)} style={s_btnSecondary}>JSON으로 저장</button>
            <button onClick={() => (window.location.href = "/calendar")} style={s_btnSecondary}>
              계획 다시 생성하기
            </button>
          </div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadow, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px 20px 0", textAlign: "center", borderBottom: `1px solid ${theme.colors.border}`, paddingBottom: 16 }}>
            {/* TODO: 완료 처리할 때 이 경과 시간(stopwatchSeconds)도 같이 서버로 전송 */}
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1, marginBottom: 10 }}>
              {formatStopwatch(stopwatchSeconds)}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => setStopwatchRunning((r) => !r)} style={s_btnSecondary}>
                {stopwatchRunning ? "중단" : "시작"}
              </button>
              <button
                onClick={() => {
                  setStopwatchRunning(false);
                  setStopwatchSeconds(0);
                }}
                style={s_btnSecondary}
              >
                초기화
              </button>
            </div>
          </div>

          {/* 오늘 할 일: 팀원의 체크리스트 API(진도율 PATCH)를 항목 클릭 즉시 직접 호출한다 */}
          <div style={{ padding: 20, flex: 1 }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>오늘 할 일</h3>
            {todayItems.length === 0 ? (
              <p style={{ color: theme.colors.textSoft, fontSize: 14 }}>오늘 배정된 학습 항목이 없어요.</p>
            ) : (
              todayItems.map((item) => (
                <div key={item.id} style={{ marginBottom: 18 }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>
                    {item.content}
                    {item.subject && (
                      <span style={{ color: theme.colors.primaryDark, fontWeight: 700 }}> · {item.subject}</span>
                    )}
                  </p>
                  <div style={{ display: "flex", gap: 6 }}>
                    {PROGRESS_STEPS.map((p) => {
                      const active = item.progressRate === p;
                      return (
                        <button
                          key={p}
                          onClick={() => handleSetProgress(item.id, p)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            borderRadius: theme.radius.pill,
                            border: active ? "none" : `1px solid ${theme.colors.border}`,
                            background: active ? theme.colors.primary : "#fff",
                            color: active ? "#fff" : theme.colors.textSoft,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {p}%
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          {todayItems.length > 0 && (
            <div style={{ borderTop: `1px solid ${theme.colors.border}`, padding: 16 }}>
              {saveMsg && <p style={{ fontSize: 12, color: theme.colors.primaryDark, margin: "0 0 8px" }}>{saveMsg}</p>}
              <button onClick={handleCompleteDay} disabled={saving} style={s_btnPrimary(saving)}>
                {saving ? "저장 중..." : "오늘 학습 마무리하기"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}