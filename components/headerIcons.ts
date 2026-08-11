import type { SpriteMap } from "@glideapps/glide-data-grid";
import type { ColumnCategory } from "@/lib/columns";

/**
 * Header icons for the results grid: a glyph per column type, optionally paired
 * with a key glyph beside it.
 *
 * glide-data-grid rasterises these itself, so each entry has to hand back a
 * complete SVG *string* — it can't take a React component. All glyphs are
 * lucide's, matching the icons used elsewhere in the app.
 *
 * The grid only offers one icon slot per header and always draws it into a
 * square, so "type + key side by side" has to be baked into a single sprite:
 * a wide-enough viewBox holding two 24×24 lucide glyphs, which the square box
 * then scales down. Columns without a key leave the second slot empty, so every
 * column title still starts at the same x.
 */

/** Step between glyph slots inside the sprite's viewBox. */
const SLOT = 22;
/** Sprite viewBox: two slots wide, square so the grid's scaling stays uniform. */
const BOX = SLOT + 24;
/** Vertical inset that centres a 24-tall glyph in the square box. */
const TOP = (BOX - 24) / 2;

/**
 * Size of the square the sprite is drawn into — mirrored into
 * `GRID_THEME.headerIconSize`. Each glyph lands at `24 / BOX * SIZE` ≈ 12.5px,
 * and the title indent (`ceil(SIZE * 1.3)`) is unchanged from a bare 18px icon.
 */
export const HEADER_ICON_SIZE = 18;

/** One step darker than `GRID_THEME.textHeader`, so icons read below the title. */
const ICON_COLOR = "#838b9a";

/** Matches `GRID_THEME.accentColor` — marks the header's active sort direction. */
const ACTIVE_COLOR = "#e8a14c";

/** Matches `--green` — flashed briefly after a column name is copied. */
const SUCCESS_COLOR = "#7fb069";

/** lucide glyph bodies, 24×24 viewBox. */
const GLYPH: Record<ColumnCategory, string> = {
  // hash
  number: `<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>`,
  // type
  text: `<path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/>`,
  // hexagon — an opaque identifier token
  uuid: `<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>`,
  // toggle-right, knob filled so it survives being scaled down
  boolean: `<rect width="20" height="14" x="2" y="5" rx="7"/><circle cx="15" cy="12" r="3" fill="${ICON_COLOR}" stroke="none"/>`,
  // calendar
  date: `<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>`,
  // clock
  time: `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>`,
  // calendar-clock
  timestamp: `<path d="M16 14v2.2l1.6 1"/><path d="M16 2v4"/><path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5"/><path d="M3 10h5"/><path d="M8 2v4"/><circle cx="16" cy="16" r="6"/>`,
  // hourglass
  interval: `<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>`,
  // braces
  json: `<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/><path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>`,
  // brackets
  array: `<path d="M16 3h3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-3"/><path d="M8 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h3"/>`,
  // binary
  binary: `<rect x="14" y="14" width="4" height="6" rx="2"/><rect x="6" y="4" width="4" height="6" rx="2"/><path d="M6 20h4"/><path d="M14 10h4"/><path d="M6 14h2v6"/><path d="M14 4h2v6"/>`,
  // globe
  network: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`,
  // map-pin
  geo: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  // asterisk — enums, domains, extension types
  other: `<path d="M12 6v12"/><path d="M17.196 9 6.804 15"/><path d="m6.804 9 10.392 6"/>`,
};

/** Which key a column carries. Uniform colour means shape has to tell them apart. */
export type KeyKind = "pk" | "fk";

const KEY_GLYPH: Record<KeyKind, string> = {
  // key-round
  pk: `<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="${ICON_COLOR}"/>`,
  // link
  fk: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
};

/** Lays glyphs into consecutive slots of the square sprite. */
function sprite(...glyphs: string[]): string {
  const body = glyphs
    .map((g, i) => `<g transform="translate(${i * SLOT},${TOP})">${g}</g>`)
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX}" height="${BOX}" viewBox="0 0 ${BOX} ${BOX}" ` +
    `fill="none" stroke="${ICON_COLOR}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `${body}</svg>`
  );
}

/** Extra viewBox margin the interactive icons (sort/copy) get, so they render
 *  visibly smaller than the type glyph inside the same fixed header icon box. */
const SMALL_PAD = 8;
const SMALL_BOX = 24 + SMALL_PAD * 2;

/** Like `squareSprite`, but padded down to a smaller apparent size — used for
 *  the interactive sort/copy icons so they don't compete visually with the
 *  type glyph they sit beside. */
function smallSprite(glyph: string, color: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SMALL_BOX}" height="${SMALL_BOX}" viewBox="0 0 ${SMALL_BOX} ${SMALL_BOX}" ` +
    `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<g transform="translate(${SMALL_PAD},${SMALL_PAD})">${glyph}</g></svg>`
  );
}

/** Sprite name for a column's type glyph, optionally paired with a key glyph. */
export function columnIconName(
  category: ColumnCategory,
  key?: KeyKind,
): string {
  return key ? `col-${category}-${key}` : `col-${category}`;
}

/**
 * The foreign-key glyph on its own. Only used for a column that is both a
 * primary and a foreign key: the paired slot goes to the primary key, so the
 * reference marker trails the column name instead of being dropped.
 */
export const FK_ONLY_ICON = "key-foreign";

/**
 * Sort icon, always in the header's hover-revealed menu slot (fixed at the
 * right edge, regardless of sort state — so it never jumps when a sort is
 * applied). `SORT_NEUTRAL_ICON` sorts ascending on click; once active, the
 * same slot shows `SORT_ASC_ICON`/`SORT_DESC_ICON` and cycles further.
 */
export const SORT_NEUTRAL_ICON = "sort-neutral";
export const SORT_ASC_ICON = "sort-asc";
export const SORT_DESC_ICON = "sort-desc";

/**
 * Copy icon, in the header's indicator slot (right after the title text) —
 * shown only while hovering that column, and swapped for `COPIED_ICON` for a
 * moment after a successful copy.
 */
export const COPY_ICON = "copy-name";
export const COPIED_ICON = "copied";

const categories = Object.keys(GLYPH) as ColumnCategory[];

export const headerIcons: SpriteMap = {
  ...Object.fromEntries(
    categories.flatMap((category) => [
      [columnIconName(category), () => sprite(GLYPH[category])],
      ...(Object.keys(KEY_GLYPH) as KeyKind[]).map((key) => [
        columnIconName(category, key),
        () => sprite(GLYPH[category], KEY_GLYPH[key]),
      ]),
    ]),
  ),
  [FK_ONLY_ICON]: () => sprite(KEY_GLYPH.fk),
  // chevrons-up-down
  [SORT_NEUTRAL_ICON]: () =>
    smallSprite(
      `<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>`,
      ICON_COLOR,
    ),
  // arrow-up
  [SORT_ASC_ICON]: () =>
    smallSprite(`<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>`, ACTIVE_COLOR),
  // arrow-down
  [SORT_DESC_ICON]: () =>
    smallSprite(`<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>`, ACTIVE_COLOR),
  // copy
  [COPY_ICON]: () =>
    smallSprite(
      `<rect width="12" height="12" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
      ICON_COLOR,
    ),
  // check
  [COPIED_ICON]: () =>
    smallSprite(`<path d="M20 6 9 17l-5-5"/>`, SUCCESS_COLOR),
};
