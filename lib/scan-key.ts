/** The parts of a keydown that decide what a scan box does with it. */
export interface ScanKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/**
 * A plain Enter: what a barcode scanner sends after the code. Ctrl/Cmd/Alt+Enter
 * is left alone, because the till charges on Ctrl/Cmd+Enter and ui-sdk skips a
 * key event that something has already prevented.
 */
export const isScanEnter = (event: ScanKey): boolean =>
  event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.altKey;
