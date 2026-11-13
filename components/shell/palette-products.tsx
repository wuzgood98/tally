"use client";

import {
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandItemIcon,
} from "@ui-sdk/react/command";
import { ArrowRight, Package } from "lucide-react";

import { productValue, SEE_ALL_PRODUCTS } from "@/lib/palette-results";
import type { PaletteProduct } from "@/lib/palette-search";
import { cn } from "@/lib/utils";

const StockLabel = ({ units }: { readonly units: number | null }) =>
  units === null ? (
    "Not stocked"
  ) : (
    <>
      <span className="figures">{units.toLocaleString("en-GH")}</span> on hand
    </>
  );

const itemClass =
  "text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-11 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none";

interface ProductResultsProps {
  readonly products: readonly PaletteProduct[];
  readonly query: string;
}

export const ProductResults = ({ products, query }: ProductResultsProps) => {
  if (products.length === 0) {
    return null;
  }

  return (
    <CommandGroup className="pb-1">
      <CommandGroupLabel className="text-ink-3 px-2.5 pt-2 pb-1 text-xs">
        Products
      </CommandGroupLabel>
      {products.map((item) => (
        <CommandItem
          className={itemClass}
          key={item.id}
          label={`${item.name} ${item.sku}`}
          value={productValue(item.id)}
        >
          <CommandItemIcon className="text-ink-3 [&_svg]:size-4">
            <Package aria-hidden="true" />
          </CommandItemIcon>
          <span className="flex min-w-0 grow flex-col leading-tight">
            <span className="truncate">{item.name}</span>
            <span className="text-ink-3 figures truncate text-xs">
              {item.sku}
              {item.active ? null : " · Discontinued"}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 text-xs",
              item.onHand !== null && item.onHand <= 0
                ? "text-warn"
                : "text-ink-3"
            )}
          >
            <StockLabel units={item.onHand} />
          </span>
        </CommandItem>
      ))}
      <CommandItem
        className={itemClass}
        label="See all results"
        value={SEE_ALL_PRODUCTS}
      >
        <CommandItemIcon className="text-ink-3 [&_svg]:size-4" mirror>
          <ArrowRight aria-hidden="true" />
        </CommandItemIcon>
        <span className="truncate">See all results for “{query.trim()}”</span>
      </CommandItem>
    </CommandGroup>
  );
};
