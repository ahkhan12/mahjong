import { describe, expect, it } from "vitest";
import { PRACTICE_CARD, choosePass, closestDistinct, deal, isJoker, reviewPass, type Tile, type TileKind } from "../src/index.js";

function kindFromCode(code: string): TileKind {
  if (code === "J") return { type: "joker" };
  if (code === "F") return { type: "flower" };
  if (code[0] === "W") return { type: "wind", wind: code[1] as "N" };
  if (code[0] === "D" && "RGW".includes(code[1]!)) {
    return { type: "dragon", dragon: ({ R: "red", G: "green", W: "white" } as const)[code[1] as "R"] };
  }
  const suit = ({ B: "bam", C: "crak", D: "dot" } as const)[code[0] as "B"];
  return { type: "suit", suit, rank: Number(code[1]) as 1 };
}
const tiles = (codes: string): Tile[] => codes.split(" ").map((c, id) => ({ id, kind: kindFromCode(c) }));

describe("choosePass", () => {
  it("never passes jokers and always picks 3 different tiles", () => {
    for (let seed = 0; seed < 50; seed++) {
      const hand = deal(seed).hands.east;
      const ids = choosePass(hand, PRACTICE_CARD);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) expect(isJoker(hand.find((t) => t.id === id)!)).toBe(false);
    }
  });

  it("passes tiles that don't fit a hand you're close to", () => {
    // Nearly the winds hand, plus three loose number tiles.
    const hand = tiles("WN WN WN WN WE WE WE WW WW WW WS B3 C7 D9");
    const passed = choosePass(hand, PRACTICE_CARD).map((id) => hand[id]!.kind);
    expect(passed.every((k) => k.type === "suit")).toBe(true);
  });
});

describe("reviewPass", () => {
  const hand = tiles("WN WN WN WN WE WE WE WW WW WW WS B3 C7 D9");

  it("rates the suggested pass as great", () => {
    const suggested = choosePass(hand, PRACTICE_CARD);
    expect(reviewPass(hand, suggested, PRACTICE_CARD).rating).toBe("great");
  });

  it("flags passing tiles your closest hand needs", () => {
    const review = reviewPass(hand, [0, 1, 2], PRACTICE_CARD); // three North winds
    expect(review.rating).not.toBe("great");
    expect(review.reason).toMatch(/WN/);
  });

  it("lists the 3 closest different hands", () => {
    const rows = closestDistinct(hand, PRACTICE_CARD);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.handId)).size).toBe(3);
    expect(rows[0]!.handId).toBe("wind-1");
  });
});
