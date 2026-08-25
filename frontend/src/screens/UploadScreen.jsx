import { useState } from "react";

const API_BASE = "http://localhost:8000";

export default function UploadScreen({ onParsed }) {
  const [files, setFiles] = useState([]);
  const [fileKind, setFileKind] = useState("image");
  const [totalPages, setTotalPages] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    setError("");
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("파일을 먼저 선택해주세요.");
      return;
    }
    setLoading(true);
    setError("");

    const formData = new FormData();
    if (fileKind === "pdf") {
      formData.append("file", files[0]);
    } else {
      files.forEach((f) => formData.append("files", f));
    }
    if (totalPages) formData.append("total_pages", totalPages);

    const endpoint = fileKind === "pdf" ? "/parse-toc/pdf" : "/parse-toc/image";

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: formData });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error("목차를 찾지 못했어요. 다른 사진/파일로 시도해주세요.");
      }
      onParsed(data);
    } catch (e) {
      setError(e.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>1. 목차 업로드</h2>
      <p>책 목차 사진(여러 장 가능) 또는 PDF 파일을 업로드하세요.</p>

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

        <button onClick={handleUpload} disabled={loading} style={{ width: 160, padding: "8px 0" }}>
          {loading ? "분석 중..." : "업로드 및 분석"}
        </button>
      </div>

      {error && <p style={{ color: "crimson", fontWeight: "bold" }}>{error}</p>}
    </div>
  );
}