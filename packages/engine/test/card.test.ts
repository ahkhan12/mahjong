import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CardError,
  PRACTICE_CARD,
  SEATS,
  blindPass,
  closestPerHand,
  deal,
  expandHand,
  isJoker,
  parseHand,
  tilesAway,
  validateCard,
  type BlindChoice,
  type HandDef,
  type Seat,
  type Tile,
  type TileKind,
} from "../src/index.js";

function kindFromCode(code: string): TileKind {
  if (code === "J") return { type: "joker" };
  if (code === "F") return { type: "flower" };
  if (code[0] === "W") return { type: "wind", wind: code[1] as "N" | "E" | "S" | "W" };
  if (code[0] === "D" && "RGW".includes(code[1]!)) {
    return { type: "dragon", dragon: ({ R: "red", G: "green", W: "white" } as const)[code[1] as "R" | "G" | "W"] };
  }
  const suit = ({ B: "bam", C: "crak", D: "dot" } as const)[code[0] as "B" | "C" | "D"];
  return { type: "suit", suit, rank: Number(code[1]) as 1 };
}

/** Builds tiles from a space-separated list of codes, e.g. "F F B2 B2 J". */
const tiles = (codes: string): Tile[] => codes.split(" ").map((c, id) => ({ id, kind: kindFromCode(c) }));

const hand = (text: string): HandDef => ({ id: "t", section: "test", text, value: 25, concealed: false });

describe("card notation", () => {
  it("reads groups and suit letters", () => {
    expect(parseHand("FF 22a 444b 666b 8888c")).toEqual([
      { chars: "FF", suit: null },
      { chars: "22", suit: "a" },
      { chars: "444", suit: "b" },
      { chars: "666", suit: "b" },
      { chars: "8888", suit: "c" },
    ]);
  });

  it("rejects hands that aren't 14 tiles, or that are missing a suit", () => {
    expect(() => parseHand("FF 22a 444b 666b 888c")).toThrow(/13 tiles/);
    expect(() => parseHand("FF 22 444b 666b 8888c")).toThrow(/needs a suit/);
    expect(() => parseHand("FFa 22a 444b 666b 8888c")).toThrow(CardError);
    expect(() => parseHand("FF 22a 444b 666b 8888q")).toThrow(/can't read/);
  });

  it("expands every suit and number choice", () => {
    expect(expandHand(hand("NNNN EEE WWW SSSS"))).toHaveLength(1);
    expect(expandHand(hand("FF 2026a 2026b 2026c"))).toHaveLength(6); // 3 suits in any order
    expect(expandHand(hand("xxxxa yyyya zzza FFF"))).toHaveLength(3 * 7); // one suit, x from 1 to 7
    expect(expandHand(hand("FFF xxxxa xxxxb xxxc"))).toHaveLength(6 * 9);
  });

  it("matches each dragon to its suit and treats 0 as soap", () => {
    const [first] = expandHand(hand("2222a 44a 6666b 88b DDa")).filter((h) => h.variant.startsWith("a=crak"));
    expect(first!.groups.at(-1)!.tiles).toEqual(["DR", "DR"]);
    const year = expandHand(hand("222a 0000 2222b 666b"))[0]!;
    expect(year.groups[1]!.tiles).toEqual(["DW", "DW", "DW", "DW"]);
  });

  it("only lets jokers into groups of 3 or more identical tiles", () => {
    const h = expandHand(hand("FF 2026a 2026b 2026c"))[0]!;
    expect(h.groups.map((g) => g.jokersAllowed)).toEqual([false, false, false, false]);
    const k = expandHand(hand("FF 22a 444b 666b 8888c"))[0]!;
    expect(k.groups.map((g) => g.jokersAllowed)).toEqual([false, false, true, true, true]);
  });

  it("the practice card is valid", () => {
    expect(() => validateCard(PRACTICE_CARD)).not.toThrow();
  });
});

describe("tiles away", () => {
  const evens = expandHand(hand("FF 22a 444b 666b 8888c")).find((h) => h.variant === "a=bam b=crak c=dot")!;

  it("is 0 for a complete hand", () => {
    expect(tilesAway(tiles("F F B2 B2 C4 C4 C4 C6 C6 C6 D8 D8 D8 D8"), evens).tilesAway).toBe(0);
  });

  it("lets jokers finish pungs and kongs", () => {
    const d = tilesAway(tiles("F F B2 B2 C4 J C4 C6 J C6 D8 J J D8"), evens);
    expect(d.tilesAway).toBe(0);
  });

  it("doesn't let jokers finish a pair", () => {
    const d = tilesAway(tiles("J J B2 B2 C4 C4 C4 C6 C6 C6 D8 D8 D8 D8"), evens);
    expect(d.tilesAway).toBe(2);
    expect(d.missing).toEqual(["F", "F"]);
  });

  it("counts what's missing", () => {
    const d = tilesAway(tiles("F B2 C4 C4 C6 D8 D8 WN WE WS DR DG DW"), evens);
    expect(d.tilesAway).toBe(7);
    expect(d.missing).toEqual(["B2", "C4", "C6", "C6", "D8", "D8", "F"]);
  });

  it("ranks the closest version of each hand", () => {
    const rows = closestPerHand(tiles("F F B2 B2 C4 C4 C4 C6 C6 C6 D8 D8 D8 D8"), PRACTICE_CARD);
    expect(rows[0]).toMatchObject({ handId: "even-1", tilesAway: 0 });
    expect(rows).toHaveLength(PRACTICE_CARD.hands.length);
  });
});

describe("blind pass", () => {
  const choicesFor = (hands: ReturnType<typeof deal>["hands"], blind: Record<Seat, 0 | 1 | 2 | 3>) => {
    const out = {} as Record<Seat, BlindChoice>;
    for (const s of SEATS) {
      const ids = hands[s].filter((t) => !isJoker(t)).slice(0, 3 - blind[s]).map((t) => t.id);
      out[s] = { own: ids, blind: blind[s] };
    }
    return out;
  };

  it("passes received tiles on unseen", () => {
    const { hands } = deal(5);
    // East passes 3 of its own to North (passing left). North passes all 3 of those on, unseen, to West.
    const choices = choicesFor(hands, { east: 0, south: 0, west: 0, north: 3 });
    const after = blindPass(hands, choices, "left");
    const westIds = after.west.map((t) => t.id);
    for (const id of choices.east.own) expect(westIds).toContain(id);
    for (const id of choices.east.own) expect(after.north.map((t) => t.id)).not.toContain(id);
  });

  it("changes nothing if everyone passes all 3 blind", () => {
    const { hands } = deal(6);
    const after = blindPass(hands, choicesFor(hands, { east: 3, south: 3, west: 3, north: 3 }), "left");
    for (const s of SEATS) expect(after[s].map((t) => t.id).sort()).toEqual(hands[s].map((t) => t.id).sort());
  });

  it("requires own plus blind to make 3", () => {
    const { hands } = deal(7);
    const choices = choicesFor(hands, { east: 0, south: 0, west: 0, north: 0 });
    expect(() => blindPass(hands, { ...choices, east: { own: choices.east.own.slice(0, 2), blind: 0 } }, "left")).toThrow(
      /must make 3/,
    );
  });

  it("keeps every tile and every hand size, for any mix of blind passes", () => {
    const blindArb = fc.constantFrom(0, 1, 2, 3) as fc.Arbitrary<0 | 1 | 2 | 3>;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), blindArb, blindArb, blindArb, blindArb, (seed, e, s, w, n) => {
        const { hands } = deal(seed);
        const after = blindPass(hands, choicesFor(hands, { east: e, south: s, west: w, north: n }), "right");
        const ids = (h: typeof hands) => SEATS.flatMap((x) => h[x].map((t) => t.id)).sort((a, b) => a - b);
        expect(ids(after)).toEqual(ids(hands));
        for (const x of SEATS) expect(after[x]).toHaveLength(hands[x].length);
      }),
      { numRuns: 300 },
    );
  });
});
