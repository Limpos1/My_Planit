export default function GeneratingScreen({ done }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      {done ? (
        <>
          <h2>✅ 플랜이 완성됐어요!</h2>
          <p style={{ color: "#888" }}>잠시 후 메인페이지로 이동합니다...</p>
        </>
      ) : (
        <>
          <h2>플랜을 생성하고 있어요...</h2>
          <p style={{ color: "#888" }}>선택하신 과목과 기간에 맞춰 학습 분량을 나누고 있습니다.</p>
        </>
      )}
    </div>
  );
}