import { describe, expect, it } from "vitest";

import { transferNotice } from "@/lib/transfer-notices";

const transfer = {
  fromName: "Tema Distribution Centre",
  lines: [
    { quantityReceived: 30, quantitySent: 30 },
    { quantityReceived: 7, quantitySent: 10 },
  ],
  number: "TRF-TMA-000042",
  toName: "Spintex",
};

describe("transferNotice", () => {
  it("says what left and where it's going, with a link to send another", () => {
    expect(transferNotice("sent", transfer)).toEqual({
      action: { href: "/transfers/new", label: "Send another" },
      description:
        "40 units on the way from Tema Distribution Centre to Spintex.",
      title: "TRF-TMA-000042 sent",
    });
  });

  it("names a shortfall on receipt", () => {
    expect(transferNotice("received", transfer).description).toBe(
      "37 units added to Spintex; 3 units recorded as lost in transit."
    );
  });

  it("leaves out the shortfall when everything arrived", () => {
    const whole = {
      ...transfer,
      lines: [{ quantityReceived: 1, quantitySent: 1 }],
    };

    expect(transferNotice("received", whole).description).toBe(
      "1 unit added to Spintex."
    );
  });

  it("says the stock went back on cancelling", () => {
    expect(transferNotice("cancelled", transfer)).toEqual({
      description: "40 units back at Tema Distribution Centre.",
      title: "TRF-TMA-000042 cancelled",
    });
  });
});
