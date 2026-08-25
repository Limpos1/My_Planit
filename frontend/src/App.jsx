import { useState } from "react";
import UploadScreen from "./screens/UploadScreen";
import SelectUnitsScreen from "./screens/SelectUnitsScreen";
import CalendarScreen from "./screens/CalendarScreen";
import AvailabilityScreen from "./screens/AvailabilityScreen";
import GeneratingScreen from "./screens/GeneratingScreen";
import MainScreen from "./screens/MainScreen";
import { filterParsedToc, rangeMinutes } from "./lib/toc";

const API_BASE = "http://localhost:8000";
const WEEKDAY_KEYS = ["일", "월", "화", "수", "목", "금", "토"]; // JS Date.getDay(): 0=일

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
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  const restart = () => {
    setStep(1);
    setParsedToc(null);
    setFilteredToc(null);
    setCalendarInfo(null);
    setPlan(null);
    setError("");
  };

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
    setPlan(null);
    const weekdayMinutes = buildWeekdayMinutes(availability);

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
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      setPlan(data);
      // 완료 메시지를 잠깐 보여준 뒤 메인페이지(달력)로 자동 이동
      setTimeout(() => setStep(6), 1500);
    } catch (e) {
      setError(e.message || "플랜 생성 중 오류가 발생했습니다.");
      setStep(4);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>Planit</h1>
      <p style={{ color: "#888", marginBottom: 24 }}>단계 {Math.min(step, 6)} / 6</p>

      {error && <p style={{ color: "crimson", fontWeight: "bold" }}>{error}</p>}

      {step === 1 && <UploadScreen onParsed={handleParsed} />}
      {step === 2 && (
        <SelectUnitsScreen parsedToc={parsedToc} onNext={handleUnitsSelected} onBack={() => setStep(1)} />
      )}
      {step === 3 && <CalendarScreen onNext={handleCalendarNext} onBack={() => setStep(2)} />}
      {step === 4 && <AvailabilityScreen onNext={handleAvailabilityNext} onBack={() => setStep(3)} />}
      {step === 5 && <GeneratingScreen done={!!plan} />}
      {step === 6 && <MainScreen plan={plan} onRestart={restart} />}
    </div>
  );
}