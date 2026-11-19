// The 152-tile American mahjong set.

export type Suit = "bam" | "crak" | "dot";
export type Wind = "N" | "E" | "S" | "W";
export type Dragon = "red" | "green" | "white"; // white is also called "soap"

export type TileKind =
  | { type: "suit"; suit: Suit; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }
  | { type: "wind"; wind: Wind }
  | { type: "dragon"; dragon: Dragon }
  | { type: "flower" }
  | { type: "joker" };

/** One physical tile. `id` is unique within a set (0–151), so identical tiles can be told apart. */
export interface Tile {
  readonly id: number;
  readonly kind: TileKind;
}

export const SUITS: readonly Suit[] = ["bam", "crak", "dot"];
export const WINDS: readonly Wind[] = ["N", "E", "S", "W"];
export const DRAGONS: readonly Dragon[] = ["red", "green", "white"];

/** Each dragon belongs to one suit: red with craks, green with bams, white (soap) with dots. */
export const DRAGON_OF_SUIT: Readonly<Record<Suit, Dragon>> = {
  crak: "red",
  bam: "green",
  dot: "white",
};

/**
 * A short, stable code for a tile kind, handy for tests and logs.
 * Suits: "B5", "C5", "D5". Winds: "WN". Dragons: "DR", "DG", "DW". Flower: "F". Joker: "J".
 */
export function kindCode(kind: TileKind): string {
  switch (kind.type) {
    case "suit":
      return `${kind.suit[0]!.toUpperCase()}${kind.rank}`;
    case "wind":
      return `W${kind.wind}`;
    case "dragon":
      return `D${kind.dragon[0]!.toUpperCase()}`;
    case "flower":
      return "F";
    case "joker":
      return "J";
  }
}

export function tileCode(tile: Tile): string {
  return kindCode(tile.kind);
}

export function isJoker(tile: Tile): boolean {
  return tile.kind.type === "joker";
}

/** Builds a full set in a fixed order: 108 suit tiles, 16 winds, 12 dragons, 8 flowers, 8 jokers. */
export function makeTileSet(): Tile[] {
  const kinds: TileKind[] = [];
  for (const suit of SUITS) {
    for (let rank = 1 as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; rank <= 9; rank = (rank + 1) as typeof rank) {
      for (let copy = 0; copy < 4; copy++) kinds.push({ type: "suit", suit, rank });
    }
  }
  for (const wind of WINDS) for (let c = 0; c < 4; c++) kinds.push({ type: "wind", wind });
  for (const dragon of DRAGONS) for (let c = 0; c < 4; c++) kinds.push({ type: "dragon", dragon });
  for (let c = 0; c < 8; c++) kinds.push({ type: "flower" });
  for (let c = 0; c < 8; c++) kinds.push({ type: "joker" });
  return kinds.map((kind, id) => ({ id, kind }));
}
