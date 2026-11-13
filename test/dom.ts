import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Import from a test that runs under `// @vitest-environment jsdom`. jsdom lacks
// the popover, animation and layout APIs ui-sdk's popups call.

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}

globalThis.__UI_SDK_STRICT__ = true;

const noop = () => {
  /* jsdom has no popover or layout to update */
};

HTMLElement.prototype.showPopover = noop;

HTMLElement.prototype.hidePopover = noop;

Element.prototype.getAnimations = () => [];

Element.prototype.scrollIntoView = noop;

Element.prototype.checkVisibility = () => true;

const noRects = document.createElement("div").getClientRects();

Element.prototype.getClientRects = () => noRects;

document.elementFromPoint = () => null;

document.elementsFromPoint = () => [];

globalThis.ResizeObserver ??= class {
  observe = noop;
  unobserve = noop;
  disconnect = noop;
};

// `presentation="auto"` asks whether this is a small touch screen: it isn't.
globalThis.matchMedia ??= (query: string): MediaQueryList => ({
  addEventListener: noop,
  // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList still requires it
  addListener: noop,
  dispatchEvent: () => false,
  matches: false,
  media: query,
  onchange: null,
  removeEventListener: noop,
  // oxlint-disable-next-line typescript/no-deprecated -- MediaQueryList still requires it
  removeListener: noop,
});

document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  })
);

afterEach(cleanup);
