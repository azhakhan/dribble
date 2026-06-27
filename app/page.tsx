"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIde, type ChatMeta, type ConnectionMeta, type NotebookMeta } from "@/lib/store";
import Sidebar from "@/components/Sidebar";
import Tabs from "@/components/Tabs";
import TableTab from "@/components/TableTab";
import NotebookTab from "@/components/NotebookTab";
import ChatTab from "@/components/ChatTab";

export default function Ide() {
  const router = useRouter();
  const { tabs, activeTabId } = useIde();
  const [connections, setConnections] = useState<ConnectionMeta[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookMeta[]>([]);
  const [chats, setChats] = useState<ChatMeta[]>([]);

  const refreshConnections = useCallback(() => {
    fetch("/api/connections").then(async (r) => r.ok && setConnections(await r.json()));
  }, []);
  const refreshNotebooks = useCallback(() => {
    fetch("/api/notebooks").then(async (r) => r.ok && setNotebooks(await r.json()));
  }, []);
  const refreshChats = useCallback(() => {
    fetch("/api/chats").then(async (r) => r.ok && setChats(await r.json()));
  }, []);

  useEffect(() => {
    refreshConnections();
    refreshNotebooks();
    refreshChats();
  }, [refreshConnections, refreshNotebooks, refreshChats]);

  // Keep DB connections alive while the page is open; release them on close.
  useEffect(() => {
    const heartbeat = setInterval(() => {
      fetch("/api/db/heartbeat", { method: "POST" }).catch(() => {});
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
          connections={connections}
          notebooks={notebooks}
          chats={chats}
          refreshConnections={refreshConnections}
          refreshNotebooks={refreshNotebooks}
          refreshChats={refreshChats}
        />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <Tabs />
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--bg0)" }}>
            {tabs.length === 0 && (
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
