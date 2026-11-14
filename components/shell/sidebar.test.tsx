// @vitest-environment jsdom
import "@/test/dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { Dialog, DialogContent, DialogTitle } from "@ui-sdk/react/dialog";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SIDEBAR_MEDIA } from "@/lib/sidebar";

import { SidebarProvider, useSidebar } from "./sidebar";

const Probe = () => (
  <p data-testid="state">{useSidebar().collapsed ? "collapsed" : "expanded"}</p>
);

/** Pretends the window is (or isn't) wide enough for the sidebar. */
const setDesktop = (desktop: boolean) => {
  const real = window.matchMedia;

  vi.spyOn(window, "matchMedia").mockImplementation((query) =>
    Object.assign(real(query), { matches: query === SIDEBAR_MEDIA && desktop })
  );
};

const renderSidebar = (extra?: ReactNode) =>
  render(
    <SidebarProvider defaultCollapsed={false}>
      <Probe />
      {extra}
    </SidebarProvider>
  );

/** Presses Ctrl+B and says whether anything claimed the key. */
const pressCtrlB = (): boolean =>
  !fireEvent.keyDown(document, { ctrlKey: true, key: "b" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the sidebar shortcut", () => {
  it("collapses and expands the sidebar on a desktop", () => {
    setDesktop(true);
    renderSidebar();

    expect(pressCtrlB()).toBe(true);
    expect(screen.getByTestId("state").textContent).toBe("collapsed");

    pressCtrlB();

    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });

  it("leaves Ctrl+B to the browser below lg", () => {
    setDesktop(false);
    renderSidebar();

    expect(pressCtrlB()).toBe(false);
    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });

  it("does nothing behind an open dialog", () => {
    setDesktop(true);
    renderSidebar(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Something else</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    pressCtrlB();

    expect(screen.getByTestId("state").textContent).toBe("expanded");
  });
});
