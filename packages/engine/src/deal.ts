import { createRng, shuffle } from "./rng.js";
import { SEATS, type Seat } from "./seats.js";
import { makeTileSet, type Tile } from "./tiles.js";

export type Hands = Readonly<Record<Seat, readonly Tile[]>>;

export interface Deal {
  readonly seed: number;
  readonly hands: Hands;
  /** Tiles left to draw, in draw order. */
  readonly wall: readonly Tile[];
}

/**
 * Shuffles a full set with `seed` and deals 14 tiles to East and 13 to everyone else.
 * The physical wall-building and dice roll are skipped: they don't change which tiles
 * anyone gets once the set is shuffled.
 */
export function deal(seed: number): Deal {
  const tiles = shuffle(makeTileSet(), createRng(seed));
  const hands = {} as Record<Seat, Tile[]>;
  let next = 0;
  for (const seat of SEATS) {
    const count = seat === "east" ? 14 : 13;
    hands[seat] = tiles.slice(next, next + count);
    next += count;
  }
  return { seed, hands, wall: tiles.slice(next) };
}
