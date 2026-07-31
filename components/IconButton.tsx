"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/** Every icon in the app renders from lucide-react at this size. */
export const ICON_SIZE = 9;
/** Inline status icons sitting next to small (10-11px) text. */
export const SMALL_ICON_SIZE = 8;

interface Props {
  icon: ReactNode;
  title: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  spin?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** A ghost button that renders a single icon, used for tree-row and toolbar actions. */
export default function IconButton({ icon, title, onClick, disabled, spin, className = "btn-ghost", style }: Props) {
  return (
    <button
      type="button"
      className={className}
      style={{ display: "flex", alignItems: "center", padding: "3px 6px", borderRadius: 3, ...style }}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={spin ? "spin" : undefined} style={{ display: "flex" }}>
        {icon}
      </span>
    </button>
  );
}
