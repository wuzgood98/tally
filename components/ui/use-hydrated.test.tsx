// @vitest-environment jsdom
import "@/test/dom";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";

import { useHydrated } from "./use-hydrated";

/** Like the palette's theme icon: a choice only the browser knows. */
const SavedChoice = ({ saved }: { readonly saved: string }) => {
  const hydrated = useHydrated();

  return <span>{hydrated ? saved : "default"}</span>;
};

it("renders the server's value through hydration, then the browser's", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<SavedChoice saved="dark" />);
  expect(container.textContent).toBe("default");

  const mismatches: unknown[] = [];

  act(() => {
    hydrateRoot(container, <SavedChoice saved="dark" />, {
      onRecoverableError: (error) => {
        mismatches.push(error);
      },
    });
  });

  expect(mismatches).toStrictEqual([]);
  expect(container.textContent).toBe("dark");
});
