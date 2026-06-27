"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useIde, type ConnectionMeta, type Tab } from "@/lib/store";
import type { QueryResult } from "@/lib/drivers/types";
import ResultsPanel from "./ResultsPanel";

interface ToolPart {
  type: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  errorText?: string;
}

function latestQueryResult(messages: UIMessage[]): QueryResult | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts ?? [];
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j] as ToolPart;
      if (p.type === "tool-run_query" && p.state === "output-available" && p.output && !("error" in p.output) && Array.isArray(p.output.columns)) {
        return p.output as unknown as QueryResult;
      }
    }
  }
  return null;
}

const TOOL_LABELS: Record<string, string> = {
  "tool-list_schemas": "listing schemas",
  "tool-list_tables": "listing tables",
  "tool-describe_table": "describing table",
  "tool-run_query": "running query",
};

function messageKey(message: UIMessage, index: number): string {
  return message.id || `${message.role}:${index}`;
}

function ToolChip({ part }: { part: ToolPart }) {
  const label = TOOL_LABELS[part.type] ?? part.type.replace("tool-", "");
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || (part.output && "error" in (part.output as object));
  const sql = typeof part.input?.sql === "string" ? part.input.sql : null;
  const detail = sql ?? (part.input && Object.keys(part.input).length ? JSON.stringify(part.input) : null);

  return (
    <details className="toolcall" style={{ margin: "4px 0" }}>
      <summary
        className="mono"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          padding: "2px 10px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--bg2)",
          color: failed ? "var(--danger)" : running ? "var(--accent)" : "var(--text-dim)",
        }}
      >
        <span className={running ? "pulse" : ""}>{running ? "●" : failed ? "✕" : "✓"}</span>
        {label}
        {part.type === "tool-run_query" && part.state === "output-available" && !failed && (
          <span style={{ color: "var(--text-faint)" }}>{(part.output as { rowCount?: number })?.rowCount ?? 0} rows</span>
        )}
      </summary>
      {detail && (
        <pre
          className="mono"
          style={{
            margin: "6px 0 2px",
            padding: "8px 10px",
            fontSize: 11.5,
            background: "var(--bg0)",
            border: "1px solid var(--border-soft)",
            borderRadius: 6,
            whiteSpace: "pre-wrap",
            color: "var(--teal)",
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {detail}
        </pre>
      )}
      {failed && (
        <pre className="mono" style={{ margin: "4px 0", fontSize: 11, color: "var(--danger)", whiteSpace: "pre-wrap" }}>
          {part.errorText ?? String((part.output as { error?: string })?.error ?? "")}
        </pre>
      )}
    </details>
  );
}

function ChatInner({
  tab,
  connections,
  initialMessages,
  initialConnectionId,
  onFirstMessage,
  onRename,
}: {
  tab: Tab;
  connections: ConnectionMeta[];
  initialMessages: UIMessage[];
  initialConnectionId: string | null;
  onFirstMessage: (text: string) => void;
  onRename: (name: string) => void;
}) {
  const [connectionId, setConnectionId] = useState<string | null>(initialConnectionId ?? connections[0]?.id ?? null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentFirst = useRef(initialMessages.length > 0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ connectionId, chatId: tab.resourceId }),
      }),
    [connectionId, tab.resourceId]
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    id: tab.resourceId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const result = latestQueryResult(messages);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  function submit() {
    const text = input.trim();
    if (!text || busy || !connectionId) return;
    setInput("");
    sendMessage({ text });
    if (!sentFirst.current) {
      sentFirst.current = true;
      if (tab.title === "New chat") onFirstMessage(text);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg1)",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "#b48ead" }}>✦</span>
        <input
          value={tab.title}
          onChange={(e) => onRename(e.target.value)}
          style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: 13, padding: "2px 4px", width: 220 }}
          aria-label="Chat name"
        />
        <select
          value={connectionId ?? ""}
          onChange={(e) => setConnectionId(e.target.value || null)}
          style={{ fontSize: 12, padding: "2px 6px", marginLeft: "auto" }}
        >
          <option value="" disabled>
            connection…
          </option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.database}
            </option>
          ))}
        </select>
      </div>

      {/* messages */}
      <div ref={scrollRef} style={{ flex: "1 1 55%", minHeight: 0, overflowY: "auto", padding: "14px 18px" }}>
        {messages.length === 0 && (
          <div style={{ color: "var(--text-faint)", textAlign: "center", marginTop: 60, lineHeight: 1.8 }}>
            Ask anything about your data.
            <br />
            <span style={{ fontSize: 12 }}>The agent explores the schema, runs SQL, and iterates until it has an answer.</span>
          </div>
        )}
        {messages.map((m, messageIndex) => (
          <div key={messageKey(m, messageIndex)} className="fadeup" style={{ marginBottom: 14 }}>
            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: "0.1em", color: m.role === "user" ? "var(--accent)" : "#b48ead", marginBottom: 4 }}
            >
              {m.role === "user" ? "YOU" : "AGENT"}
            </div>
            {(m.parts ?? []).map((part, i) => {
              const partKey = `${messageKey(m, messageIndex)}:${part.type}:${i}`;
              if (part.type === "text") {
                return (
                  <div key={partKey} style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, maxWidth: 760 }}>
                    {part.text}
                  </div>
                );
              }
              if (part.type === "reasoning") {
                return (
                  <div key={partKey} style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: 12, whiteSpace: "pre-wrap" }}>
                    {(part as { text?: string }).text}
                  </div>
                );
              }
              if (part.type.startsWith("tool-")) {
                return <ToolChip key={partKey} part={part as ToolPart} />;
              }
              return null;
            })}
          </div>
        ))}
        {busy && (
          <div className="pulse mono" style={{ color: "#b48ead", fontSize: 11 }}>
            ● thinking…
          </div>
        )}
        {error && (
          <div className="mono" style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap" }}>
            {error.message}
          </div>
        )}
      </div>

      {/* input */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", background: "var(--bg1)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            rows={2}
            placeholder={connectionId ? "e.g. Which customers churned last month, and what did they have in common?" : "Pick a connection first…"}
            value={input}
            disabled={!connectionId}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            style={{ flex: 1, resize: "none", fontSize: 13, lineHeight: 1.5 }}
          />
          {busy ? (
            <button className="btn" onClick={() => stop()}>
              ■ Stop
            </button>
          ) : (
            <button className="btn btn-accent" onClick={submit} disabled={!input.trim() || !connectionId}>
              Send
            </button>
          )}
        </div>
      </div>

      {/* shared results panel — last query the agent ran */}
      <div style={{ flex: "1 1 45%", minHeight: 120, borderTop: "1px solid var(--border)" }}>
        <ResultsPanel result={result} error={null} running={false} emptyHint="The agent's final query results appear here" />
      </div>
    </div>
  );
}

export default function ChatTab({ tab, connections, onRenamed }: { tab: Tab; connections: ConnectionMeta[]; onRenamed: () => void }) {
  const renameTab = useIde((s) => s.renameTab);
  const [loaded, setLoaded] = useState<{ messages: UIMessage[]; connectionId: string | null } | null>(null);
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/chats/${tab.resourceId}`);
      if (res.ok) {
        const chat = await res.json();
        setLoaded({ messages: Array.isArray(chat.messages) ? chat.messages : [], connectionId: chat.connection_id });
      } else {
        setLoaded({ messages: [], connectionId: null });
      }
    })();
  }, [tab.resourceId]);

  const persistName = useCallback(
    (name: string) => {
      renameTab(tab.id, name);
      if (renameTimer.current) clearTimeout(renameTimer.current);
      renameTimer.current = setTimeout(() => {
        fetch(`/api/chats/${tab.resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).then(onRenamed);
      }, 600);
    },
    [onRenamed, renameTab, tab.id, tab.resourceId]
  );

  if (!loaded) {
    return <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-faint)" }}>loading…</div>;
  }

  return (
    <ChatInner
      tab={tab}
      connections={connections}
      initialMessages={loaded.messages}
      initialConnectionId={loaded.connectionId}
      onRename={persistName}
      onFirstMessage={(text) => {
        const title = text.length > 40 ? text.slice(0, 40) + "…" : text;
        persistName(title);
      }}
    />
  );
}
