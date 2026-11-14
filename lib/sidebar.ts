/** Remembers, per browser, whether the desktop sidebar is shrunk to icons. */
export const SIDEBAR_COOKIE = "tally-sidebar";

export const SIDEBAR_COLLAPSED = "collapsed";

/** Anything other than the saved "collapsed" shows the full sidebar. */
export const isSidebarCollapsed = (
  cookie: { readonly value: string } | undefined
): boolean => cookie?.value === SIDEBAR_COLLAPSED;

/** Where there is a sidebar (Tailwind's lg); below it the header nav takes over. */
export const SIDEBAR_MEDIA = "(width >= 64rem)";

/** Ctrl+B, or Cmd+B on a Mac, as in most editors. */
export const SIDEBAR_SHORTCUT = "mod+b";

/** The palette command that collapses or expands it. */
export const SIDEBAR_COMMAND = "sidebar:toggle";

export const sidebarActionLabel = (collapsed: boolean): string =>
  collapsed ? "Expand sidebar" : "Collapse sidebar";
