/** Remembers, per browser, whether the desktop sidebar is shrunk to icons. */
export const SIDEBAR_COOKIE = "tally-sidebar";

export const SIDEBAR_COLLAPSED = "collapsed";

/** Anything other than the saved "collapsed" shows the full sidebar. */
export const isSidebarCollapsed = (
  cookie: { readonly value: string } | undefined
): boolean => cookie?.value === SIDEBAR_COLLAPSED;

/** The palette command that collapses or expands it. */
export const SIDEBAR_COMMAND = "sidebar:toggle";

export const sidebarActionLabel = (collapsed: boolean): string =>
  collapsed ? "Expand sidebar" : "Collapse sidebar";
