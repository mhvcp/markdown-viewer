import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-context.jsx";
import {
  findVCPFolders,
  listEngagements,
  saveToFolder,
} from "../drive/drive-api.js";
import { processCapture } from "./gemini-api.js";

const STATIC_CONTEXTS = [
  { id: "ops", label: "Ops" },
  { id: "brain", label: "Brain" },
  { id: "other", label: "Other" },
];

function buildFilename(context, source) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 5).replace(":", "-");
  return `${date}-${time}-${context}-${source}.md`;
}

function buildFrontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v)
      lines.push(
        `${k}: ${typeof v === "string" && v.includes(":") ? `"${v}"` : v}`,
      );
  }
  lines.push("---", "");
  return lines.join("\n");
}

function deriveAuthor(userInfo) {
  if (!userInfo) return "unknown";
  return (userInfo.given_name || userInfo.name || "")
    .split(" ")[0]
    .toLowerCase();
}

function formatSlug(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function CaptureScreen({ onOpenEditor, onOpenKanban, asSheet, onClose }) {
  const { accessToken, userInfo } = useAuth();
  const textRef = useRef(null);

  const [vcpFolders, setVcpFolders]     = useState(null);
  const [vcpError, setVcpError]         = useState(null);
  const [contexts, setContexts]         = useState(STATIC_CONTEXTS);
  const [selectedContext, setSelectedContext] = useState("other");
  const [rawText, setRawText]           = useState("");
  const [type, setType]                 = useState("note");
  const [taskTitle, setTaskTitle]       = useState("");
  const [source, setSource]             = useState("manual");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [status, setStatus]             = useState(""); // feedback line
  const [statusKind, setStatusKind]     = useState(""); // "" | "error" | "ok"

  useEffect(() => {
    findVCPFolders(accessToken)
      .then(async (folders) => {
        setVcpFolders(folders);
        if (folders.engagementsId) {
          const engagements = await listEngagements(accessToken, folders.engagementsId);
          const engCtx = engagements.map((e) => ({ id: e.name, label: formatSlug(e.name) }));
          setContexts([...engCtx, ...STATIC_CONTEXTS]);
          if (engCtx.length > 0) setSelectedContext(engCtx[0].id);
        }
      })
      .catch((err) => setVcpError(err.message));
  }, [accessToken]);

  const handleGemini = useCallback(async () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    setStatus("Processing…");
    setStatusKind("");
    try {
      const result = await processCapture(accessToken, rawText, contexts);
      setRawText(result.cleaned_content);
      if (result.suggested_context) {
        const match = contexts.find((c) => c.id === result.suggested_context);
        if (match) setSelectedContext(match.id);
      }
      if (result.suggested_type) setType(result.suggested_type);
      if (result.task_title) setTaskTitle(result.task_title);
      setSource("dictation");
      setStatus("Ready to save");
      setStatusKind("ok");
    } catch (err) {
      setStatus(err.message);
      setStatusKind("error");
    } finally {
      setIsProcessing(false);
    }
  }, [accessToken, rawText, contexts]);

  const handleSave = useCallback(async () => {
    if (!rawText.trim()) return;
    if (!vcpFolders) {
      setStatus("Inbox folder not found — check Drive setup.");
      setStatusKind("error");
      return;
    }
    setIsSaving(true);
    setStatus("Saving…");
    setStatusKind("");
    try {
      const frontmatter = buildFrontmatter({
        context: selectedContext,
        type,
        ...(type === "content+task" && taskTitle ? { task_title: taskTitle } : {}),
        author: deriveAuthor(userInfo),
        captured: new Date().toISOString(),
        source,
      });
      const filename = buildFilename(selectedContext, source);
      await saveToFolder(accessToken, vcpFolders.inboxId, filename, frontmatter + rawText);
      setRawText("");
      setTaskTitle("");
      setType("note");
      setSource("manual");
      setStatus("Saved ✓");
      setStatusKind("ok");
      if (asSheet && onClose) {
        setTimeout(onClose, 900);
      } else {
        setTimeout(() => setStatus(""), 3000);
      }
    } catch (err) {
      setStatus(`Save failed: ${err.message}`);
      setStatusKind("error");
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, rawText, vcpFolders, selectedContext, type, taskTitle, source, userInfo, asSheet, onClose]);

  const busy = isProcessing || isSaving;

  return (
    <div className="capture-shell">
      {!asSheet && (
        <header className="capture-header">
          <span className="app-title">MD</span>
          {onOpenEditor && (
            <button className="toolbar-btn" onClick={() => onOpenEditor("browse")}>
              Editor
            </button>
          )}
          {onOpenKanban && (
            <button className="toolbar-btn" onClick={onOpenKanban}>
              Board
            </button>
          )}
          {userInfo?.picture && (
            <img src={userInfo.picture} alt={userInfo.name} className="user-avatar" style={{ marginLeft: "auto" }} />
          )}
        </header>
      )}

      <div className="capture-body">
        {vcpError && <div className="capture-warning">⚠ {vcpError}</div>}

        <textarea
          ref={textRef}
          className="capture-textarea"
          value={rawText}
          onChange={(e) => { setRawText(e.target.value); setSource("manual"); setStatus(""); }}
          onPaste={() => setSource("paste")}
          placeholder="Dictate, paste, or type…"
          autoFocus
          disabled={busy}
        />

        <div className="capture-actions-row">
          <button
            className="capture-gemini-btn"
            onClick={handleGemini}
            disabled={busy || !rawText.trim()}
          >
            {isProcessing ? "Processing…" : "✨ Gemini"}
          </button>
          <button
            className="capture-save-btn"
            onClick={handleSave}
            disabled={busy || !rawText.trim() || !vcpFolders}
          >
            {isSaving ? "Saving…" : "Save to Inbox"}
          </button>
        </div>

        {status && (
          <p className={`capture-status ${statusKind}`}>{status}</p>
        )}
      </div>
    </div>
  );
}
