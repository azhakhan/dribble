"use client";

import React, { useRef } from "react";

/**
 * A thin draggable divider. Reports the cumulative pixel delta from where the
 * drag started; the parent decides what that means (width, height, fraction…).
 *
 * orientation "vertical"  → a vertical bar, drag left/right (delta = dx).
 * orientation "horizontal" → a horizontal bar, drag up/down (delta = dy).
 */
export default function DragHandle({
  orientation,
  onDragStart,
  onDrag,
  onDragEnd,
  style,
}: {
  orientation: "vertical" | "horizontal";
  onDragStart?: () => void;
  onDrag: (delta: number) => void;
  onDragEnd?: () => void;
  style?: React.CSSProperties;
}) {
  const start = useRef(0);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    start.current = orientation === "vertical" ? e.clientX : e.clientY;
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
    onDragStart?.();

    const move = (ev: PointerEvent) => {
      const cur = orientation === "vertical" ? ev.clientX : ev.clientY;
      onDrag(cur - start.current);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onDragEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const base: React.CSSProperties =
    orientation === "vertical"
      ? { width: 6, alignSelf: "stretch", cursor: "col-resize" }
      : { height: 6, width: "100%", cursor: "row-resize" };

  return (
    <div
      className="drag-handle"
      onPointerDown={onPointerDown}
      style={{ flexShrink: 0, ...base, ...style }}
    />
  );
}
