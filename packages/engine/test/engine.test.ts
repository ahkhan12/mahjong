import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CharlestonError,
  FIRST_CHARLESTON,
  SEATS,
  SECOND_CHARLESTON,
  courtesyPass,
  deal,
  isJoker,
  kindCode,
  makeTileSet,
  pass,
  seatFrom,
  seatTo,
  secondCharlestonHappens,
  type Hands,
  type Seat,
  type Selections,
} from "../src/index.js";

const countBy = (codes: string[]) =>
  codes.reduce<Record<string, number>>((acc, c) => ((acc[c] = (acc[c] ?? 0) + 1), acc), {});

/** The first `n` non-joker tile ids in each hand: a simple, always-legal choice. */
function firstNonJokers(hands: Hands, n: number): Selections {
  const out = {} as Record<Seat, number[]>;
  for (const seat of SEATS) out[seat] = hands[seat].filter((t) => !isJoker(t)).slice(0, n).map((t) => t.id);
  return out;
}

function allIds(hands: Hands): number[] {
  return SEATS.flatMap((s) => hands[s].map((t) => t.id)).sort((a, b) => a - b);
}

describe("tile set", () => {
  const set = makeTileSet();
  const counts = countBy(set.map((t) => kindCode(t.kind)));

  it("has 152 tiles with unique ids", () => {
    expect(set).toHaveLength(152);
    expect(new Set(set.map((t) => t.id)).size).toBe(152);
  });

  it("has 4 of every suit tile, wind and dragon, and 8 flowers and 8 jokers", () => {
    for (const s of ["B", "C", "D"]) for (let r = 1; r <= 9; r++) expect(counts[`${s}${r}`]).toBe(4);
    for (const w of ["WN", "WE", "WS", "WW"]) expect(counts[w]).toBe(4);
    for (const d of ["DR", "DG", "DW"]) expect(counts[d]).toBe(4);
    expect(counts.F).toBe(8);
    expect(counts.J).toBe(8);
  });
});

describe("seats", () => {
  it("passes right to the next player in turn order", () => {
    expect(seatTo("east", "right")).toBe("south");
    expect(seatTo("north", "right")).toBe("east");
    expect(seatTo("east", "across")).toBe("west");
    expect(seatTo("east", "left")).toBe("north");
  });

  it("seatFrom undoes seatTo", () => {
    for (const seat of SEATS)
      for (const dir of ["right", "across", "left"] as const) expect(seatFrom(seatTo(seat, dir), dir)).toBe(seat);
  });
});

describe("deal", () => {
  it("gives East 14 tiles, everyone else 13, and leaves 99 in the wall", () => {
    const d = deal(42);
    expect(d.hands.east).toHaveLength(14);
    for (const s of ["south", "west", "north"] as const) expect(d.hands[s]).toHaveLength(13);
    expect(d.wall).toHaveLength(99);
  });

  it("is repeatable from the same seed and different across seeds", () => {
    expect(deal(7)).toEqual(deal(7));
    expect(deal(7).hands.east).not.toEqual(deal(8).hands.east);
  });
});

describe("charleston", () => {
  it("moves the chosen tiles to the right seat", () => {
    const { hands } = deal(1);
    const picks = firstNonJokers(hands, 3);
    const after = pass(hands, picks, "right");
    const southIds = after.south.map((t) => t.id);
    for (const id of picks.east) expect(southIds).toContain(id);
    for (const id of picks.east) expect(after.east.map((t) => t.id)).not.toContain(id);
  });

  it("refuses to pass a joker", () => {
    // Find a seed where East is dealt a joker.
    let seed = 0;
    while (!deal(seed).hands.east.some(isJoker)) seed++;
    const { hands } = deal(seed);
    const joker = hands.east.find(isJoker)!;
    const picks = { ...firstNonJokers(hands, 3), east: [joker.id, ...firstNonJokers(hands, 2).east] };
    expect(() => pass(hands, picks, "right")).toThrow(CharlestonError);
    expect(() => pass(hands, picks, "right")).toThrow(/jokers/);
  });

  it("requires exactly 3 tiles on a standard pass", () => {
    const { hands } = deal(2);
    const picks = { ...firstNonJokers(hands, 3), south: firstNonJokers(hands, 2).south };
    expect(() => pass(hands, picks, "across")).toThrow(/exactly 3/);
  });

  it("only runs the second Charleston if everyone wants it", () => {
    expect(secondCharlestonHappens({ east: true, south: true, west: true, north: true })).toBe(true);
    expect(secondCharlestonHappens({ east: true, south: false, west: true, north: true })).toBe(false);
  });

  it("courtesy pass trades the smaller offer between partners", () => {
    const { hands } = deal(3);
    const three = firstNonJokers(hands, 3);
    const offers = { ...three, west: three.west.slice(0, 1), north: [] };
    const after = courtesyPass(hands, offers);
    // East offered 3, West offered 1: each passes 1.
    expect(after.west.map((t) => t.id)).toContain(three.east[0]);
    expect(after.west.map((t) => t.id)).not.toContain(three.east[1]);
    // North offered 0: South keeps everything.
    expect(after.south.map((t) => t.id).sort()).toEqual(hands.south.map((t) => t.id).sort());
  });

  it("never creates, loses or duplicates tiles across a full Charleston (random deals)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), fc.integer({ min: 0, max: 3 }), (seed, courtesy) => {
        let { hands } = deal(seed);
        const before = allIds(hands);
        for (const dir of [...FIRST_CHARLESTON, ...SECOND_CHARLESTON]) hands = pass(hands, firstNonJokers(hands, 3), dir);
        hands = courtesyPass(hands, firstNonJokers(hands, courtesy));
        expect(allIds(hands)).toEqual(before);
        expect(hands.east).toHaveLength(14);
        for (const s of ["south", "west", "north"] as const) expect(hands[s]).toHaveLength(13);
      }),
      { numRuns: 300 },
    );
  });
});
