// "Tiles away": how close a set of tiles is to each hand on a card.

import { expandHand, type Card, type ConcreteHand } from "./card.js";
import { kindCode, type Tile } from "./tiles.js";

export interface HandDistance {
  readonly handId: string;
  readonly variant: string;
  /** How many more tiles you need to complete this hand. 0 means it's complete. */
  readonly tilesAway: number;
  /** Tile codes still needed, not counting slots your jokers can cover. */
  readonly missing: readonly string[];
}

/**
 * Tiles away from one concrete hand.
 *
 * Your natural tiles go first to the slots jokers can't fill (singles, pairs, mixed groups),
 * then to slots jokers can fill. Jokers then cover whatever joker-friendly slots are left.
 * That order always gives the best match, because a joker can never fill a single or pair.
 */
export function tilesAway(tiles: readonly Tile[], hand: ConcreteHand): HandDistance {
  const have = new Map<string, number>();
  let jokers = 0;
  for (const t of tiles) {
    const code = kindCode(t.kind);
    if (code === "J") jokers++;
    else have.set(code, (have.get(code) ?? 0) + 1);
  }

  const strict = new Map<string, number>(); // slots jokers can't fill
  const flexible = new Map<string, number>(); // slots jokers can fill
  for (const g of hand.groups) {
    const into = g.jokersAllowed ? flexible : strict;
    for (const code of g.tiles) into.set(code, (into.get(code) ?? 0) + 1);
  }

  const missing: string[] = [];
  let matched = 0;
  let openFlexible: string[] = [];
  for (const code of new Set([...strict.keys(), ...flexible.keys()])) {
    const n = have.get(code) ?? 0;
    const s = strict.get(code) ?? 0;
    const f = flexible.get(code) ?? 0;
    const toStrict = Math.min(n, s);
    const toFlexible = Math.min(n - toStrict, f);
    matched += toStrict + toFlexible;
    for (let i = 0; i < s - toStrict; i++) missing.push(code);
    for (let i = 0; i < f - toFlexible; i++) openFlexible.push(code);
  }
  const jokersUsed = Math.min(jokers, openFlexible.length);
  matched += jokersUsed;
  openFlexible = openFlexible.slice(jokersUsed);

  return { handId: hand.handId, variant: hand.variant, tilesAway: 14 - matched, missing: [...missing, ...openFlexible].sort() };
}

/** Every variation of every hand on the card, closest first. */
export function rankHands(tiles: readonly Tile[], card: Card): HandDistance[] {
  const all = card.hands.flatMap((h) => expandHand(h).map((c) => tilesAway(tiles, c)));
  return all.sort((a, b) => a.tilesAway - b.tilesAway || a.handId.localeCompare(b.handId));
}

/** The closest variation of each hand: one row per card hand, closest first. */
export function closestPerHand(tiles: readonly Tile[], card: Card): HandDistance[] {
  const best = new Map<string, HandDistance>();
  for (const d of rankHands(tiles, card)) if (!best.has(d.handId)) best.set(d.handId, d);
  return [...best.values()];
}
