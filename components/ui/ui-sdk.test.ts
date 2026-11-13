import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
import { Pagination } from "./pagination";

// Class names carry Tailwind variants like `data-pending:`, so drop them
// before asserting on attributes.
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element).replaceAll(/ class="[^"]*"/gu, "");

const pageHref = (page: number) => `/products?page=${page}`;

describe("Button", () => {
  it("renders a native button that doesn't submit by default", () => {
    const markup = html(createElement(Button, null, "Save"));

    expect(markup).toMatch(/^<button[^>]*type="button"/u);
    expect(markup).toContain('data-slot="button"');
    expect(markup).toContain(">Save</button>");
    expect(markup).not.toContain("aria-disabled");
    expect(markup).not.toContain("data-pending");
  });

  it("submits its form and is natively disabled while pending", () => {
    const markup = html(
      createElement(Button, { disabled: true, type: "submit" }, "Save")
    );

    expect(markup).toContain('type="submit"');
    expect(markup).toMatch(/ disabled=""/u);
    expect(markup).toContain("data-disabled");
  });
});

describe("Pagination", () => {
  it("names the landmark and marks the current page", () => {
    const markup = html(
      createElement(Pagination, {
        href: pageHref,
        noun: "products",
        page: 3,
        pageSize: 25,
        total: 260,
      })
    );

    expect(markup).toContain("51–75 of 260 products");
    expect(markup).toMatch(/<nav[^>]*aria-label="Pages"/u);
    expect(markup).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/products\?page=3"|<a[^>]*href="\/products\?page=3"[^>]*aria-current="page"/u
    );
    expect(markup).toContain('href="/products?page=2"');
    expect(markup).toContain('href="/products?page=4"');
    expect(markup).toContain('href="/products?page=11"');
    expect(markup).toContain(">Previous<");
    expect(markup).toContain(">Next<");
  });

  it("disables Previous on the first page", () => {
    const markup = html(
      createElement(Pagination, {
        href: pageHref,
        noun: "products",
        page: 1,
        pageSize: 25,
        total: 60,
      })
    );

    const previous = /<a[^>]*data-slot="pagination-previous"[^>]*>/u.exec(
      markup
    )?.[0];

    expect(previous).toBeDefined();
    expect(previous).toContain('aria-disabled="true"');
    expect(previous).not.toContain("href=");
  });

  it("shows only the count when everything fits on one page", () => {
    const markup = html(
      createElement(Pagination, {
        href: pageHref,
        noun: "products",
        page: 1,
        pageSize: 25,
        total: 0,
      })
    );

    expect(markup).toContain("No products");
    expect(markup).not.toContain("<nav");
  });
});
