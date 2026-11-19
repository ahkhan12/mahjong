// Simple Charleston strategy, used by the bots and by the coach to suggest a pass.
//
// The idea: find the card hands you're closest to, then keep the tiles those hands use
// and pass the ones they don't. Closer hands count for more. Jokers are never passed.
//
// This is a starting heuristic, not the final coach. Later, simulation will replace it.

import { expandHand, type Card, type ConcreteHand } from "./card.js";
import { tilesAway, type HandDistance } from "./analysis.js";
import { isJoker, kindCode, type Tile } from "./tiles.js";

/** How many of the closest hand versions to keep in mind when choosing what to pass. */
const TARGETS = 8;

interface Target {
  readonly concrete: ConcreteHand;
  readonly distance: HandDistance;
}

function closestTargets(hand: readonly Tile[], card: Card, n = TARGETS): Target[] {
  const all: Target[] = [];
  for (const def of card.hands) {
    for (const concrete of expandHand(def)) all.push({ concrete, distance: tilesAway(hand, concrete) });
  }
  all.sort((a, b) => a.distance.tilesAway - b.distance.tilesAway || a.concrete.handId.localeCompare(b.concrete.handId));
  return all.slice(0, n);
}

/** Which of your tiles a hand version would use. Each needed tile is matched to at most one of yours. */
function usedIds(hand: readonly Tile[], concrete: ConcreteHand): Set<number> {
  const need = new Map<string, number>();
  for (const g of concrete.groups) for (const t of g.tiles) need.set(t, (need.get(t) ?? 0) + 1);
  const used = new Set<number>();
  for (const tile of hand) {
    const code = kindCode(tile.kind);
    const n = need.get(code) ?? 0;
    if (n > 0) {
      used.add(tile.id);
      need.set(code, n - 1);
    }
  }
  return used;
}

/** How useful each tile is to your closest hands. Higher means keep it. */
export function tileValues(hand: readonly Tile[], card: Card): Map<number, number> {
  const values = new Map<number, number>(hand.map((t) => [t.id, isJoker(t) ? Infinity : 0]));
  for (const { concrete, distance } of closestTargets(hand, card)) {
    const weight = 1 / (1 + distance.tilesAway) ** 2;
    for (const id of usedIds(hand, concrete)) values.set(id, (values.get(id) ?? 0) + weight);
  }
  return values;
}

/** The `count` tiles a simple player would pass: the least useful non-jokers. */
export function choosePass(hand: readonly Tile[], card: Card, count = 3): number[] {
  const values = tileValues(hand, card);
  return hand
    .filter((t) => !isJoker(t))
    .slice()
    .sort((a, b) => values.get(a.id)! - values.get(b.id)! || a.id - b.id)
    .slice(0, count)
    .map((t) => t.id);
}

export type PassRating = "great" | "fine" | "missed" | "costly";

export interface PassReview {
  readonly rating: PassRating;
  readonly suggested: readonly number[];
  /** One plain-language reason. */
  readonly reason: string;
  /** The closest card hands after your pass, for "show me the numbers". */
  readonly closestAfter: readonly HandDistance[];
  readonly closestAfterSuggested: readonly HandDistance[];
}

/** Your 3 closest card hands (one version each) and how far away they are. */
export function closestDistinct(hand: readonly Tile[], card: Card, n = 3): HandDistance[] {
  const seen = new Set<string>();
  const out: HandDistance[] = [];
  for (const t of closestTargets(hand, card, 400)) {
    if (seen.has(t.concrete.handId)) continue;
    seen.add(t.concrete.handId);
    out.push(t.distance);
    if (out.length === n) break;
  }
  return out;
}

const score = (rows: readonly HandDistance[]) => rows.reduce((s, r) => s + r.tilesAway, 0);

/**
 * Rates a pass by what it leaves you with: how far your 3 closest hands are after passing,
 * compared with the suggested pass. You can't see what's coming back, so this only judges what you kept.
 */
/** "3 Two Bams and a Soap" style list, given a name for one tile. */
function listTiles(tiles: readonly Tile[], tileName: (t: Tile) => string): string {
  const counts = new Map<string, number>();
  for (const t of tiles) counts.set(tileName(t), (counts.get(tileName(t)) ?? 0) + 1);
  const parts = [...counts].map(([name, n]) => (n === 1 ? `${/^[AEIOU]/i.test(name) ? "an" : "a"} ${name}` : `${n} ${name}s`));
  return parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export function reviewPass(
  hand: readonly Tile[],
  passed: readonly number[],
  card: Card,
  handName: (id: string) => string = (id) => id,
  tileName: (t: Tile) => string = (t) => kindCode(t.kind),
): PassReview {
  const suggested = choosePass(hand, card, passed.length);
  const keep = (ids: readonly number[]) => hand.filter((t) => !ids.includes(t.id));
  const before = closestDistinct(hand, card);
  const after = closestDistinct(keep(passed), card);
  const afterSuggested = closestDistinct(keep(suggested), card);
  const gap = score(after) - score(afterSuggested);
  const rating: PassRating = gap <= 0 ? "great" : gap <= 1 ? "fine" : gap <= 3 ? "missed" : "costly";

  // The reason: name a tile you gave away that your closest hand needed, if there is one.
  const top = before[0];
  let reason: string;
  const topDef = top ? card.hands.find((h) => h.id === top.handId) : undefined;
  const topConcrete = topDef ? expandHand(topDef).find((c) => c.variant === top!.variant) : undefined;
  const neededGone = topConcrete ? [...usedIds(hand, topConcrete)].filter((id) => passed.includes(id)) : [];
  if (rating === "great") {
    reason = top ? `You kept everything ${handName(top.handId)} needs. That's your closest hand.` : "Solid pass.";
  } else if (neededGone.length > 0 && top) {
    const gone = neededGone.map((id) => hand.find((t) => t.id === id)!);
    reason = `You passed ${listTiles(gone, tileName)}. ${handName(top.handId)}, your closest hand, uses ${gone.length === 1 ? "it" : "them"}.`;
  } else {
    reason = `Passing the suggested tiles would leave your 3 closest hands ${gap} ${gap === 1 ? "tile" : "tiles"} nearer in total.`;
  }
  return { rating, suggested, reason, closestAfter: after, closestAfterSuggested: afterSuggested };
}
