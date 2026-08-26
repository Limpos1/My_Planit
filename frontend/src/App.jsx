import { useState } from "react";
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
const STEP_LABELS = ["목차 업로드", "과목 선택", "학습 기간", "가용 시간", "생성 중"];

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

export default function App() {
  const [step, setStep] = useState(1);
  const [parsedToc, setParsedToc] = useState(null);
  const [filteredToc, setFilteredToc] = useState(null);
  const [calendarInfo, setCalendarInfo] = useState(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleParsed = (data) => {
    setParsedToc(data);
    setStep(2);
  };

  const handleUnitsSelected = (excludedKeys) => {
    setFilteredToc(filterParsedToc(parsedToc, excludedKeys));
    setStep(3);
  };

  const handleCalendarNext = (info) => {
    setCalendarInfo(info);
    setStep(4);
  };

  const handleAvailabilityNext = async (availability) => {
    setStep(5);
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
      // 완료 메시지를 잠깐 보여준 뒤, 팀 전체 메인페이지로 완전히 이동
      setTimeout(() => {
        window.location.href = MAIN_PAGE_URL;
      }, 1500);
    } catch (e) {
      setError(e.message || "플랜 생성 중 오류가 발생했습니다.");
      setStep(4);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <span style={s.logoDot} />
        <span style={s.logoText}>Planit</span>
      </div>

      <div style={s.stepBar}>
        {STEP_LABELS.map((label, i) => (
          <span key={label} style={s.stepPill(step === i + 1)}>
            {i + 1}. {label}
          </span>
        ))}
      </div>

      {error && <p style={s.errorText}>{error}</p>}

      <div style={s.card}>
        {step === 1 && <UploadScreen onParsed={handleParsed} />}
        {step === 2 && (
          <SelectUnitsScreen parsedToc={parsedToc} onNext={handleUnitsSelected} onBack={() => setStep(1)} />
        )}
        {step === 3 && <CalendarScreen onNext={handleCalendarNext} onBack={() => setStep(2)} />}
        {step === 4 && <AvailabilityScreen onNext={handleAvailabilityNext} onBack={() => setStep(3)} />}
        {step === 5 && <GeneratingScreen done={done} />}
      </div>
    </div>
  );
}