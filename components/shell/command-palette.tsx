"use client";

import { useAsyncOptions } from "@ui-sdk/react/async-options";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandItemIcon,
  CommandList,
  CommandPage,
} from "@ui-sdk/react/command";
import {
  createDialogController,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import {
  ChartColumn,
  ChartLine,
  ClipboardList,
  Inbox,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Package,
  PackageMinus,
  PackagePlus,
  Receipt,
  ScanBarcode,
  ScrollText,
  Search,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, use, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { Kbd } from "@/components/ui/kbd";
import { ACCOUNT_GROUP } from "@/lib/palette";
import type {
  PaletteCommand,
  PaletteGroup,
  PaletteIcon,
  PaletteLink,
} from "@/lib/palette";
import { BRANCH_PAGE, scopeOf } from "@/lib/palette-branches";
import type { PaletteBranch } from "@/lib/palette-branches";
import { paletteScore } from "@/lib/palette-filter";
import {
  documentsFirst,
  hitsOf,
  MIN_SEARCH_LENGTH,
  resultHref,
  resultScore,
} from "@/lib/palette-results";
import type { PaletteHit, PaletteSearch } from "@/lib/palette-results";
import { THEME_PAGE, themeOf } from "@/lib/palette-theme";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

import { BranchGroup, BranchPage } from "./palette-branches";
import { DocumentResults } from "./palette-documents";
import { ProductResults } from "./palette-products";
import { ThemeGroup, ThemePage } from "./palette-theme";

const SHORTCUT = "mod+k";
const TITLE = "Search or jump to";

const ICONS: Record<PaletteIcon, LucideIcon> = {
  adjustments: ClipboardList,
  "low-stock": TriangleAlert,
  movements: ScrollText,
  overview: LayoutDashboard,
  products: Package,
  "purchase-orders": ShoppingCart,
  receipts: PackagePlus,
  reports: ChartLine,
  requests: Inbox,
  sales: Receipt,
  sellers: ChartColumn,
  shrinkage: PackageMinus,
  "sign-out": LogOut,
  staff: Users,
  "stock-value": TrendingUp,
  till: ScanBarcode,
  tills: MonitorSmartphone,
  transfers: Truck,
};

const createPaletteController = () =>
  createDialogController<unknown, unknown>();

type PaletteController = ReturnType<typeof createPaletteController>;

const PaletteContext = createContext<PaletteController | null>(null);

const usePalette = (): PaletteController => {
  const palette = use(PaletteContext);

  if (palette === null) {
    throw new Error("Palette triggers must sit inside CommandPalette");
  }

  return palette;
};

interface ShortcutHint {
  readonly text: string;
  readonly ariaKeyshortcuts: string;
}

const PaletteRow = ({
  command,
  hint,
}: {
  readonly command: PaletteCommand;
  readonly hint?: ShortcutHint;
}) => {
  const Icon = ICONS[command.icon];

  return (
    <CommandItem
      aria-keyshortcuts={hint?.ariaKeyshortcuts}
      className="text-ink-2 data-highlighted:bg-ink/6 data-highlighted:text-ink flex min-h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none data-pending:cursor-progress data-pending:opacity-60"
      keywords={
        command.keywords === undefined ? undefined : [...command.keywords]
      }
      label={command.label}
      value={command.value}
    >
      <CommandItemIcon className="text-ink-3 [&_svg]:size-4">
        <Icon aria-hidden="true" />
      </CommandItemIcon>
      <span className="grow truncate">{command.label}</span>
      {hint === undefined ? null : (
        // Keys only help where there's a keyboard.
        <Kbd aria-hidden="true" className="pointer-coarse:hidden">
          {hint.text}
        </Kbd>
      )}
    </CommandItem>
  );
};

const ShortcutRow = ({
  command,
  shortcut,
}: {
  readonly command: PaletteCommand;
  readonly shortcut: string;
}) => <PaletteRow command={command} hint={useShortcutHint(shortcut)} />;

const PaletteItem = ({ command }: { readonly command: PaletteCommand }) =>
  command.shortcut === undefined ? (
    <PaletteRow command={command} />
  ) : (
    <ShortcutRow command={command} shortcut={command.shortcut} />
  );

/** Registers one command's shortcut for as long as the app is open. */
const CommandShortcut = ({
  command,
  onOpen,
  shortcut,
}: {
  readonly command: PaletteLink;
  readonly onOpen: (href: string) => void;
  readonly shortcut: string;
}) => {
  useShortcut(
    shortcut,
    () => {
      onOpen(command.href);
    },
    { description: command.label }
  );

  return null;
};

const FooterKey = ({
  className,
  keys,
  label,
}: {
  readonly keys: readonly string[];
  readonly label: string;
  readonly className?: string;
}) => (
  <span className={cn("flex items-center gap-1.5", className)}>
    <span className="flex gap-0.5">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
    {label}
  </span>
);

/** How to drive the palette from the keyboard. Hidden on touch screens. */
const PaletteFooter = ({ onSubPage }: { readonly onSubPage: boolean }) => {
  const enter = useShortcutHint("enter");
  const backspace = useShortcutHint("backspace");

  return (
    <div
      aria-hidden="true"
      className="border-line text-ink-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs pointer-coarse:hidden"
    >
      <FooterKey keys={[enter.text]} label="Open" />
      <FooterKey keys={["↑", "↓"]} label="Move" />
      {onSubPage ? <FooterKey keys={[backspace.text]} label="Back" /> : null}
      <FooterKey className="ms-auto" keys={["Esc"]} label="Close" />
    </div>
  );
};

const CommandGroupOf = ({ group }: { readonly group: PaletteGroup }) => (
  <CommandGroup className="pb-1">
    <CommandGroupLabel className="text-ink-3 px-2.5 pt-2 pb-1 text-xs">
      {group.label}
    </CommandGroupLabel>
    {group.commands.map((command) => (
      <PaletteItem command={command} key={command.value} />
    ))}
  </CommandGroup>
);

const placeholderFor = (subPage: string | undefined): string => {
  if (subPage === BRANCH_PAGE) {
    return "Find a branch… (Backspace to go back)";
  }

  if (subPage === THEME_PAGE) {
    return "Choose a theme… (Backspace to go back)";
  }

  return "Search pages, products and document numbers…";
};

export interface CommandPaletteProps {
  readonly groups: readonly PaletteGroup[];
  readonly children: ReactNode;
  readonly onNavigate: (href: string) => void;
  readonly onSignOut: () => Promise<void>;
  readonly search: PaletteSearch;
  readonly branches: readonly PaletteBranch[];
  /** "all", or the id of the branch every screen shows. */
  readonly scope: string;
  readonly onSwitchScope: (scope: string) => Promise<void>;
  readonly theme: Theme;
  readonly onSetTheme: (theme: Theme) => Promise<void>;
}

/**
 * Cmd/Ctrl+K from anywhere: pages, things to create, sign out. The commands
 * come from the server (`paletteCommands`), already cut to what this person
 * may use; the triggers below open the one dialog through its controller.
 * It opens without animating, since people do this all day.
 */
export const CommandPalette = ({
  groups,
  children,
  onNavigate,
  onSignOut,
  search,
  branches,
  scope,
  onSwitchScope,
  theme,
  onSetTheme,
}: CommandPaletteProps) => {
  // One controller for the life of the app; the triggers share it.
  const palette = useMemo(() => createPaletteController(), []);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const subPage = pages.at(-1);

  const results = useAsyncOptions<PaletteHit>(
    async (text) =>
      text.trim().length < MIN_SEARCH_LENGTH ? [] : hitsOf(await search(text)),
    { debounce: 150 }
  );

  const products = results.items.flatMap((hit) =>
    hit.type === "product" ? [hit.product] : []
  );

  const documents = results.items.flatMap((hit) =>
    hit.type === "document" ? [hit.document] : []
  );

  const changeQuery = (text: string): void => {
    setQuery(text);
    // Products and documents live on the first page only.
    results.setQuery(subPage === undefined ? text : "");
  };

  const byValue = useMemo(
    () =>
      new Map(
        groups.flatMap((group) =>
          group.commands.map((command) => [command.value, command] as const)
        )
      ),
    [groups]
  );

  useShortcut(
    SHORTCUT,
    () => {
      palette.toggle();
    },
    { allowInInput: true, description: TITLE }
  );

  const run = async (value: string): Promise<void> => {
    const resultPage = resultHref(value, query, results.items);

    if (resultPage !== null) {
      palette.close();
      onNavigate(resultPage);

      return;
    }

    const nextTheme = themeOf(value);

    if (nextTheme !== null) {
      await onSetTheme(nextTheme);
      palette.close();

      return;
    }

    const nextScope = scopeOf(value);

    if (nextScope !== null) {
      await onSwitchScope(nextScope);
      palette.close();

      return;
    }

    const command = byValue.get(value);

    if (command === undefined) {
      return;
    }

    if (command.kind === "sign-out") {
      await onSignOut();

      return;
    }

    palette.close();
    onNavigate(command.href);
  };

  return (
    <PaletteContext value={palette}>
      {children}
      {groups.flatMap((group) =>
        group.commands.map((command) =>
          command.kind === "link" && command.shortcut !== undefined ? (
            <CommandShortcut
              command={command}
              key={command.value}
              onOpen={(href) => {
                palette.close();
                onNavigate(href);
              }}
              shortcut={command.shortcut}
            />
          ) : null
        )
      )}
      <Dialog
        controller={palette}
        onOpenChange={(open) => {
          if (open) {
            setPages([]);
            changeQuery("");
          }
        }}
        pendingAnnouncement="Working…"
        presentation="auto"
      >
        <DialogBackdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity duration-150 data-ending-style:opacity-0 motion-reduce:transition-none" />
        <DialogContent
          className="border-line-strong bg-surface text-ink shadow-float z-50 flex w-full flex-col gap-0 overflow-hidden border p-0 font-sans data-[presentation=dialog]:mx-auto data-[presentation=dialog]:mt-[12vh] data-[presentation=dialog]:mb-auto data-[presentation=dialog]:max-h-[min(32rem,76vh)] data-[presentation=dialog]:w-[calc(100%-2rem)] data-[presentation=dialog]:max-w-xl data-[presentation=dialog]:rounded-2xl data-[presentation=dialog]:transition data-[presentation=dialog]:duration-150 data-[presentation=dialog]:data-ending-style:scale-98 data-[presentation=dialog]:data-ending-style:opacity-0 data-[presentation=sheet]:max-h-[min(80svh,calc(var(--visual-viewport-height,100svh)-0.5rem))] data-[presentation=sheet]:rounded-t-2xl data-[presentation=sheet]:border-b-0 motion-reduce:data-[presentation=dialog]:transition-none"
          keepMounted
        >
          <DialogTitle className="sr-only">{TITLE}</DialogTitle>
          <Command
            className="flex min-h-0 w-full max-w-none grow flex-col bg-transparent"
            filter={(item, text) =>
              resultScore(item.value, text, results.items) ??
              paletteScore(item, text)
            }
            onAction={run}
            onPagesChange={setPages}
            onQueryChange={changeQuery}
            pages={pages}
            pendingAnnouncement="Working…"
            query={query}
            status={results.status}
          >
            <div className="border-line flex items-center gap-2.5 border-b px-4">
              <Search
                aria-hidden="true"
                className="text-ink-3 size-4 shrink-0"
              />
              <CommandInput
                aria-label={TITLE}
                autoComplete="off"
                className="placeholder:text-ink-3 h-12 min-w-0 grow bg-transparent text-base outline-none sm:text-sm"
                placeholder={placeholderFor(subPage)}
              />
            </div>
            <CommandEmpty className="text-ink-3 text-center text-sm data-empty:px-4 data-empty:py-8">
              {(state) => {
                if (!state.empty) {
                  return null;
                }

                return state.loading
                  ? "Searching…"
                  : `Nothing matches “${query.trim()}”.`;
              }}
            </CommandEmpty>
            <ScrollArea className="flex min-h-0 flex-col rounded-none border-0">
              <ScrollAreaViewport
                aria-label="Commands"
                // Scroll padding as tall as the fades keeps the highlight clear of them.
                className="h-auto min-h-0 flex-1 scroll-py-8 overscroll-contain"
              >
                <ScrollAreaContent className="p-0">
                  <CommandList className="pb-safe max-h-none overflow-visible px-2 pt-2">
                    <CommandPage>
                      {groups.map((group) =>
                        group.label === ACCOUNT_GROUP ? null : (
                          <CommandGroupOf group={group} key={group.label} />
                        )
                      )}
                      <BranchGroup
                        branches={branches}
                        query={query}
                        scope={scope}
                      />
                      <ThemeGroup theme={theme} />
                      {groups.map((group) =>
                        group.label === ACCOUNT_GROUP ? (
                          <CommandGroupOf group={group} key={group.label} />
                        ) : null
                      )}
                      {documentsFirst(query) ? (
                        <>
                          <DocumentResults documents={documents} />
                          <ProductResults products={products} query={query} />
                        </>
                      ) : (
                        <>
                          <ProductResults products={products} query={query} />
                          <DocumentResults documents={documents} />
                        </>
                      )}
                    </CommandPage>
                    <BranchPage branches={branches} scope={scope} />
                    <ThemePage theme={theme} />
                  </CommandList>
                </ScrollAreaContent>
              </ScrollAreaViewport>
              {/* Grow in as the list scrolls past each edge, up to 2rem. */}
              <div
                aria-hidden="true"
                className="from-surface pointer-events-none absolute inset-x-0 top-0 h-[min(2rem,var(--scroll-area-overflow-y-start))] bg-linear-to-b to-transparent [--scroll-area-overflow-y-start:inherit]"
              />
              <div
                aria-hidden="true"
                className="from-surface pointer-events-none absolute inset-x-0 bottom-0 h-[min(2rem,var(--scroll-area-overflow-y-end))] bg-linear-to-t to-transparent [--scroll-area-overflow-y-end:inherit]"
              />
              <ScrollAreaScrollbar className="w-2 p-0.5">
                <ScrollAreaThumb className="bg-ink/20 data-dragging:bg-ink/35" />
              </ScrollAreaScrollbar>
            </ScrollArea>
            <PaletteFooter onSubPage={subPage !== undefined} />
          </Command>
        </DialogContent>
      </Dialog>
    </PaletteContext>
  );
};

/** The sidebar's "search box": a button, so it works from the keyboard. */
export const PaletteFieldTrigger = () => {
  const palette = usePalette();
  const hint = useShortcutHint(SHORTCUT);

  return (
    <DialogTrigger
      aria-keyshortcuts={hint.ariaKeyshortcuts}
      aria-label={TITLE}
      className="border-input bg-surface press text-ink-3 hover:text-ink-2 focus-visible:ring-ring/50 flex h-8 w-full items-center gap-2 rounded-lg border px-2.5 text-start text-xs outline-none focus-visible:ring-3"
      controller={palette}
    >
      <Search aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="grow truncate">Search…</span>
      <Kbd aria-hidden="true">{hint.text}</Kbd>
    </DialogTrigger>
  );
};

/** The phone header's way in. */
export const PaletteIconTrigger = () => {
  const palette = usePalette();
  const hint = useShortcutHint(SHORTCUT);

  return (
    <DialogTrigger
      aria-keyshortcuts={hint.ariaKeyshortcuts}
      aria-label={TITLE}
      className="press text-ink-2 hover:text-ink hover:bg-surface-2 grid size-8 shrink-0 place-items-center rounded-md"
      controller={palette}
    >
      <Search aria-hidden="true" className="size-4" />
    </DialogTrigger>
  );
};
