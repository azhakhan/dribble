"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useIde, type ChatMeta, type ConnectionMeta, type NotebookMeta } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import Tabs from "@/components/Tabs";
import TableTab from "@/components/TableTab";
import NotebookTab from "@/components/NotebookTab";
import ChatTab from "@/components/ChatTab";
import DragHandle from "@/components/DragHandle";

const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 620;

export default function Ide() {
  const router = useRouter();
  const { tabs, activeTabId } = useIde();
  const hydrated = useIde((s) => s.hydrated);
  const hydrate = useIde((s) => s.hydrate);
  const sidebarWidth = useIde((s) => s.layout.sidebarWidth);
  const setSidebarWidth = useIde((s) => s.setSidebarWidth);
  const sidebarStart = useRef(0);
  const [connections, setConnections] = useState<ConnectionMeta[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [serverConnected, setServerConnected] = useState<string[]>([]);

  const refreshConnections = useCallback(() => {
    fetch("/api/connections").then(async (r) => r.ok && setConnections(await r.json()));
  }, []);
  const refreshStatus = useCallback(() => {
    fetch("/api/db/status").then(async (r) => {
      if (r.ok) setServerConnected((await r.json()).connected ?? []);
    });
  }, []);

  // A connection counts as "connected" if the server holds a live driver, or if
  // an open table tab is actively using it (instant, before the next poll).
  const connectedIds = useMemo(() => {
    const ids = new Set(serverConnected);
    for (const t of tabs) if (t.kind === "table" && t.connectionId) ids.add(t.connectionId);
    return ids;
  }, [serverConnected, tabs]);

  // Connections the heartbeat should keep warm: those used by any open tab.
  // Everything else (e.g. opened only to browse schemas) is left to idle out.
  const activeConnIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of tabs) if (t.connectionId) ids.add(t.connectionId);
    return [...ids];
  }, [tabs]);
  const activeConnRef = useRef<string[]>(activeConnIds);
  useEffect(() => {
    activeConnRef.current = activeConnIds;
  }, [activeConnIds]);
  const refreshNotebooks = useCallback(() => {
    fetch("/api/notebooks").then(async (r) => r.ok && setNotebooks(await r.json()));
  }, []);
  const refreshChats = useCallback(() => {
    fetch("/api/chats").then(async (r) => r.ok && setChats(await r.json()));
  }, []);

  useEffect(() => {
    hydrate();
    refreshConnections();
    refreshNotebooks();
    refreshChats();
  }, [hydrate, refreshConnections, refreshNotebooks, refreshChats]);

  // Poll which connections are live so the sidebar dot reflects reality.
  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 8000);
    return () => clearInterval(id);
  }, [refreshStatus]);
  useEffect(() => {
    refreshStatus();
  }, [tabs, refreshStatus]);

  // Keep DB connections alive while the page is open; release them on close.
  useEffect(() => {
    const heartbeat = setInterval(() => {
      fetch("/api/db/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: activeConnRef.current }),
      }).catch(() => {});
    }, 25_000);
    const onPageHide = (e: PageTransitionEvent) => {
      // Only release DB connections when the page is actually going away,
      // not when it is being put into the back/forward cache or tab-switched.
      if (!e.persisted) navigator.sendBeacon("/api/db/disconnect");
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 38,
          padding: "0 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg1)",
          flexShrink: 0,
        }}
      >
        <Image src="/logo.png" alt="dbide" width={20} height={20} style={{ display: "block" }} unoptimized />
        <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
          {connections.length} connection{connections.length === 1 ? "" : "s"}
        </span>
        <button className="btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={logout}>
          Lock
        </button>
      </div>

      {/* main area: tree on the left + editor column */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          width={sidebarWidth}
          connections={connections}
          notebooks={notebooks}
          chats={chats}
          connectedIds={connectedIds}
          refreshConnections={refreshConnections}
          refreshNotebooks={refreshNotebooks}
          refreshChats={refreshChats}
        />
        <DragHandle
          orientation="vertical"
          onDragStart={() => {
            sidebarStart.current = sidebarWidth;
          }}
          onDrag={(dx) =>
            setSidebarWidth(Math.min(Math.max(sidebarStart.current + dx, SIDEBAR_MIN), SIDEBAR_MAX))
          }
        />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <Tabs />
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--bg0)" }}>
            {hydrated && tabs.length === 0 && (
              <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-faint)", lineHeight: 2 }}>
                <div style={{ textAlign: "center" }}>
                  <div className="mono" style={{ fontSize: 30, opacity: 0.35, marginBottom: 8 }}>
                    ▦ ❯_ ✦
                  </div>
                  Double-click a table, or create a query / chat from the panel on the left.
                </div>
              </div>
            )}
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{
                  position: "absolute",
                  inset: 0,
                  display: tab.id === activeTabId ? "flex" : "none",
                  flexDirection: "column",
                }}
              >
                {tab.kind === "table" && <TableTab tab={tab} />}
                {tab.kind === "notebook" && <NotebookTab tab={tab} connections={connections} onRenamed={refreshNotebooks} />}
                {tab.kind === "chat" && <ChatTab tab={tab} connections={connections} onRenamed={refreshChats} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* status bar */}
      <div
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          height: 24,
          padding: "0 12px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg1)",
          fontSize: 10.5,
          color: "var(--text-faint)",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--green)" }}>●</span>
        <span>postgres</span>
        <span style={{ marginLeft: "auto" }}>{tabs.length} tab{tabs.length === 1 ? "" : "s"} open</span>
      </div>
    </div>
  );
}
