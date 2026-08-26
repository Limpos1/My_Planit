import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import UploadScreen from "./screens/UploadScreen";
import SelectUnitsScreen from "./screens/SelectUnitsScreen";
import CalendarScreen from "./screens/CalendarScreen";
import AvailabilityScreen from "./screens/AvailabilityScreen";
import GeneratingScreen from "./screens/GeneratingScreen";
import { filterParsedToc, rangeMinutes } from "./lib/toc";
import { s } from "./theme";

const API_BASE = "http://localhost:8000";
const MAIN_PAGE_URL = "/"; // TODO: 팀 전체 메인페이지의 실제 경로로 교체
const WEEKDAY_KEYS = ["일", "월", "화", "수", "목", "금", "토"];

const STEP_ROUTES = [
  { path: "/upload", label: "목차 업로드" },
  { path: "/select", label: "과목 선택" },
  { path: "/calendar", label: "학습 기간" },
  { path: "/availability", label: "가용 시간" },
  { path: "/generating", label: "생성 중" },
];

function buildWeekdayMinutes({ weekdayRange, weekendRange, weekendExcluded }) {
  const weekdayMinutes = rangeMinutes(weekdayRange);
  const weekendMinutes = weekendExcluded ? 0 : rangeMinutes(weekendRange);
  const result = {};
  WEEKDAY_KEYS.forEach((name, idx) => {
    const isWeekend = idx === 0 || idx === 6;
    result[name] = isWeekend ? weekendMinutes : weekdayMinutes;
  });
  return result;
}

function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [parsedToc, setParsedToc] = useState(null);
  const [filteredToc, setFilteredToc] = useState(null);
  const [calendarInfo, setCalendarInfo] = useState(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleParsed = (data) => {
    setParsedToc(data);
    navigate("/select");
  };

  const handleUnitsSelected = (excludedKeys) => {
    setFilteredToc(filterParsedToc(parsedToc, excludedKeys));
    navigate("/calendar");
  };

  const handleCalendarNext = (info) => {
    setCalendarInfo(info);
    navigate("/availability");
  };

  const handleAvailabilityNext = async (availability) => {
    navigate("/generating");
    setError("");
    setDone(false);
    const weekdayMinutes = buildWeekdayMinutes(availability);
    const userId = localStorage.getItem("userId"); // TODO: 로그인 파트와 협의해서 실제 식별자로 교체

    try {
      const res = await fetch(`${API_BASE}/generate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parsedToc: filteredToc,
          startDate: calendarInfo.startDate,
          targetDate: calendarInfo.targetDate,
          weekdayMinutes,
          checkedDates: calendarInfo.checkedDates,
          userId,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `서버 오류 (${res.status})`);
      }
      await res.json();
      setDone(true);
      setTimeout(() => {
        window.location.href = MAIN_PAGE_URL;
      }, 1500);
    } catch (e) {
      setError(e.message || "플랜 생성 중 오류가 발생했습니다.");
      navigate("/availability");
    }
  };

  const currentStepIndex = STEP_ROUTES.findIndex((r) => r.path === location.pathname);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logoDot} />
        <span style={s.logoText}>Planit</span>
      </div>

      <div style={s.stepBar}>
        {STEP_ROUTES.map((r, i) => (
          <span key={r.path} style={s.stepPill(i === currentStepIndex)}>
            {i + 1}. {r.label}
          </span>
        ))}
      </div>

      {error && <p style={s.errorText}>{error}</p>}

      <div style={s.card}>
        <Routes>
          <Route path="/upload" element={<UploadScreen onParsed={handleParsed} />} />
          <Route
            path="/select"
            element={
              <SelectUnitsScreen parsedToc={parsedToc} onNext={handleUnitsSelected} onBack={() => navigate("/upload")} />
            }
          />
          <Route
            path="/calendar"
            element={<CalendarScreen onNext={handleCalendarNext} onBack={() => navigate("/select")} />}
          />
          <Route
            path="/availability"
            element={<AvailabilityScreen onNext={handleAvailabilityNext} onBack={() => navigate("/calendar")} />}
          />
          <Route path="/generating" element={<GeneratingScreen done={done} />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}