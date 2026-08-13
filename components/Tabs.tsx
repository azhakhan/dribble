"use client";

import React, { useEffect, useState } from "react";
import { Table2, FileCode2, MessageSquare, X } from "lucide-react";
import { useIde, type Tab } from "@/lib/store";
import { ICON_SIZE } from "./IconButton";

const KIND_ICONS: Record<Tab["kind"], React.ReactElement> = {
  table: <Table2 size={ICON_SIZE} color="var(--teal)" />,
  notebook: <FileCode2 size={ICON_SIZE} color="var(--accent)" />,
  chat: <MessageSquare size={ICON_SIZE} color="#b48ead" />,
};

const MENU_WIDTH = 180;
const MENU_HEIGHT = 210;

export default function Tabs() {
  const { tabs, activeTabId, setActive, closeTab, closeTabs, moveTab, renameTab } = useIde();
  const dirtyTabs = useIde((s) => s.dirtyTabs);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  /** Full close request awaiting confirmation because at least one tab is dirty. */
  const [confirmClose, setConfirmClose] = useState<string[] | null>(null);

  /** A multi-tab close is atomic: cancel leaves every requested tab open. */
  function requestClose(ids: string[]) {
    if (!ids.length) return;
    if (ids.some((id) => (dirtyTabs[id] ?? 0) > 0)) {
      setConfirmClose(ids);
      return;
    }
    if (ids.length === 1) closeTab(ids[0]);
    else closeTabs(ids);
  }

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);

  async function commitRename() {
    if (!renaming) return;
    const tab = tabs.find((t) => t.id === renaming.id);
    const name = renaming.value.trim();
    setRenaming(null);
    if (!tab || tab.kind === "table" || !name || name === tab.title) return;
    renameTab(tab.id, name);
    const res = await fetch(`/api/${tab.kind === "notebook" ? "notebooks" : "chats"}/${tab.resourceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) window.dispatchEvent(new Event("resources-renamed"));
  }

  if (!tabs.length) return <div style={{ height: 35, borderBottom: "1px solid var(--border)", background: "var(--bg1)" }} />;

  const menuTab = menu ? tabs.find((t) => t.id === menu.tabId) : null;
  const menuIndex = menuTab ? tabs.findIndex((t) => t.id === menuTab.id) : -1;

  return (
    <div
      className="tabstrip"
      style={{
        display: "flex",
        height: 35,
        background: "var(--bg1)",
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        overflowY: "hidden",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""} ${dropIndex === i && dragIndex !== i ? "dragover" : ""}`}
          draggable={renaming?.id !== tab.id}
          onDragStart={(e) => {
            setDragIndex(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropIndex(i);
          }}
          onDragLeave={() => setDropIndex((d) => (d === i ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIndex !== null && dragIndex !== i) moveTab(dragIndex, i);
            setDragIndex(null);
            setDropIndex(null);
          }}
          onDragEnd={() => {
            setDragIndex(null);
            setDropIndex(null);
          }}
          onClick={() => setActive(tab.id)}
          onAuxClick={(e) => {
            if (e.button === 1) requestClose([tab.id]);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setActive(tab.id);
            setMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
          }}
          title={tab.title}
        >
          <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {KIND_ICONS[tab.kind]}
          </span>
          {renaming?.id === tab.id ? (
            <input
              autoFocus
              value={renaming.value}
              onChange={(e) => setRenaming({ id: tab.id, value: e.target.value })}
              onFocus={(e) => e.target.select()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") commitRename();
                else if (e.key === "Escape") setRenaming(null);
              }}
              onBlur={commitRename}
              style={{
                padding: "1px 4px",
                fontSize: 12,
                width: 120,
                minWidth: 0,
                flexShrink: 1,
              }}
              aria-label="Rename tab"
            />
          ) : (
            <span style={{ maxWidth: 180, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1 }}>
              {tab.title}
            </span>
          )}
          <button
            className="close"
            style={{ display: "flex", alignItems: "center", flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              requestClose([tab.id]);
            }}
            aria-label="Close tab"
          >
            <X size={ICON_SIZE} />
          </button>
        </div>
      ))}
      {menu && menuTab && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu(null);
          }}
        >
          <div
            className="ctx-menu"
            style={{
              left: Math.max(0, Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8)),
              top: Math.max(0, Math.min(menu.y, window.innerHeight - MENU_HEIGHT - 8)),
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMenu(null);
            }}
          >
            {menuTab.kind !== "table" && (
              <button
                className="ctx-item"
                onClick={() => {
                  setMenu(null);
                  setRenaming({ id: menuTab.id, value: menuTab.title });
                }}
              >
                Rename
              </button>
            )}
            <button className="ctx-item" onClick={() => requestClose([menuTab.id])}>
              Close
            </button>
            <button
              className="ctx-item"
              disabled={tabs.length === 1}
              onClick={() => requestClose(tabs.filter((t) => t.id !== menuTab.id).map((t) => t.id))}
            >
              Close Others
            </button>
            <button
              className="ctx-item"
              disabled={menuIndex === tabs.length - 1}
              onClick={() => requestClose(tabs.slice(menuIndex + 1).map((t) => t.id))}
            >
              Close to the Right
            </button>
            <button className="ctx-item" onClick={() => requestClose(tabs.map((t) => t.id))}>
              Close All
            </button>
            <div className="ctx-sep" />
            <button className="ctx-item" onClick={() => navigator.clipboard.writeText(menuTab.title)}>
              Copy Name
            </button>
          </div>
        </div>
      )}
      {confirmClose && (
        <div
          onClick={() => setConfirmClose(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(8,9,12,0.7)",
            display: "grid",
            placeItems: "center",
            zIndex: 200,
          }}
        >
          <div
            className="fadeup"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 400,
              background: "var(--bg1)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600 }}>Discard unsaved changes?</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {confirmClose.filter((id) => (dirtyTabs[id] ?? 0) > 0).map((id) => {
                const t = tabs.find((t) => t.id === id);
                return (
                  <div key={id} className="mono" style={{ padding: "2px 0" }}>
                    {t?.title ?? id} — {dirtyTabs[id]} unsaved cell{dirtyTabs[id] === 1 ? "" : "s"}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirmClose(null)}>
                Cancel
              </button>
              <button
                className="btn btn-accent"
                onClick={() => {
                  closeTabs(confirmClose);
                  setConfirmClose(null);
                }}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
