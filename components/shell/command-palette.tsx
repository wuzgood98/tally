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
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createContext, memo, use, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { shellIconButton } from "@/components/shell/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { ACCOUNT_GROUP } from "@/lib/palette";
import type {
  PaletteCommand,
  PaletteGroup,
  PaletteIcon,
  PaletteLink,
} from "@/lib/palette";
import {
  ASK_KEY,
  ASK_VALUE,
  askRowLabel,
  askScore,
  opensAsk,
} from "@/lib/palette-ask";
import { BRANCH_PAGE, scopeOf } from "@/lib/palette-branches";
import type { PaletteBranch } from "@/lib/palette-branches";
import type { PaletteDocument } from "@/lib/palette-documents";
import { paletteScore } from "@/lib/palette-filter";
import {
  documentsFirst,
  hitsOf,
  MIN_SEARCH_LENGTH,
  productOf,
  resultHref,
  resultScore,
  takesResultHighlight,
  topResult,
} from "@/lib/palette-results";
import type { PaletteHit, PaletteSearch } from "@/lib/palette-results";
import type { PaletteProduct } from "@/lib/palette-search";
import { SIDEBAR_COMMAND } from "@/lib/palette-sidebar";
import { THEME_PAGE, themeOf } from "@/lib/palette-theme";
import type { SidebarState } from "@/lib/sidebar";
import type { Theme } from "@/lib/theme";
import { splitForMiddleTruncation } from "@/lib/truncate";
import { cn } from "@/lib/utils";

import { AskPanel } from "./ask-tally";
import { AppearanceGroup } from "./palette-appearance";
import { BranchGroup, BranchPage } from "./palette-branches";
import { DocumentResults } from "./palette-documents";
import {
  COPY_SKU_SHORTCUT,
  CopySkuShortcut,
  ProductResults,
} from "./palette-products";
import {
  paletteGroupLabelClass,
  paletteIconClass,
  paletteItemClass,
  PaletteRow,
  ShortcutPaletteRow,
} from "./palette-row";
import { ThemePage } from "./palette-theme";

const SHORTCUT = "mod+k";

const NO_HITS: readonly PaletteHit[] = [];
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
  settings: SlidersHorizontal,
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

const PaletteItem = ({ command }: { readonly command: PaletteCommand }) => {
  const row = {
    icon: ICONS[command.icon],
    keywords: command.keywords,
    label: command.label,
    value: command.value,
  };

  return command.shortcut === undefined ? (
    <PaletteRow {...row} />
  ) : (
    <ShortcutPaletteRow {...row} shortcut={command.shortcut} />
  );
};

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

/**
 * "Copy SKU of Long grain perf…rice 25 kg": a long name loses its middle,
 * so the size or variant at its end stays readable.
 */
const CopyingLabel = ({ name }: { readonly name: string }) => {
  const [head, tail] = splitForMiddleTruncation(name);

  return (
    <span className="flex min-w-0" title={name}>
      <span className="shrink-0 whitespace-pre">Copy SKU of </span>
      <span className="text-ink-2 truncate">{head}</span>
      <span className="text-ink-2 shrink-0 whitespace-pre">{tail}</span>
    </span>
  );
};

const FooterKey = ({
  className,
  keys,
  label,
}: {
  readonly keys: readonly string[];
  readonly label: ReactNode;
  readonly className?: string;
}) => (
  <span className={cn("flex items-center gap-1.5", className)}>
    {label}
    <span className="flex gap-0.5">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </span>
  </span>
);

/**
 * How to drive the palette from the keyboard. Hidden on touch screens. With
 * a product highlighted, copying its SKU takes Close's place (Esc still
 * closes), naming the product.
 */
const PaletteFooter = ({
  copying,
  onSubPage,
}: {
  readonly copying: PaletteProduct | null;
  readonly onSubPage: boolean;
}) => {
  const enter = useShortcutHint("enter");
  const backspace = useShortcutHint("backspace");
  const copy = useShortcutHint(COPY_SKU_SHORTCUT);

  return (
    <div
      aria-hidden="true"
      className="border-line text-ink-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-xs pointer-coarse:hidden"
    >
      <FooterKey keys={[enter.text]} label="Go to" />
      <FooterKey keys={["↑", "↓"]} label="Move" />
      {onSubPage ? <FooterKey keys={[backspace.text]} label="Back" /> : null}
      {copying === null ? (
        <FooterKey className="ms-auto" keys={["Esc"]} label="Close" />
      ) : (
        <FooterKey
          // Fills what's left of the line, cutting the name to fit; with less
          // than 15rem left (a phone) it takes a line of its own instead.
          className="ms-auto min-w-0 flex-1 basis-60 justify-end"
          keys={[copy.text]}
          label={<CopyingLabel name={copying.name} />}
        />
      )}
    </div>
  );
};

// Memoised: the groups come from the server and don't change while the
// palette is open, so its own state changes needn't re-render every row.
const CommandGroupOfRows = ({ group }: { readonly group: PaletteGroup }) => (
  <CommandGroup className="pb-1">
    <CommandGroupLabel className="text-ink-3 px-2.5 pt-2 pb-1 text-xs">
      {group.label}
    </CommandGroupLabel>
    {group.commands.map((command) => (
      <PaletteItem command={command} key={command.value} />
    ))}
  </CommandGroup>
);

const CommandGroupOf = memo(CommandGroupOfRows);

/**
 * "Ask Tally", or "Ask Tally: “…”" carrying what's typed over. It sits
 * first while nothing is typed and last once something is.
 */
const AskRow = ({ query }: { readonly query: string }) => (
  <CommandGroup className="pb-1">
    <CommandGroupLabel className={paletteGroupLabelClass}>
      Ask
    </CommandGroupLabel>
    <CommandItem
      className={paletteItemClass}
      keywords={["question", "assistant", "help"]}
      label={askRowLabel(query)}
      value={ASK_VALUE}
    >
      <CommandItemIcon className={paletteIconClass}>
        <Sparkles aria-hidden="true" />
      </CommandItemIcon>
      <span className="grow truncate">{askRowLabel(query)}</span>
      {query.trim() === "" ? (
        <Kbd aria-hidden="true" className="pointer-coarse:hidden">
          {ASK_KEY}
        </Kbd>
      ) : null}
    </CommandItem>
  </CommandGroup>
);

/** Ask Tally for this person: the questions an empty Ask offers. */
export interface AskSettings {
  readonly suggestions: readonly string[];
}

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
  readonly onSetTheme: (theme: Theme) => void;
  /** The desktop sidebar, when there is one to collapse or expand. */
  readonly sidebar?: SidebarState;
  /** Ask Tally, when it's on and this person may use it. */
  readonly ask?: AskSettings | null;
}

interface PaletteListProps {
  readonly groups: readonly PaletteGroup[];
  readonly branches: readonly PaletteBranch[];
  readonly scope: string;
  readonly sidebar: SidebarState | undefined;
  readonly theme: Theme;
  readonly query: string;
  readonly products: readonly PaletteProduct[];
  readonly documents: readonly PaletteDocument[];
  /** Offer Ask Tally: first while nothing is typed, last once something is. */
  readonly showAsk: boolean;
}

/** The commands, branches, appearance, search results and their pages. */
const PaletteListRows = ({
  branches,
  documents,
  groups,
  products,
  query,
  scope,
  showAsk,
  sidebar,
  theme,
}: PaletteListProps) => (
  <ScrollArea className="flex min-h-0 flex-col rounded-none border-0">
    <ScrollAreaViewport
      aria-label="Commands"
      // Scroll padding as tall as the fades keeps the highlight clear of them.
      className="h-auto min-h-0 flex-1 scroll-py-8 overscroll-contain"
    >
      <ScrollAreaContent className="p-0">
        <CommandList className="pb-safe max-h-none overflow-visible px-2 pt-2">
          <CommandPage>
            {showAsk && query.trim() === "" ? <AskRow query={query} /> : null}
            {groups.map((group) =>
              group.label === ACCOUNT_GROUP ? null : (
                <CommandGroupOf group={group} key={group.label} />
              )
            )}
            <BranchGroup branches={branches} query={query} scope={scope} />
            <AppearanceGroup sidebar={sidebar} theme={theme} />
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
            {showAsk && query.trim() !== "" ? <AskRow query={query} /> : null}
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
);

// Memoised: moving the highlight re-renders the palette, not the list.
const PaletteList = memo(PaletteListRows);

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
  sidebar,
  ask = null,
}: CommandPaletteProps) => {
  // One controller for the life of the app; the triggers share it.
  const palette = useMemo(() => createPaletteController(), []);
  const [query, setQuery] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const subPage = pages.at(-1);
  // Asking: the question to start with ("" for none). Null: the commands.
  const [asking, setAsking] = useState<string | null>(null);
  // The highlighted command. Controlled, because the footer names the
  // highlighted product; ui-sdk then leaves arriving results unhighlighted,
  // so handing the highlight to them is ours (below).
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [handedTo, setHandedTo] = useState<string | null>(null);
  const content = useRef<HTMLDivElement>(null);

  const results = useAsyncOptions<PaletteHit>(
    async (text) => hitsOf(await search(text)),
    { debounce: 150 }
  );

  // Products and documents live on the first page only, once enough is typed.
  const searching =
    subPage === undefined && query.trim().length >= MIN_SEARCH_LENGTH;

  const hits = searching ? results.items : NO_HITS;

  // Stable between results, so moving the highlight doesn't redraw the list.
  const products = useMemo(
    () => hits.flatMap((hit) => (hit.type === "product" ? [hit.product] : [])),
    [hits]
  );

  const documents = useMemo(
    () =>
      hits.flatMap((hit) => (hit.type === "document" ? [hit.document] : [])),
    [hits]
  );

  // New results take the highlight from nothing, from "Ask Tally" or from the
  // last search's results; never from a page or action that matched.
  const top = searching ? topResult(query, hits) : null;

  if (top !== handedTo) {
    setHandedTo(top);

    if (top !== null && takesResultHighlight(highlighted, ASK_VALUE)) {
      setHighlighted(top);
    }
  }

  // Not while asking: Ctrl+C there copies from the conversation.
  const highlightedProduct =
    asking === null ? productOf(highlighted, hits) : null;

  const changeQuery = (text: string): void => {
    if (ask !== null && subPage === undefined && opensAsk(query, text)) {
      setAsking("");
      setQuery("");

      return;
    }

    setQuery(text);

    // Too short to search: leave the last results be (`searching` hides
    // them) rather than set an empty query, whose "loading" blip re-renders
    // every row twice, which is what made opening the palette lag.
    if (subPage === undefined && text.trim().length >= MIN_SEARCH_LENGTH) {
      results.setQuery(text);
    }
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
    if (value === ASK_VALUE) {
      setAsking(query.trim());
      setQuery("");

      return;
    }

    const resultPage = resultHref(value, query, hits);

    if (resultPage !== null) {
      palette.close();
      onNavigate(resultPage);

      return;
    }

    if (value === SIDEBAR_COMMAND) {
      sidebar?.toggle();
      palette.close();

      return;
    }

    const nextTheme = themeOf(value);

    if (nextTheme !== null) {
      onSetTheme(nextTheme);
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
      // Closed first: signing out may ask first (sales waiting at the till).
      palette.close();
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
          // Reset only what changed: every state update re-renders the list.
          if (open && pages.length > 0) {
            setPages([]);
          }

          if (open && query !== "") {
            changeQuery("");
          }

          if (open && asking !== null) {
            setAsking(null);
          }
        }}
        pendingAnnouncement="Working…"
        presentation="auto"
      >
        {/* Own view-transition layers, so toggling the sidebar from here
            fades the palette out above the sliding sidebar and canvas
            instead of dropping it beneath them. */}
        <DialogBackdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity duration-150 [view-transition-name:palette-backdrop] data-ending-style:opacity-0 motion-reduce:transition-none" />
        <DialogContent
          className="border-line-strong bg-surface text-ink shadow-float z-50 flex w-full flex-col gap-0 overflow-hidden border p-0 font-sans [view-transition-name:palette] data-[presentation=dialog]:mx-auto data-[presentation=dialog]:mt-[12vh] data-[presentation=dialog]:mb-auto data-[presentation=dialog]:max-h-[min(32rem,76vh)] data-[presentation=dialog]:w-[calc(100%-2rem)] data-[presentation=dialog]:max-w-xl data-[presentation=dialog]:rounded-2xl data-[presentation=dialog]:transition data-[presentation=dialog]:duration-150 data-[presentation=dialog]:data-ending-style:scale-98 data-[presentation=dialog]:data-ending-style:opacity-0 data-[presentation=sheet]:max-h-[min(80svh,calc(var(--visual-viewport-height,100svh)-0.5rem))] data-[presentation=sheet]:rounded-t-2xl data-[presentation=sheet]:border-b-0 motion-reduce:data-[presentation=dialog]:transition-none"
          keepMounted
          ref={content}
        >
          <CopySkuShortcut layer={content} product={highlightedProduct} />
          <DialogTitle className="sr-only">
            {asking === null ? TITLE : "Ask Tally"}
          </DialogTitle>
          {asking === null || ask === null ? (
            <Command
              className="flex min-h-0 w-full max-w-none grow flex-col bg-transparent"
              onValueChange={setHighlighted}
              filter={(item, text) =>
                item.value === ASK_VALUE
                  ? askScore(searching)
                  : (resultScore(item.value, text, hits) ??
                    paletteScore(item, text))
              }
              onAction={run}
              onPagesChange={setPages}
              onQueryChange={changeQuery}
              pages={pages}
              value={highlighted}
              pendingAnnouncement="Working…"
              query={query}
              status={searching ? results.status : "idle"}
            >
              <div className="border-line flex items-center gap-2.5 border-b px-4">
                <Search
                  aria-hidden="true"
                  className="text-ink-3 size-4 shrink-0"
                />
                <CommandInput
                  aria-label={TITLE}
                  autoComplete="off"
                  // oxlint-disable-next-line jsx-a11y/no-autofocus -- back from Ask Tally, the commands mount again: focus here
                  autoFocus
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
              <PaletteList
                branches={branches}
                documents={documents}
                groups={groups}
                products={products}
                query={query}
                scope={scope}
                showAsk={ask !== null}
                sidebar={sidebar}
                theme={theme}
              />
              <PaletteFooter
                copying={highlightedProduct}
                onSubPage={subPage !== undefined}
              />
            </Command>
          ) : (
            <AskPanel
              initialQuestion={asking}
              onBack={() => {
                setAsking(null);
              }}
              onFollowLink={() => {
                palette.close();
              }}
              suggestions={ask.suggestions}
            />
          )}
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
      className={shellIconButton}
      controller={palette}
    >
      <Search aria-hidden="true" className="size-4" />
    </DialogTrigger>
  );
};
