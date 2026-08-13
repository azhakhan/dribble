"use client";

import { useRef, useState } from "react";
import { GridCellKind } from "@glideapps/glide-data-grid";
import type {
  GridCell,
  ProvideEditorCallbackResult,
  ProvideEditorComponent,
} from "@glideapps/glide-data-grid";

/**
 * Staged values are always `string | null` (Postgres casts per column type), but a
 * Text cell's data must be a string — so select editors encode NULL with this
 * sentinel, which `ResultsGrid` maps back to `null` on commit. A NUL byte can't
 * collide with real data.
 */
export const NULL_SENTINEL = "\u0000NULL";

export interface SelectOption {
  label: string;
  /** `NULL_SENTINEL` stands for SQL NULL. */
  value: string;
}

/** Dropdown-style editor for boolean and enum columns (DataGrip-like). */
export function makeSelectEditor(
  options: SelectOption[],
): NonNullable<ProvideEditorCallbackResult<GridCell>> {
  const Editor: ProvideEditorComponent<GridCell> = (props) => {
    const { onFinishedEditing } = props;
    if (props.value.kind !== GridCellKind.Text) return null;
    const value = props.value;
    const commit = (v: string) => onFinishedEditing({ ...value, data: v });
    const move = (dir: 1 | -1) => {
      const el = document.activeElement as HTMLElement | null;
      const items = Array.from(el?.parentElement?.children ?? []) as HTMLElement[];
      const idx = items.indexOf(el as HTMLElement);
      items[(idx + dir + items.length) % items.length]?.focus();
    };
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 140,
          padding: 4,
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--bg2)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          fontSize: 12,
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") onFinishedEditing();
          else if (e.key === "ArrowDown") move(1);
          else if (e.key === "ArrowUp") move(-1);
        }}
      >
        {options.map((o, i) => (
          <button
            key={o.label}
            autoFocus={o.value === value.data || (i === 0 && !options.some((x) => x.value === value.data))}
            className="mono"
            onClick={() => commit(o.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(o.value);
            }}
            style={{
              textAlign: "left",
              padding: "4px 8px",
              borderRadius: 4,
              fontSize: 12,
              color: o.value === NULL_SENTINEL ? "var(--text-faint)" : "var(--text-dim)",
              background: o.value === value.data ? "var(--accent-dim)" : undefined,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg1)")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = o.value === value.data ? "var(--accent-dim)" : "")
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    );
  };
  return Object.assign(Editor, { disablePadding: true });
}

/** Date (`date`) / datetime (`timestamp`, `timestamptz`) picker editor. */
export function makeDateEditor(
  withTime: boolean,
  timezoneAware = false,
): NonNullable<ProvideEditorCallbackResult<GridCell>> {
  const Editor: ProvideEditorComponent<GridCell> = (props) => {
    const { onChange, onFinishedEditing } = props;
    const value = props.value.kind === GridCellKind.Text ? props.value : null;
    const original = useRef(value?.data ?? "").current;
    const initialInput = useRef(
      withTime
        ? (original.replace(" ", "T").match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?/)?.[0] ?? "")
        : original.slice(0, 10),
    ).current;
    const [v, setV] = useState(initialInput);
    if (!value) return null;

    const editedData = (next: string) => {
      if (next === initialInput) return original;
      if (!withTime || !timezoneAware || !next) return next;
      // Table results expose timestamptz values in UTC. Keep the edited instant
      // explicit instead of letting PostgreSQL reinterpret a timezone-less value.
      const utc = new Date(`${next}Z`);
      return Number.isNaN(utc.getTime()) ? next : utc.toISOString();
    };
    return (
      <input
        autoFocus
        type={withTime ? "datetime-local" : "date"}
        value={v}
        step={withTime ? "0.001" : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setV(next);
          onChange({ ...value, data: editedData(next) });
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            if (v === initialInput) onFinishedEditing();
            else onFinishedEditing({ ...value, data: editedData(v) });
          }
          else if (e.key === "Escape") onFinishedEditing();
        }}
        style={{
          width: "100%",
          height: "100%",
          padding: "0 8px",
          fontSize: 12,
          fontFamily: "Roboto Mono, Consolas, monospace",
          colorScheme: "dark",
        }}
      />
    );
  };
  return Editor;
}
