// Card hands as data.
//
// A hand is written the way it looks on a card: groups separated by spaces.
// Each character in a group is one tile, and a letter at the end gives the group's suit.
//
//   1–9      a number tile in the group's suit
//   0        white dragon (soap), used as zero in year hands. Needs no suit.
//   x y z    a number chosen per hand: x, x+1, x+2 (for runs and like-number hands)
//   D        the dragon that goes with the group's suit (red with craks, green with bams, soap with dots)
//   N E W S  winds
//   F        flower
//   a b c    suit placeholders at the end of a group. Different letters mean different suits.
//
// Examples:
//   "FF 22a 444b 666b 8888c"   flowers, then evens across three suits
//   "FFF xxxxa xxxxb xxxc"     like numbers: the same number in all three suits
//   "NNNN EEE WWW SSSS"        winds only
//
// Jokers can stand in for tiles only in groups of 3 or more identical tiles
// (pungs, kongs, quints). They can't be used in singles, pairs, or mixed groups like "2026a".

import { DRAGON_OF_SUIT, SUITS, kindCode, type Suit, type TileKind } from "./tiles.js";

export type SuitVar = "a" | "b" | "c";

export interface HandDef {
  readonly id: string;
  readonly section: string;
  readonly text: string;
  readonly value: number;
  /** Must the hand be completed without exposing any groups? */
  readonly concealed: boolean;
}

export interface Card {
  readonly name: string;
  readonly hands: readonly HandDef[];
}

/** One group as written, before suits and numbers are chosen. */
export interface GroupDef {
  readonly chars: string;
  readonly suit: SuitVar | null;
}

/** One concrete way to make a hand: every suit placeholder and number filled in. */
export interface ConcreteHand {
  readonly handId: string;
  /** e.g. "a=bam b=crak x=3" */
  readonly variant: string;
  readonly groups: readonly ConcreteGroup[];
}

export interface ConcreteGroup {
  /** Tile codes, as from `kindCode`. */
  readonly tiles: readonly string[];
  /** Can jokers fill this group? True for 3+ identical tiles. */
  readonly jokersAllowed: boolean;
}

export class CardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CardError";
  }
}

const NEEDS_SUIT = /[1-9xyzD]/;
const GROUP = /^([0-9xyzDNEWSF]+)([abc])?$/;

export function parseHand(text: string): GroupDef[] {
  const groups = text.trim().split(/\s+/).map((g) => {
    const m = GROUP.exec(g);
    if (!m) throw new CardError(`can't read group "${g}" in "${text}"`);
    const chars = m[1]!;
    const suit = (m[2] as SuitVar | undefined) ?? null;
    if (NEEDS_SUIT.test(chars) && !suit) throw new CardError(`group "${g}" needs a suit letter (a, b or c)`);
    if (!NEEDS_SUIT.test(chars) && suit) throw new CardError(`group "${g}" has a suit letter but no suited tiles`);
    return { chars, suit };
  });
  const count = groups.reduce((n, g) => n + g.chars.length, 0);
  if (count !== 14) throw new CardError(`"${text}" has ${count} tiles, a hand needs 14`);
  return groups;
}

function charToKind(ch: string, suit: Suit | null, x: number): TileKind {
  if (ch === "0") return { type: "dragon", dragon: "white" };
  if (ch === "F") return { type: "flower" };
  if ("NEWS".includes(ch)) return { type: "wind", wind: ch as "N" | "E" | "W" | "S" };
  if (!suit) throw new CardError(`tile "${ch}" needs a suit`);
  if (ch === "D") return { type: "dragon", dragon: DRAGON_OF_SUIT[suit] };
  const rank = "xyz".includes(ch) ? x + "xyz".indexOf(ch) : Number(ch);
  return { type: "suit", suit, rank: rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 };
}

function permutations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map((rest) => [item, ...rest]),
  );
}

/** Every concrete way to make a hand. A "like numbers" hand in three suits, for example, has 6 × 9 = 54. */
export function expandHand(hand: HandDef): ConcreteHand[] {
  const groups = parseHand(hand.text);
  const vars = [...new Set(groups.map((g) => g.suit).filter((s): s is SuitVar => s !== null))].sort();
  const usesX = groups.some((g) => /[xyz]/.test(g.chars));
  const maxOffset = Math.max(0, ...groups.flatMap((g) => [...g.chars].map((c) => "xyz".indexOf(c))));
  const xs = usesX ? Array.from({ length: 9 - maxOffset }, (_, i) => i + 1) : [1];

  const out: ConcreteHand[] = [];
  for (const suits of permutations(SUITS, vars.length)) {
    const suitOf = Object.fromEntries(vars.map((v, i) => [v, suits[i]!])) as Record<SuitVar, Suit>;
    for (const x of xs) {
      const concrete = groups.map((g) => {
        const suit = g.suit ? suitOf[g.suit] : null;
        const tiles = [...g.chars].map((ch) => kindCode(charToKind(ch, suit, x)));
        const identical = tiles.every((t) => t === tiles[0]);
        return { tiles, jokersAllowed: tiles.length >= 3 && identical };
      });
      const label = [...vars.map((v) => `${v}=${suitOf[v]}`), ...(usesX ? [`x=${x}`] : [])].join(" ");
      out.push({ handId: hand.id, variant: label, groups: concrete });
    }
  }
  return out;
}

/**
 * Checks a whole card: every hand parses, has 14 tiles, and can actually be made with one set.
 * A hand may need more copies of a tile than exist (a quint needs 5), as long as the extras
 * fall in groups jokers can fill and there are enough jokers (8) to cover them.
 */
export function validateCard(card: Card): void {
  const limit = (code: string) => (code === "F" ? 8 : 4);
  const seen = new Set<string>();
  for (const hand of card.hands) {
    if (seen.has(hand.id)) throw new CardError(`duplicate hand id "${hand.id}"`);
    seen.add(hand.id);
    for (const concrete of expandHand(hand)) {
      const where = `hand "${hand.id}" (${concrete.variant})`;
      const strict = new Map<string, number>();
      const total = new Map<string, number>();
      for (const g of concrete.groups) {
        for (const t of g.tiles) {
          total.set(t, (total.get(t) ?? 0) + 1);
          if (!g.jokersAllowed) strict.set(t, (strict.get(t) ?? 0) + 1);
        }
      }
      let jokersNeeded = 0;
      for (const [code, n] of total) {
        if ((strict.get(code) ?? 0) > limit(code)) throw new CardError(`${where} needs too many ${code} in singles or pairs`);
        jokersNeeded += Math.max(0, n - limit(code));
      }
      if (jokersNeeded > 8) throw new CardError(`${where} would need ${jokersNeeded} jokers`);
    }
  }
}
