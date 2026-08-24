import { useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [files, setFiles] = useState([]); // 이미지는 여러 장, PDF는 1개만 담김
  const [fileKind, setFileKind] = useState("image"); // "image" | "pdf"
  const [totalPages, setTotalPages] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    const hasPdf = selected.some((f) => f.type === "application/pdf");
    if (hasPdf) {
      setFiles([selected[0]]);
      setFileKind("pdf");
    } else {
      setFiles(selected);
      setFileKind("image");
    }
    setResult(null);
    setError("");
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("파일을 먼저 선택해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    if (fileKind === "pdf") {
      formData.append("file", files[0]);
    } else {
      files.forEach((f) => formData.append("files", f));
    }
    if (totalPages) {
      formData.append("total_pages", totalPages);
    }

    const endpoint = fileKind === "pdf" ? "/parse-toc/pdf" : "/parse-toc/image";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <h1>Planit 목차 파싱</h1>
      <p>
        책 목차 사진(여러 장 가능) 또는 PDF 파일을 업로드하면 챕터/페이지 목록을 자동으로 추출합니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />

        {files.length > 0 && (
          <ul style={{ margin: 0, color: "#555" }}>
            {files.map((f, i) => (
              <li key={i}>{f.name}</li>
            ))}
          </ul>
        )}
        {fileKind === "image" && files.length > 1 && (
          <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
            사진 {files.length}장을 하나의 목차로 이어서 분석합니다.
          </p>
        )}

        <label>
          책 전체 페이지 수 (선택, 마지막 챕터 endPage 계산에 사용됨):{" "}
          <input
            type="number"
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            placeholder="예: 350"
            style={{ width: 100 }}
          />
        </label>

        <button onClick={handleUpload} disabled={loading} style={{ width: 160, padding: "8px 0" }}>
          {loading ? "분석 중..." : "업로드 및 분석"}
        </button>
      </div>

      {error && (
        <p style={{ color: "crimson", fontWeight: "bold" }}>{error}</p>
      )}

      {result && (
        <div>
          <h2>파싱 결과</h2>
          {result.error && <p style={{ color: "crimson" }}>{result.error}</p>}
          {result.chapters?.map((chapter) => (
            <div key={chapter.order} style={{ border: "1px solid #ccc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <strong>{chapter.title}</strong>
              {" "}
              <span style={{ color: "#888" }}>
                ({chapter.contentType}
                {chapter.startPage != null ? `, ${chapter.startPage}p ~ ${chapter.endPage ?? "?"}p` : ""})
              </span>

              {chapter.subunits?.length > 0 && (
                <ul>
                  {chapter.subunits.map((sub) => (
                    <li key={sub.order}>
                      {sub.title}
                      {" "}
                      {sub.startPage != null && (
                        <span style={{ color: "#888" }}>
                          ({sub.startPage}p ~ {sub.endPage ?? "?"}p
                          {sub.needsFallback && ", 확인 필요"})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;