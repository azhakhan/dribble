"use client";

import React, { useState } from "react";
import { Table2, FileCode2, MessageSquare, X } from "lucide-react";
import { useIde, type Tab } from "@/lib/store";
import { ICON_SIZE } from "./IconButton";

const KIND_ICONS: Record<Tab["kind"], React.ReactElement> = {
  table: <Table2 size={ICON_SIZE} color="var(--teal)" />,
  notebook: <FileCode2 size={ICON_SIZE} color="var(--accent)" />,
  chat: <MessageSquare size={ICON_SIZE} color="#b48ead" />,
};

export default function Tabs() {
  const { tabs, activeTabId, setActive, closeTab, moveTab } = useIde();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  if (!tabs.length) return <div style={{ height: 35, borderBottom: "1px solid var(--border)", background: "var(--bg1)" }} />;

  return (
    <div
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
          draggable
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
            if (e.button === 1) closeTab(tab.id);
          }}
          title={tab.title}
        >
          <span style={{ display: "flex", alignItems: "center" }}>
            {KIND_ICONS[tab.kind]}
          </span>
          <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{tab.title}</span>
          <button
            className="close"
            style={{ display: "flex", alignItems: "center" }}
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            aria-label="Close tab"
          >
            <X size={ICON_SIZE} />
          </button>
        </div>
      ))}
    </div>
  );
}
