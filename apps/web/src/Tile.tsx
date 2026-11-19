// Stand-in tiles in the Garden Party palette. The final engraved art will replace the faces;
// every face is drawn by one function so it can be swapped for an image later.

import type { TileKind } from "@mahjong-coach/engine";
import type { ButtonHTMLAttributes } from "react";

const INK = "#2B211C";
const ROSE = "#C1505B";
const DELFT = "#3F5F99";
const SAGE = "#5E7F57";
const PLUM = "#7A3B55";
const OCHRE = "#C9932F";

const SUIT_NAME = { bam: "Bam", crak: "Crak", dot: "Dot" } as const;
const NUMBER = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const WIND_NAME = { N: "North", E: "East", S: "South", W: "West" } as const;
const DRAGON_NAME = { red: "Red Dragon", green: "Green Dragon", white: "Soap" } as const;

export function tileName(kind: TileKind): string {
  switch (kind.type) {
    case "suit":
      return `${NUMBER[kind.rank]} ${SUIT_NAME[kind.suit]}`;
    case "wind":
      return `${WIND_NAME[kind.wind]} Wind`;
    case "dragon":
      return DRAGON_NAME[kind.dragon];
    case "flower":
      return "Flower";
    case "joker":
      return "Joker";
  }
}

function Bloom({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={cx}
          cy={cy - r * 0.55}
          rx={r * 0.42}
          ry={r * 0.55}
          fill={fill}
          fillOpacity={0.85}
          stroke={INK}
          strokeWidth={0.7}
          transform={`rotate(${a} ${cx} ${cy})`}
        />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.28} fill={OCHRE} stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

function Face({ kind }: { kind: TileKind }) {
  const serif = "'IM Fell English', Georgia, serif";
  switch (kind.type) {
    case "suit": {
      const mark =
        kind.suit === "crak" ? (
          <text x="30" y="66" textAnchor="middle" fontSize="21" fontWeight="700" fill={ROSE} stroke={INK} strokeWidth="0.4">
            萬
          </text>
        ) : kind.suit === "bam" ? (
          <g stroke={INK} strokeWidth="0.8">
            <rect x="22" y="50" width="6.5" height="20" rx="2" fill={SAGE} fillOpacity="0.85" />
            <rect x="31.5" y="50" width="6.5" height="20" rx="2" fill={SAGE} fillOpacity="0.85" />
            <path d="M21 60 H29.5 M30.5 60 H39" strokeWidth="1.2" />
          </g>
        ) : (
          <g>
            <circle cx="30" cy="60" r="9" fill={DELFT} fillOpacity="0.85" stroke={INK} strokeWidth="0.8" />
            <circle cx="30" cy="60" r="4.5" fill="#FBF6EA" stroke={INK} strokeWidth="0.6" />
          </g>
        );
      return (
        <>
          <text x="30" y="40" textAnchor="middle" fontSize="30" fontFamily={serif} fill={INK}>
            {kind.rank}
          </text>
          {mark}
        </>
      );
    }
    case "wind":
      return (
        <>
          <text x="30" y="50" textAnchor="middle" fontSize="36" fontFamily={serif} fill={INK}>
            {kind.wind}
          </text>
          <text x="30" y="66" textAnchor="middle" fontSize="8.5" letterSpacing="1" fontFamily={serif} fill={INK}>
            WIND
          </text>
        </>
      );
    case "dragon":
      if (kind.dragon === "white") {
        return (
          <g fill="none" stroke={DELFT}>
            <rect x="13" y="15" width="34" height="50" rx="2" strokeWidth="3" />
            <rect x="19" y="21" width="22" height="38" strokeWidth="1" stroke={INK} />
          </g>
        );
      }
      return (
        <>
          <circle cx="30" cy="36" r="15" fill="none" stroke={INK} strokeWidth="0.8" />
          <Bloom cx={30} cy={36} r={11} fill={kind.dragon === "red" ? ROSE : SAGE} />
          <text x="30" y="66" textAnchor="middle" fontSize="8.5" letterSpacing="1" fontFamily={serif} fill={INK}>
            {kind.dragon === "red" ? "RED" : "GREEN"}
          </text>
        </>
      );
    case "flower":
      return (
        <>
          <path d="M30 64 C30 52 28 46 30 40" stroke={SAGE} strokeWidth="2" fill="none" />
          <Bloom cx={30} cy={33} r={14} fill={ROSE} />
          <text x="30" y="72" textAnchor="middle" fontSize="7.5" letterSpacing="1" fontFamily={serif} fill={INK}>
            FLOWER
          </text>
        </>
      );
    case "joker":
      return (
        <>
          <path
            d="M30 12 L34.5 25 L48 25 L37 33 L41 46 L30 38 L19 46 L23 33 L12 25 L25.5 25 Z"
            fill={PLUM}
            fillOpacity="0.85"
            stroke={INK}
            strokeWidth="0.8"
          />
          <text x="30" y="64" textAnchor="middle" fontSize="9.5" letterSpacing="1.2" fontFamily={serif} fill={PLUM}>
            JOKER
          </text>
        </>
      );
  }
}

interface TileProps {
  kind: TileKind;
  size?: "rack" | "mini";
  selected?: boolean;
  fresh?: boolean;
  hinted?: boolean;
  dragging?: boolean;
  /** Shown as unavailable but still focusable and draggable (jokers, or when 3 are already picked). */
  blocked?: boolean;
  onClick?: () => void;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement> & { "data-id"?: number };
}

export function TileView({ kind, size = "rack", selected, fresh, hinted, dragging, blocked, onClick, buttonProps }: TileProps) {
  const svg = (
    <svg viewBox="0 0 60 80" aria-hidden="true" className="tile-svg">
      <rect x="4.5" y="4.5" width="51" height="71" rx="4" fill="none" stroke={INK} strokeWidth="0.8" />
      <rect x="6.8" y="6.8" width="46.4" height="66.4" rx="3" fill="none" stroke={INK} strokeWidth="0.35" />
      <Face kind={kind} />
    </svg>
  );
  const cls = [
    "tile",
    `tile-${size}`,
    selected && "is-selected",
    fresh && "is-fresh",
    hinted && "is-hinted",
    dragging && "is-dragging",
    blocked && "is-blocked",
  ]
    .filter(Boolean)
    .join(" ");
  const label = `${tileName(kind)}${fresh ? ", new" : ""}${selected ? ", selected" : ""}`;
  if (!onClick) {
    return (
      <span className={cls} role="img" aria-label={label}>
        {svg}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={blocked || undefined}
      onClick={onClick}
      {...buttonProps}
    >
      {fresh && <span className="new-dot" aria-hidden="true" />}
      {svg}
    </button>
  );
}
