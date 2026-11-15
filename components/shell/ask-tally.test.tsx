// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { PaletteGroup } from "@/lib/palette";

import { CommandPalette, PaletteFieldTrigger } from "./command-palette";

const GROUPS: PaletteGroup[] = [
  {
    commands: [
      {
        href: "/low-stock",
        icon: "low-stock",
        kind: "link",
        label: "Low stock",
        value: "go:/low-stock",
      },
    ],
    label: "Go to",
  },
];

const SUGGESTIONS = ["What's running low at Spintex?", "What sold best?"];

const renderPalette = (ask: { suggestions: readonly string[] } | null) =>
  render(
    <CommandPalette
      ask={ask}
      branches={[]}
      groups={GROUPS}
      onNavigate={() => {
        /* links in answers navigate through next/link */
      }}
      onSetTheme={() => {
        /* not under test */
      }}
      onSignOut={vi.fn(async () => {
        await Promise.resolve();
      })}
      onSwitchScope={vi.fn(async () => {
        await Promise.resolve();
      })}
      scope="SPX"
      search={async () =>
        await Promise.resolve({ documents: [], products: [] })
      }
      theme="system"
    >
      <PaletteFieldTrigger />
    </CommandPalette>
  );

/** A UI message stream, as the route sends it. */
const streamOf = (chunks: readonly object[]): Response => {
  const body = [
    ...chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`),
    "data: [DONE]\n\n",
  ].join("");

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  });
};

const ANSWER = [
  { type: "start" },
  { type: "start-step" },
  {
    dynamic: true,
    input: { branch: "Spintex" },
    toolCallId: "call-1",
    toolName: "lowStock",
    type: "tool-input-available",
  },
  {
    dynamic: true,
    output: {
      covers: "Spintex",
      lines: [{ link: "[Milo 400g](/products/7)" }],
    },
    toolCallId: "call-1",
    type: "tool-output-available",
  },
  { type: "finish-step" },
  { type: "start-step" },
  { id: "t1", type: "text-start" },
  {
    delta: "At Spintex: [Milo 400g](/products/7) is out. See [staff](/staff).",
    id: "t1",
    type: "text-delta",
  },
  { id: "t1", type: "text-end" },
  { type: "finish-step" },
  { type: "finish" },
];

const open = async () => {
  const user = userEvent.setup();
  await user.keyboard("{Control>}k{/Control}");

  return user;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ask Tally in the palette", () => {
  it("opens from ? in an empty palette, with suggested questions", async () => {
    renderPalette({ suggestions: SUGGESTIONS });
    const user = await open();

    await user.type(await screen.findByRole("combobox"), "?");

    expect(
      await screen.findByRole("textbox", { name: "Ask Tally a question" })
    ).toBe(document.activeElement);
    expect(screen.getByRole("button", { name: SUGGESTIONS[0] })).toBeTruthy();
  });

  it("carries what was typed over and links only what the tools returned", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        await Promise.resolve(streamOf(ANSWER))
    );

    vi.stubGlobal("fetch", fetchMock);
    renderPalette({ suggestions: SUGGESTIONS });
    const user = await open();

    await user.type(await screen.findByRole("combobox"), "what is low");
    await user.click(
      screen.getByRole("option", { name: "Ask Tally: “what is low”" })
    );

    const log = await screen.findByRole("log", {
      name: "Ask Tally conversation",
    });

    const link = await within(log).findByRole("link", { name: "Milo 400g" });

    expect(link.getAttribute("href")).toBe("/products/7");
    expect(within(log).queryByRole("link", { name: "staff" })).toBeNull();
    expect(within(log).getByText("what is low")).toBeTruthy();

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const { body } = z.object({ body: z.string() }).parse(init);

    expect(body).toContain("what is low");
  });

  it("says when the hour's questions are used up, without a Retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          await Promise.resolve(
            Response.json(
              {
                error: {
                  code: "rate_limited",
                  message:
                    "You've asked 20 questions this hour. Try again at 15 Nov, 14:05.",
                },
              },
              { status: 429 }
            )
          )
      )
    );
    renderPalette({ suggestions: SUGGESTIONS });
    const user = await open();

    await user.type(await screen.findByRole("combobox"), "?");
    await user.click(screen.getByRole("button", { name: SUGGESTIONS[0] }));

    expect(
      await screen.findByText(
        "You've asked 20 questions this hour. Try again at 15 Nov, 14:05."
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("goes back to the commands with Backspace before anything is asked", async () => {
    renderPalette({ suggestions: SUGGESTIONS });
    const user = await open();

    await user.type(await screen.findByRole("combobox"), "?");
    await screen.findByRole("textbox", { name: "Ask Tally a question" });
    await user.keyboard("{Backspace}");

    expect(await screen.findByRole("combobox")).toBe(document.activeElement);
  });

  it("offers nothing when Ask Tally is off", async () => {
    renderPalette(null);
    const user = await open();

    await user.type(await screen.findByRole("combobox"), "zzz");

    expect(screen.queryByRole("option", { name: /Ask Tally/u })).toBeNull();
    expect(await screen.findByText("Nothing matches “zzz”.")).toBeTruthy();
  });
});
