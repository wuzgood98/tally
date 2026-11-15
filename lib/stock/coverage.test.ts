import { describe, expect, it } from "vitest";

import { gaugeScale, incomingLabel, shelfStatus } from "@/lib/stock/coverage";
import type { Incoming, ShelfLine } from "@/lib/stock/coverage";

const NONE = { inTransit: 0, onOrder: 0, requested: 0 };

const line = (
  onHand: number,
  reorderPoint: number,
  incoming: Partial<Incoming> = {}
): ShelfLine => ({
  inTransit: incoming.inTransit ?? 0,
  onHand,
  onOrder: incoming.onOrder ?? 0,
  reorderPoint,
  requested: incoming.requested ?? 0,
});

describe("shelfStatus", () => {
  it("keeps low and out when nothing is coming", () => {
    expect(shelfStatus(line(5, 10))).toBe("low");
    expect(shelfStatus(line(0, 10))).toBe("out");
  });

  it("calls a line covered once what's coming lifts it above the reorder point", () => {
    expect(shelfStatus(line(0, 40, { onOrder: 41 }))).toBe("covered");
    expect(
      shelfStatus(line(9, 40, { inTransit: 20, onOrder: 0, requested: 12 }))
    ).toBe("covered");
  });

  it("is not covered when what's coming only reaches the reorder point", () => {
    expect(shelfStatus(line(0, 40, { inTransit: 40 }))).toBe("out");
    expect(shelfStatus(line(10, 40, { requested: 5 }))).toBe("low");
  });

  it("keeps a line that needs a count, whatever is coming", () => {
    expect(shelfStatus(line(-2, 60, { inTransit: 500 }))).toBe("count");
  });

  it("leaves healthy lines alone", () => {
    expect(shelfStatus(line(50, 10, { onOrder: 5 }))).toBe("ok");
  });
});

describe("gaugeScale", () => {
  it("runs the track to twice the reorder point", () => {
    expect(gaugeScale(line(15, 30))).toEqual({
      fill: 25,
      incoming: 0,
      mark: 50,
    });
  });

  it("puts what's coming after the shelf", () => {
    expect(gaugeScale(line(9, 40, { onOrder: 24 }))).toEqual({
      fill: 11.3,
      incoming: 30,
      mark: 50,
    });
  });

  it("stretches the track when the shelf holds more than the target", () => {
    expect(gaugeScale(line(400, 50, { onOrder: 100 }))).toEqual({
      fill: 80,
      incoming: 20,
      mark: 10,
    });
  });

  it("draws nothing on the shelf below zero", () => {
    expect(gaugeScale(line(-2, 60)).fill).toBe(0);
  });

  it("survives a reorder point of zero", () => {
    expect(gaugeScale(line(0, 0))).toEqual({ fill: 0, incoming: 0, mark: 0 });
  });
});

describe("incomingLabel", () => {
  it("names the one road stock is coming by", () => {
    expect(incomingLabel({ ...NONE, inTransit: 1200 })).toBe(
      "+1,200 on the way"
    );
    expect(incomingLabel({ ...NONE, requested: 6 })).toBe("+6 requested");
  });

  it("adds them up when it comes by more than one", () => {
    expect(incomingLabel({ inTransit: 10, onOrder: 30, requested: 0 })).toBe(
      "+40 coming"
    );
  });

  it("says nothing when nothing is coming", () => {
    expect(incomingLabel(NONE)).toBeNull();
  });
});
