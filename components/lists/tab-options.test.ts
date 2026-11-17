import { describe, expect, it } from "vitest";

import { clearParams, queryString } from "@/lib/search-params";

import { tabOptions } from "./tab-options";

const STATUS_FILTER = {
  defaultValue: "all",
  param: "status",
  values: ["all", "low", "out"],
} as const;

describe("tabOptions", () => {
  it("links each value to the list, the default without its param", () => {
    expect(
      tabOptions(
        STATUS_FILTER,
        { all: "All active", low: "Running low", out: "Out of stock" },
        (value) => `/products${queryString({ q: "rice", status: value })}`
      )
    ).toEqual([
      { href: "/products?q=rice", label: "All active", value: "all" },
      {
        href: "/products?q=rice&status=low",
        label: "Running low",
        value: "low",
      },
      {
        href: "/products?q=rice&status=out",
        label: "Out of stock",
        value: "out",
      },
    ]);
  });
});

describe("clearParams", () => {
  it("lists each filter's param, then the others", () => {
    expect(
      clearParams(
        [STATUS_FILTER, { defaultValue: "", param: "category" }],
        ["q", "page"]
      )
    ).toEqual(["status", "category", "q", "page"]);
  });
});
