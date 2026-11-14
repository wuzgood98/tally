/** Remembers, per browser, whether the desktop sidebar is shrunk to icons. */
export const SIDEBAR_COOKIE = "tally-sidebar";

export const SIDEBAR_COLLAPSED = "collapsed";

/** Anything other than the saved "collapsed" shows the full sidebar. */
export const isSidebarCollapsed = (
  cookie: { readonly value: string } | undefined
): boolean => cookie?.value === SIDEBAR_COLLAPSED;

/**
 * Where there is a sidebar (Tailwind's lg); below it the header nav takes
 * over. The `rail:` variant in `app/globals.css` repeats it, and a test keeps
 * the two in step.
 */
export const SIDEBAR_MEDIA = "(width >= 64rem)";

/** Ctrl+B, or Cmd+B on a Mac, as in most editors. */
export const SIDEBAR_SHORTCUT = "mod+b";

export const sidebarActionLabel = (collapsed: boolean): string =>
  collapsed ? "Expand sidebar" : "Collapse sidebar";

/** What the toggle and the command palette need from the sidebar. */
export interface SidebarState {
  readonly collapsed: boolean;
  readonly toggle: () => void;
}
