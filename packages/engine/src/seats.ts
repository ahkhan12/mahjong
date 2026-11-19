// Seats and directions. Play moves to the right: East → South → West → North.

export type Seat = "east" | "south" | "west" | "north";
export const SEATS: readonly Seat[] = ["east", "south", "west", "north"];

export type Direction = "right" | "across" | "left";

const OFFSET: Record<Direction, number> = { right: 1, across: 2, left: 3 };

/** The seat that receives tiles when `seat` passes in `direction`. */
export function seatTo(seat: Seat, direction: Direction): Seat {
  const i = SEATS.indexOf(seat);
  return SEATS[(i + OFFSET[direction]) % 4]!;
}

/** The seat that `seat` receives from when everyone passes in `direction`. */
export function seatFrom(seat: Seat, direction: Direction): Seat {
  const i = SEATS.indexOf(seat);
  return SEATS[(i - OFFSET[direction] + 4) % 4]!;
}
