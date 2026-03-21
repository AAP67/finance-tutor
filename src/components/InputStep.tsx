"use client";

import { useState, useRef } from "react";

interface FileData {
  name: string;
  type: string;
  size: number;
  preview: string | null;
  base64: string;
  mediaType: string;
}

export interface SubmitPayload {
  subject: string;
  question: string;
  files: FileData[];
  mode: "solve" | "guide";
}

interface Props {
  onSubmit: (payload: SubmitPayload) => void;
}

const SUBJECTS = [
  { id: "gmat", label: "GMAT Quant", icon: "∑" },
  { id: "cfa", label: "CFA", icon: "δ" },
  { id: "finance", label: "General Finance", icon: "¥" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export default function InputStep({ onSubmit }: Props) {
  const [subject, setSubject] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [files, setFiles] = useState<FileData[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [mode, setMode] = useState<"solve" | "guide">("solve");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (fileList: FileList) => {
    const newFiles: FileData[] = [];
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue;
      if (file.size > MAX_FILE_SIZE) continue;
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(file);
      });
      const preview = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        preview,
        base64,
        mediaType: file.type,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const canSubmit = subject && (question.trim() || files.length > 0);

  const handleSubmit = () => {
    if (!canSubmit || !subject) return;
    onSubmit({ subject, question, files, mode });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <>
      {/* Subject Picker */}
      <div className="label">Subject</div>
      <div style={{ display: "flex", gap: 10, marginBottom: 28, animation: "fd 0.5s ease-out 0.08s both" }}>
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubject(s.id)}
            style={{
              flex: 1,
              background: subject === s.id ? "var(--bg-hover)" : "var(--bg-card)",
              border: `1.5px solid ${subject === s.id ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 10,
              padding: "14px 10px",
              cursor: "pointer",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
              transition: "all 0.2s",
              boxShadow: subject === s.id ? "0 0 20px rgba(226,192,102,0.07)" : "none",
            }}
          >
            <div style={{
              fontSize: 20,
              color: subject === s.id ? "var(--gold)" : "var(--text-dim)",
              fontFamily: "'Cormorant Garamond', serif",
              transition: "color 0.2s",
            }}>{s.icon}</div>
            <div style={{
              fontSize: 12,
              color: subject === s.id ? "var(--text-bright)" : "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
              transition: "color 0.2s",
            }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Question Text Area */}
      <div style={{ marginBottom: 22, animation: "fd 0.5s ease-out 0.16s both" }}>
        <div className="label">Your Question</div>
        <textarea
          placeholder="Paste or type your finance question here..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{
            width: "100%",
            minHeight: 130,
            background: "var(--bg-card)",
            border: "1.5px solid var(--border)",
            borderRadius: 10,
            padding: 14,
            color: "var(--text-bright)",
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = "var(--gold-dim)"}
          onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
        />
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: 28, animation: "fd 0.5s ease-out 0.24s both" }}>
        <div className="label">Attachments (optional)</div>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `1.5px dashed ${dragOver ? "var(--gold-dim)" : "var(--border)"}`,
            borderRadius: 10,
            padding: 22,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            background: dragOver ? "rgba(226,192,102,0.02)" : "transparent",
          }}
        >
          <div style={{ fontSize: 22, color: "var(--text-dim)", marginBottom: 6 }}>↑</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            Drop files or <span style={{ color: "var(--gold-dim)", textDecoration: "underline", textUnderlineOffset: 2 }}>browse</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", opacity: 0.5, marginTop: 5 }}>
            PNG, JPG, PDF · Max 10MB
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "7px 10px",
                maxWidth: 220,
              }}>
                {f.preview ? (
                  <img src={f.preview} alt="" style={{ width: 30, height: 30, borderRadius: 4, objectFit: "cover" }} />
                ) : (
                  <div style={{
                    width: 30, height: 30, borderRadius: 4,
                    background: "var(--bg-hover)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, color: "var(--danger)", fontWeight: 500,
                  }}>PDF</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize: 9, color: "var(--text-dim)" }}>{formatSize(f.size)}</div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  style={{
                    background: "none", border: "none", color: "var(--text-dim)",
                    cursor: "pointer", fontSize: 15, padding: 2, lineHeight: 1,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      <div style={{ marginBottom: 22, animation: "fd 0.5s ease-out 0.28s both" }}>
        <div className="label">Tutor Mode</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setMode("solve")}
            style={{
              flex: 1,
              background: mode === "solve" ? "var(--bg-hover)" : "var(--bg-card)",
              border: `1.5px solid ${mode === "solve" ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 10,
              padding: "12px 10px",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
              boxShadow: mode === "solve" ? "0 0 20px rgba(226,192,102,0.07)" : "none",
            }}
          >
            <div style={{
              fontSize: 15,
              color: mode === "solve" ? "var(--gold)" : "var(--text-dim)",
              marginBottom: 4,
            }}>⚡</div>
            <div style={{
              fontSize: 11,
              color: mode === "solve" ? "var(--text-bright)" : "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
            }}>Solve for me</div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>
              Full solution immediately
            </div>
          </button>
          <button
            onClick={() => setMode("guide")}
            style={{
              flex: 1,
              background: mode === "guide" ? "var(--bg-hover)" : "var(--bg-card)",
              border: `1.5px solid ${mode === "guide" ? "var(--gold)" : "var(--border)"}`,
              borderRadius: 10,
              padding: "12px 10px",
              cursor: "pointer",
              textAlign: "center",
              transition: "all 0.2s",
              boxShadow: mode === "guide" ? "0 0 20px rgba(226,192,102,0.07)" : "none",
            }}
          >
            <div style={{
              fontSize: 15,
              color: mode === "guide" ? "var(--gold)" : "var(--text-dim)",
              marginBottom: 4,
            }}>🧭</div>
            <div style={{
              fontSize: 11,
              color: mode === "guide" ? "var(--text-bright)" : "var(--text-dim)",
              fontFamily: "'DM Mono', monospace",
            }}>Guide me</div>
            <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 3 }}>
              Step-by-step hints
            </div>
          </button>
        </div>
      </div>

      {/* Submit */}
      <div style={{ animation: "fd 0.5s ease-out 0.32s both" }}>
        <button
          disabled={!canSubmit}
          onClick={handleSubmit}
          style={{
            width: "100%",
            padding: 15,
            background: canSubmit ? "var(--gold)" : "var(--gold)",
            color: "var(--bg-deep)",
            border: "none",
            borderRadius: 10,
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 500,
            cursor: canSubmit ? "pointer" : "not-allowed",
            letterSpacing: 1,
            textTransform: "uppercase" as const,
            opacity: canSubmit ? 1 : 0.25,
            transition: "all 0.2s",
          }}
        >
          Analyze & Estimate Cost →
        </button>
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-dim)", marginTop: 8, opacity: 0.5 }}>
          {!subject
            ? "Select a subject to continue"
            : !question.trim() && files.length === 0
            ? "Enter a question or upload a file"
            : "Ready to classify"}
        </div>
      </div>
    </>
  );
}