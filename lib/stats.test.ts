import { describe, expect, it } from "vitest";
import { streaks } from "./stats";

describe("streaks", () => {
  it("finds the longest run of wins and the one still going", () => {
    expect(streaks([])).toEqual({ current: 0, best: 0 });
    expect(streaks([true, true, false, true])).toEqual({ current: 1, best: 2 });
    expect(streaks([false, true, true, true])).toEqual({ current: 3, best: 3 });
    expect(streaks([true, true, true, false])).toEqual({ current: 0, best: 3 });
  });
});
