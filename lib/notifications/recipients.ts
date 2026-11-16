/**
 * Who hears about what. A notification goes to the other side of a hand-off,
 * never to the person who did it:
 *
 * - Managers and storekeepers at a branch hear about stock heading their way
 *   (a transfer sent to them, a purchase order approved), since storekeepers
 *   count it in.
 * - Only managers hear about cancellations, short closes and new requests.
 * - Head office hears about losses (a transfer received short) and drafts
 *   waiting for its approval, and nothing else: it sees every branch anyway.
 *
 * Pure, so the rules are tested without a database.
 */

import type { NotificationKind, Role } from "@/lib/db/schema";
import type { Actor } from "@/lib/permissions";

export type NotificationEvent =
  | {
      readonly kind: Extract<NotificationKind, `po_${string}`>;
      readonly purchaseOrderId: number;
      /** The branch the order is for. */
      readonly branchId: string;
    }
  | {
      readonly kind: Extract<NotificationKind, `transfer_${string}`>;
      readonly transferId: number;
      readonly fromBranchId: string;
      readonly toBranchId: string;
      /** Units lost on the road, for a transfer received short. */
      readonly units?: number;
    }
  | {
      readonly kind: Extract<NotificationKind, `request_${string}`>;
      readonly requestId: number;
      /** The store that asked. */
      readonly branchId: string;
      /** The warehouse asked. */
      readonly fromBranchId: string;
    };

export interface StaffMember {
  readonly id: string;
  readonly role: Role;
  readonly branchId: string | null;
}

type Audience = (person: StaffMember) => boolean;

const STOCK_HANDLERS: ReadonlySet<Role> = new Set(["manager", "storekeeper"]);

const handlersAt =
  (branchId: string): Audience =>
  (person) =>
    person.branchId === branchId && STOCK_HANDLERS.has(person.role);

const managersAt =
  (branchId: string): Audience =>
  (person) =>
    person.branchId === branchId && person.role === "manager";

const headOffice: Audience = (person) => person.role === "admin";

const nobody: Audience = () => false;

const either =
  (...audiences: readonly Audience[]): Audience =>
  (person) =>
    audiences.some((audience) => audience(person));

/** A request cancelled by one side is news to the other; by head office, to both. */
const otherSideOf = (
  actor: Actor,
  store: string,
  warehouse: string
): Audience => {
  if (actor.branchId === store) {
    return managersAt(warehouse);
  }

  if (actor.branchId === warehouse) {
    return managersAt(store);
  }

  return either(managersAt(store), managersAt(warehouse));
};

const audienceFor = (actor: Actor, event: NotificationEvent): Audience => {
  switch (event.kind) {
    case "po_drafted": {
      // Head office's own drafts need no one else's attention.
      return actor.role === "admin" ? nobody : headOffice;
    }

    case "po_approved": {
      return handlersAt(event.branchId);
    }

    case "po_cancelled":
    case "po_closed": {
      return managersAt(event.branchId);
    }

    case "transfer_dispatched": {
      return handlersAt(event.toBranchId);
    }

    case "transfer_cancelled": {
      return managersAt(event.toBranchId);
    }

    case "transfer_received_short": {
      return either(managersAt(event.fromBranchId), headOffice);
    }

    case "request_raised": {
      return managersAt(event.fromBranchId);
    }

    case "request_cancelled": {
      return otherSideOf(actor, event.branchId, event.fromBranchId);
    }

    default: {
      throw new Error("Unknown notification kind.");
    }
  }
};

/** The ids of the staff `event` concerns, leaving out whoever caused it. */
export const recipientsFor = (
  actor: Actor,
  event: NotificationEvent,
  staff: readonly StaffMember[]
): string[] => {
  const audience = audienceFor(actor, event);

  const ids: string[] = [];

  for (const person of staff) {
    if (person.id !== actor.id && audience(person)) {
      ids.push(person.id);
    }
  }

  return ids;
};
