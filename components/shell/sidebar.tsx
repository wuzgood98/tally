"use client";

import { createCookieStorage } from "@ui-sdk/core";
import { Tooltip, TooltipTrigger } from "@ui-sdk/react/tooltip";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { createContext, use, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { TooltipContent } from "@/components/ui/tooltip";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";
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

interface SidebarFrameProps {
  readonly defaultCollapsed: boolean;
  readonly className: string;
  readonly children: ReactNode;
}

/**
 * The app's two-column grid. `data-sidebar="collapsed"` drives the `rail:`
 * variant in `globals.css`, so the server-rendered parts of the sidebar follow
 * the state without being client components.
 */
export const SidebarFrame = ({
  defaultCollapsed,
  className,
  children,
}: SidebarFrameProps) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
    save(!collapsed);
  }, [collapsed]);

  const state = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return (
    <SidebarContext value={state}>
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
    </SidebarContext>
  );
};

interface SidebarProps {
  readonly className: string;
  readonly children: ReactNode;
}

export const Sidebar = ({ className, children }: SidebarProps) => (
  <InSidebarContext value>
    <aside className={className} id="sidebar">
      {children}
    </aside>
  </InSidebarContext>
);

/** Sits at the start of the desktop header, in the same place either way. */
export const SidebarToggle = () => {
  const state = use(SidebarContext);

  if (!state) {
    throw new Error("SidebarToggle must sit inside SidebarFrame.");
  }

  const { collapsed, toggle } = state;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <Tooltip>
      <TooltipTrigger
        aria-controls="sidebar"
        className="press text-ink-3 hover:text-ink hover:bg-surface-2 -ms-2 hidden size-8 shrink-0 place-items-center rounded-md lg:grid"
        onClick={toggle}
      >
        <Icon aria-hidden="true" className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
};
