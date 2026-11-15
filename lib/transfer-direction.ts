/**
 * Which way a transfer goes for one branch. Kept free of server-only
 * imports so Ask Tally's tools can offer the same choices as the page.
 */

export const TRANSFER_DIRECTIONS = ["both", "incoming", "outgoing"] as const;

export type TransferDirection = (typeof TRANSFER_DIRECTIONS)[number];
