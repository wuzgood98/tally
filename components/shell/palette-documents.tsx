"use client";

import {
  CommandGroup,
  CommandGroupLabel,
  CommandItem,
  CommandItemIcon,
} from "@ui-sdk/react/command";
import { FileText } from "lucide-react";

import type { PaletteDocument } from "@/lib/palette-documents";
import { documentValue } from "@/lib/palette-results";

const itemClass =
  "text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-11 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none";

export const DocumentResults = ({
  documents,
}: {
  readonly documents: readonly PaletteDocument[];
}) => {
  if (documents.length === 0) {
    return null;
  }

  return (
    <CommandGroup className="pb-1">
      <CommandGroupLabel className="text-ink-3 px-2.5 pt-2 pb-1 text-xs">
        Documents
      </CommandGroupLabel>
      {documents.map((item) => (
        <CommandItem
          className={itemClass}
          key={item.number}
          label={`${item.number} ${item.kind}`}
          value={documentValue(item.number)}
        >
          <CommandItemIcon className="text-ink-3 [&_svg]:size-4">
            <FileText aria-hidden="true" />
          </CommandItemIcon>
          <span className="flex min-w-0 grow flex-col leading-tight">
            <span className="figures truncate">{item.number}</span>
            <span className="text-ink-3 truncate text-xs">{item.detail}</span>
          </span>
          <span className="text-ink-3 shrink-0 text-xs">{item.kind}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
};
