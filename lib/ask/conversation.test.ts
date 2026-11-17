import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";

import {
  ASK_FAILED,
  askFailure,
  askRunningTool,
  askStatusLine,
  isEmptyAnswer,
  linkRecords,
  toolLinks,
} from "@/lib/ask/conversation";
import { askPaletteSettings, askSuggestions } from "@/lib/ask/suggestions";
import { askRowLabel, opensAsk } from "@/lib/palette-ask";
import type { Actor } from "@/lib/permissions";

const manager: Actor = { branchId: "SPX", id: "m", role: "manager" };
const storekeeper: Actor = { branchId: "TMA", id: "s", role: "storekeeper" };
const admin: Actor = { branchId: null, id: "a", role: "admin" };

type ToolInput = Readonly<Record<string, string>>;

interface ToolOutput {
  readonly lines: readonly Readonly<Record<string, string>>[];
}

const toolPart = (
  toolName: string,
  state: "input-available" | "output-available",
  input: ToolInput,
  output?: ToolOutput
): UIMessage["parts"][number] =>
  state === "output-available"
    ? {
        input,
        output,
        state,
        toolCallId: toolName,
        toolName,
        type: "dynamic-tool",
      }
    : { input, state, toolCallId: toolName, toolName, type: "dynamic-tool" };

const assistant = (parts: UIMessage["parts"]): UIMessage => ({
  id: "a1",
  parts,
  role: "assistant",
});

describe("toolLinks", () => {
  it("collects the records the tools linked, and nothing the model wrote", () => {
    const messages = [
      assistant([
        toolPart(
          "lowStock",
          "output-available",
          {},
          {
            lines: [
              { link: "[Milo 400g](/products/7)" },
              { link: "[PO-SPX-000012](/purchase-orders/12)" },
            ],
          }
        ),
        {
          text: "See [elsewhere](https://evil.example) and [staff](/staff)",
          type: "text",
        },
      ]),
    ];

    const links = toolLinks(messages);

    expect([...links.labels]).toEqual([
      ["Milo 400g", "/products/7"],
      ["PO-SPX-000012", "/purchase-orders/12"],
    ]);
    expect([...links.hrefs]).toEqual(["/products/7", "/purchase-orders/12"]);
  });

  it("reads only link fields, to Tally's own record pages", () => {
    const messages = [
      assistant([
        toolPart(
          "lowStock",
          "output-available",
          {},
          {
            lines: [
              // A name can't bring a link in, whatever it holds.
              { link: "[Rice](/products/1)", name: "[Rice](//evil.example)" },
              { link: "[Away](//evil.example/products/2)" },
              { link: "[Staff](/staff/3)" },
            ],
          }
        ),
      ]),
    ];

    expect([...toolLinks(messages).hrefs]).toEqual(["/products/1"]);
  });

  it("keeps a shared label's links but won't guess which one is meant", () => {
    const messages = [
      assistant([
        toolPart(
          "lowStock",
          "output-available",
          {},
          {
            lines: [
              { link: "[Milo 400g](/products/7)" },
              { link: "[Milo 400g](/products/8)" },
            ],
          }
        ),
      ]),
    ];

    const links = toolLinks(messages);

    expect([...links.hrefs]).toEqual(["/products/7", "/products/8"]);
    expect(links.labels.has("Milo 400g")).toBe(false);
  });
});

describe("linkRecords", () => {
  const links = new Map([
    ["TRF-TMA-000017", "/transfers/17"],
    ["Milo 400g", "/products/7"],
    ["Milo", "/products/99"],
    ["Rice", "/products/5"],
  ]);

  it("links records the answer names but didn't link", () => {
    expect(linkRecords("**TRF-TMA-000017** is on the road.", links)).toBe(
      "**[TRF-TMA-000017](/transfers/17)** is on the road."
    );
  });

  it("leaves links alone and prefers the longest name", () => {
    expect(linkRecords("[Milo 400g](/products/7) and Milo 400g", links)).toBe(
      "[Milo 400g](/products/7) and [Milo 400g](/products/7)"
    );
  });

  it("matches whole words only, and never inside a link", () => {
    expect(linkRecords("The Price of Rice", links)).toBe(
      "The Price of [Rice](/products/5)"
    );
    expect(linkRecords("[Brown Rice](/products/6)", links)).toBe(
      "[Brown Rice](/products/6)"
    );
  });

  it("changes nothing without links", () => {
    expect(linkRecords("Nothing here.", new Map())).toBe("Nothing here.");
  });
});

describe("isEmptyAnswer", () => {
  it("is true for an answer with tools and no words", () => {
    expect(
      isEmptyAnswer(
        assistant([toolPart("lowStock", "output-available", {}, { lines: [] })])
      )
    ).toBe(true);
    expect(isEmptyAnswer(assistant([{ text: "Two.", type: "text" }]))).toBe(
      false
    );
    expect(isEmptyAnswer(undefined)).toBe(false);
  });
});

describe("askStatusLine", () => {
  it("says what the running tool is doing, and where", () => {
    expect(
      askStatusLine(
        assistant([
          toolPart("lowStock", "input-available", { branch: "Kumasi" }),
        ])
      )
    ).toBe("Checking what's low at Kumasi…");
    expect(
      askStatusLine(
        assistant([
          toolPart("findProducts", "input-available", { query: "rice" }),
        ])
      )
    ).toBe("Looking up products…");
    expect(
      askStatusLine(
        assistant([toolPart("transfers", "input-available", { branch: "all" })])
      )
    ).toBe("Checking transfers across all branches…");
  });

  it("thinks between tools and before the first", () => {
    expect(askStatusLine(undefined)).toBe("Thinking…");
    expect(
      askStatusLine(
        assistant([toolPart("lowStock", "output-available", {}, { lines: [] })])
      )
    ).toBe("Thinking…");
  });
});

describe("askRunningTool", () => {
  it("names the tool at work, or none while thinking", () => {
    expect(
      askRunningTool(
        assistant([
          toolPart("lowStock", "input-available", { branch: "Kumasi" }),
        ])
      )
    ).toBe("lowStock");
    expect(askRunningTool(undefined)).toBeNull();
    expect(
      askRunningTool(
        assistant([toolPart("lowStock", "output-available", {}, { lines: [] })])
      )
    ).toBeNull();
  });
});

describe("askFailure", () => {
  it("passes on the route's own message, offering Retry only where it helps", () => {
    const limited = new Error(
      JSON.stringify({
        error: { code: "rate_limited", message: "Try again at 14:05." },
      })
    );

    expect(askFailure(limited)).toEqual({
      message: "Try again at 14:05.",
      retry: false,
    });
    expect(
      askFailure(
        new Error(
          JSON.stringify({
            error: { code: "unauthorized", message: "Sign in to ask Tally." },
          })
        )
      )
    ).toEqual({ message: "Sign in to ask Tally.", retry: false });
  });

  it("says something plain for anything else", () => {
    expect(askFailure(new Error("Failed to fetch"))).toEqual({
      message: ASK_FAILED,
      retry: true,
    });
  });
});

describe("askSuggestions", () => {
  it("words them for the branch on screen and the person's reports", () => {
    expect(
      askSuggestions(manager, { id: "SPX", kind: "store", name: "Spintex" })
    ).toEqual([
      "What's running low at Spintex?",
      "What's on the way to Spintex?",
      "What sold best at Spintex this week?",
      "How much stock did Spintex lose this month?",
    ]);
  });

  it("offers a manager no report on a branch that isn't theirs", () => {
    const elsewhere = askSuggestions(manager, {
      id: "KSI",
      kind: "store",
      name: "Kumasi",
    });

    expect(elsewhere.join(" ")).not.toMatch(/lose|shrinkage/u);
    expect(askSuggestions(manager, null).join(" ")).not.toMatch(
      /lose|shrinkage/u
    );
  });

  it("asks a warehouse about requests, and offers no reports to a storekeeper", () => {
    const questions = askSuggestions(storekeeper, {
      id: "TMA",
      kind: "warehouse",
      name: "Tema Distribution Centre",
    });

    expect(questions).toContain(
      "Which stock requests are waiting to be fulfilled?"
    );
    expect(questions.join(" ")).not.toMatch(/lose|shrinkage/u);
  });

  it("asks about the whole company for all branches", () => {
    expect(askSuggestions(admin, null)).toContain(
      "Which branch lost the most to shrinkage this month?"
    );
  });
});

describe("askPaletteSettings", () => {
  const branches = [{ id: "SPX", kind: "store" as const, name: "Spintex" }];

  it("is null when Ask Tally is off or for a cashier", () => {
    const cashier: Actor = { branchId: "SPX", id: "c", role: "cashier" };
    const spintex = { branchId: "SPX", kind: "branch" as const };

    expect(askPaletteSettings(manager, spintex, branches, false)).toBeNull();
    expect(askPaletteSettings(cashier, spintex, branches, true)).toBeNull();
  });

  it("words the suggestions for the branch on screen", () => {
    expect(
      askPaletteSettings(
        manager,
        { branchId: "SPX", kind: "branch" },
        branches,
        true
      )?.suggestions[0]
    ).toBe("What's running low at Spintex?");
    expect(
      askPaletteSettings(admin, { kind: "all" }, branches, true)?.suggestions[0]
    ).toBe("What's running low across the branches?");
  });
});

describe("the palette's Ask row", () => {
  it("carries what's typed over, shortened when long", () => {
    expect(askRowLabel("  ")).toBe("Ask Tally");
    expect(askRowLabel("what is low")).toBe("Ask Tally: “what is low”");
    expect(askRowLabel("x".repeat(80))).toBe(`Ask Tally: “${"x".repeat(59)}…”`);
  });

  it("opens on ? typed into an empty search only", () => {
    expect(opensAsk("", "?")).toBe(true);
    expect(opensAsk("rice", "rice?")).toBe(false);
    expect(opensAsk("", "a")).toBe(false);
  });
});
