"use client";

import { Loader2 } from "lucide-react";
import { ICON_SIZE } from "./IconButton";

/** A spinning loader icon, used everywhere something is running/loading/exporting. */
export default function Spinner({ size = ICON_SIZE, color }: { size?: number; color?: string }) {
  return <Loader2 size={size} className="spin" color={color} style={{ flexShrink: 0 }} />;
}
