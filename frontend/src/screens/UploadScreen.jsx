import { useState } from "react";
import { s, theme } from "../theme";

const API_BASE = "http://localhost:8000";

export default function UploadScreen({ onParsed }) {
  const [files, setFiles] = useState([]);
  const [fileKind, setFileKind] = useState("image");
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
      <span style={s.tag}>📷 목차 업로드</span>
      <h2 style={s.title}>목차 사진 한 장이면 충분해요</h2>
      <p style={s.subtitle}>책 목차 사진(여러 장 가능) 또는 PDF 파일을 업로드하세요.</p>

      <div
        style={{
          border: `1.5px dashed ${theme.colors.border}`,
          borderRadius: theme.radius.md,
          padding: 24,
          textAlign: "center",
          marginBottom: 16,
          background: "#FBF9FE",
        }}
      >
        <input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />
      </div>

      {files.length > 0 && (
        <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
          {files.map((f, i) => (
            <li
              key={i}
              style={{
                fontSize: 13,
                color: theme.colors.textSoft,
                padding: "6px 0",
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              {f.name}
            </li>
          ))}
        </ul>
      )}
      {fileKind === "image" && files.length > 1 && (
        <p style={{ ...s.subtitle, marginBottom: 16 }}>
          사진 {files.length}장을 하나의 목차로 이어서 분석합니다.
        </p>
      )}

      <div style={s.btnRow}>
        <button onClick={handleUpload} disabled={loading} style={s.btnPrimary(loading)}>
          {loading ? "분석 중..." : "업로드 및 분석"}
        </button>
      </div>

      {error && <p style={s.errorText}>{error}</p>}
    </div>
  );
}