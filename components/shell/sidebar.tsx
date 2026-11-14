"use client";

import { createCookieStorage } from "@ui-sdk/core";
import { useShortcut } from "@ui-sdk/react/shortcuts";
import {
  Tooltip,
  TooltipShortcut,
  TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";

import { TooltipContent } from "@/components/ui/tooltip";
import {
  SIDEBAR_COLLAPSED,
  SIDEBAR_COOKIE,
  SIDEBAR_MEDIA,
  SIDEBAR_SHORTCUT,
  sidebarActionLabel,
} from "@/lib/sidebar";
import { cn } from "@/lib/utils";

interface SidebarState {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

/** True only inside the desktop sidebar, so the phone nav keeps its labels. */
const InSidebarContext = createContext(false);

/** Whether a nav link is drawn as an icon in the collapsed sidebar. */
export const useSidebarRail = (): boolean => {
  const collapsed = use(SidebarContext)?.collapsed ?? false;
  const inSidebar = use(InSidebarContext);

  return collapsed && inSidebar;
};

const save = (collapsed: boolean) => {
  // In the browser this writes document.cookie; the layout reads it next time.
  const storage = createCookieStorage(SIDEBAR_COOKIE);

  if (collapsed) {
    storage.set(SIDEBAR_COLLAPSED);
  } else {
    storage.remove();
  }
};

/** The sidebar's state, for the toggle and the command palette. */
export const useSidebar = (): SidebarState => {
  const state = use(SidebarContext);

  if (!state) {
    throw new Error("useSidebar must be used inside SidebarProvider.");
  }

  return state;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Runs the change inside a view transition: the browser snapshots the page,
 * the layout changes once, and the snapshots animate (styles in
 * `globals.css`). Animating the column width instead would re-layout every
 * table on every frame. Without support, or with reduced motion, it snaps.
 */
const withTransition = (change: () => void) => {
  const animate =
    "startViewTransition" in document &&
    !window.matchMedia(REDUCED_MOTION).matches;

  if (!animate) {
    change();

    return;
  }

  document.startViewTransition(() => {
    // The DOM has to be updated before the callback returns.
    flushSync(change);
  });
};

interface SidebarProviderProps {
  readonly defaultCollapsed: boolean;
  readonly children: ReactNode;
}

/** Holds the state above the palette, so a command can toggle it too. */
export const SidebarProvider = ({
  defaultCollapsed,
  children,
}: SidebarProviderProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  // A view transition runs its change a frame or more later, after any other
  // toggle in between, so each change flips the latest value, not the one
  // there was when the key was pressed.
  const latest = useRef(defaultCollapsed);

  const toggle = useCallback(() => {
    withTransition(() => {
      const next = !latest.current;
      latest.current = next;
      setCollapsed(next);
      save(next);
    });
  }, []);

  const state = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  // Works from a field too, as Ctrl/Cmd+K does. Phones have no sidebar to
  // toggle, so the keys do nothing there rather than flip a hidden setting.
  useShortcut(
    SIDEBAR_SHORTCUT,
    () => {
      if (window.matchMedia(SIDEBAR_MEDIA).matches) {
        toggle();
      }
    },
    { allowInInput: true, description: "Collapse or expand the sidebar" }
  );

  return <SidebarContext value={state}>{children}</SidebarContext>;
};

interface SidebarFrameProps {
  readonly className: string;
  readonly children: ReactNode;
}

/**
 * The app's two-column grid. `data-sidebar="collapsed"` drives the `rail:`
 * variant in `globals.css`, so the server-rendered parts of the sidebar follow
 * the state without being client components.
 */
export const SidebarFrame = ({ className, children }: SidebarFrameProps) => {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        className,
        collapsed
          ? "lg:grid-cols-[3.25rem_minmax(0,1fr)]"
          : "lg:grid-cols-[14.5rem_minmax(0,1fr)]"
      )}
      data-sidebar={collapsed ? "collapsed" : "expanded"}
    >
      {children}
    </div>
  );
};

interface SidebarProps {
  readonly className: string;
  readonly children: ReactNode;
}

export const Sidebar = ({ className, children }: SidebarProps) => (
  <InSidebarContext value>
    <aside
      className={cn(className, "lg:[view-transition-name:sidebar]")}
      id="sidebar"
    >
      {children}
    </aside>
  </InSidebarContext>
);

/** Sits at the start of the desktop header, in the same place either way. */
export const SidebarToggle = () => {
  const { collapsed, toggle } = useSidebar();
  const label = sidebarActionLabel(collapsed);
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Tooltip shortcut={SIDEBAR_SHORTCUT}>
      <TooltipTrigger
        aria-controls="sidebar"
        className="press text-ink-3 hover:text-ink hover:bg-surface-2 -ms-2 hidden size-8 shrink-0 place-items-center rounded-md lg:grid"
        onClick={toggle}
      >
        <Icon aria-hidden="true" className="size-4" />
      </TooltipTrigger>
      <TooltipContent align="start" side="bottom">
        {label}
        <TooltipShortcut className="text-canvas/60" />
      </TooltipContent>
    </Tooltip>
  );
};
