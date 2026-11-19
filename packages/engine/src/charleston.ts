// The Charleston: the passes everyone makes before play starts.
//
// First Charleston (required):  right, across, left
// Second Charleston (optional): left, across, right. Any one player can stop it.
// Courtesy pass (optional): across, 0–3 tiles. Each pair passes the smaller of their two offers.
//
// Jokers can never be passed.
//
// Blind passes: on the last pass of each Charleston (first left, second right), a player
// may pass on 1–3 of the tiles they are receiving without looking at them, topping up
// with tiles from their own hand so the total is 3.

import type { Hands } from "./deal.js";
import { SEATS, seatFrom, type Direction, type Seat } from "./seats.js";
import { isJoker, type Tile } from "./tiles.js";

export const FIRST_CHARLESTON: readonly Direction[] = ["right", "across", "left"];
export const SECOND_CHARLESTON: readonly Direction[] = ["left", "across", "right"];

/** Tile ids each seat chose to pass. */
export type Selections = Readonly<Record<Seat, readonly number[]>>;

export class CharlestonError extends Error {
  constructor(
    readonly seat: Seat,
    message: string,
  ) {
    super(`${seat}: ${message}`);
    this.name = "CharlestonError";
  }
}

/** Checks one seat's chosen tiles and returns them. Throws a CharlestonError if the choice breaks a rule. */
function pickTiles(seat: Seat, hand: readonly Tile[], ids: readonly number[], min: number, max: number): Tile[] {
  if (ids.length < min || ids.length > max) {
    const want = min === max ? `exactly ${min}` : `${min} to ${max}`;
    throw new CharlestonError(seat, `must pass ${want} tiles, got ${ids.length}`);
  }
  if (new Set(ids).size !== ids.length) throw new CharlestonError(seat, "picked the same tile twice");
  return ids.map((id) => {
    const tile = hand.find((t) => t.id === id);
    if (!tile) throw new CharlestonError(seat, `tile ${id} is not in this hand`);
    if (isJoker(tile)) throw new CharlestonError(seat, "jokers can't be passed");
    return tile;
  });
}

function exchange(hands: Hands, outgoing: Record<Seat, Tile[]>, direction: Direction): Hands {
  const next = {} as Record<Seat, Tile[]>;
  for (const seat of SEATS) {
    const leaving = new Set(outgoing[seat].map((t) => t.id));
    const kept = hands[seat].filter((t) => !leaving.has(t.id));
    next[seat] = [...kept, ...outgoing[seatFrom(seat, direction)]];
  }
  return next;
}

/** One standard pass: every seat passes exactly 3 non-joker tiles in `direction`. */
export function pass(hands: Hands, selections: Selections, direction: Direction): Hands {
  const outgoing = {} as Record<Seat, Tile[]>;
  for (const seat of SEATS) outgoing[seat] = pickTiles(seat, hands[seat], selections[seat], 3, 3);
  return exchange(hands, outgoing, direction);
}

/** The passes where a blind pass is allowed: the last pass of each Charleston. */
export const BLIND_PASS_STEPS = [
  { charleston: 1, direction: "left" },
  { charleston: 2, direction: "right" },
] as const;

/** One seat's choice on a blind-pass step: tiles from its own hand, plus how many incoming tiles to pass on unseen. */
export interface BlindChoice {
  readonly own: readonly number[];
  readonly blind: 0 | 1 | 2 | 3;
}

/**
 * A pass where blind passing is allowed. Each seat passes `own` tiles from its hand plus
 * the first `blind` tiles it receives, unseen, for 3 tiles total.
 *
 * Forwarded tiles can chain around the table (a tile can travel through several blind
 * passers), so the outgoing piles are worked out by repeating until nothing changes.
 * The piles only grow and are capped at 3, so this settles in a few rounds.
 */
export function blindPass(hands: Hands, choices: Readonly<Record<Seat, BlindChoice>>, direction: Direction): Hands {
  const own = {} as Record<Seat, Tile[]>;
  for (const seat of SEATS) {
    const { own: ids, blind } = choices[seat];
    if (ids.length + blind !== 3) {
      throw new CharlestonError(seat, `own tiles plus blind tiles must make 3, got ${ids.length} + ${blind}`);
    }
    own[seat] = pickTiles(seat, hands[seat], ids, 0, 3);
  }

  // A tile can be passed on by up to 3 blind passers in a row, and each pile holds 3,
  // so 4 seats × 3 tiles rounds is always enough to settle. Stop early once nothing changes.
  const key = (o: Record<Seat, Tile[]>) => SEATS.map((s) => o[s].map((t) => t.id).join(",")).join("|");
  let outgoing = { ...own };
  for (let round = 0; round < 12; round++) {
    const next = {} as Record<Seat, Tile[]>;
    for (const seat of SEATS) {
      const incoming = outgoing[seatFrom(seat, direction)];
      next[seat] = [...own[seat], ...incoming.slice(0, choices[seat].blind)];
    }
    const settled = key(next) === key(outgoing);
    outgoing = next;
    if (settled) break;
  }

  const result = {} as Record<Seat, Tile[]>;
  for (const seat of SEATS) {
    const leaving = new Set(own[seat].map((t) => t.id));
    const incoming = outgoing[seatFrom(seat, direction)];
    const kept = incoming.slice(choices[seat].blind); // the ones passed on unseen never join the hand
    result[seat] = [...hands[seat].filter((t) => !leaving.has(t.id)), ...kept];
  }
  return result;
}

/** The second Charleston happens only if no one stops it. */
export function secondCharlestonHappens(wantsSecond: Readonly<Record<Seat, boolean>>): boolean {
  return SEATS.every((seat) => wantsSecond[seat]);
}

/**
 * The courtesy pass. Each seat offers 0–3 tiles in the order it would give them up.
 * Partners across from each other (East–West, South–North) each pass the smaller
 * of their two offer counts, taking tiles from the front of their own offer.
 */
export function courtesyPass(hands: Hands, offers: Selections): Hands {
  const outgoing = {} as Record<Seat, Tile[]>;
  for (const seat of SEATS) {
    const offered = pickTiles(seat, hands[seat], offers[seat], 0, 3);
    const partner = offers[seatFrom(seat, "across")];
    outgoing[seat] = offered.slice(0, Math.min(offered.length, partner.length));
  }
  return exchange(hands, outgoing, "across");
}
