"use client";

import {
  createContext,
  use,
  useCallback,
  useState,
  useTransition,
} from "react";
import type { ReactNode } from "react";

import { signOut } from "@/app/login/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCount } from "@/lib/format";
import { countQueuedSales } from "@/lib/till/client/outbox";

type RequestSignOut = () => Promise<void>;

const SignOutContext = createContext<RequestSignOut | null>(null);

/** Signs out, first warning if this person has till sales still waiting to reach Tally. */
export const useSignOut = (): RequestSignOut => {
  const request = use(SignOutContext);

  if (request === null) {
    throw new Error("useSignOut needs a SignOutGuard above it.");
  }

  return request;
};

const salesWord = (count: number): string =>
  count === 1 ? "1 sale" : `${formatCount(count)} sales`;

/** "1 sale … hasn't … It stays … is … it" or the plural, in one place. */
const waitingWarning = (count: number): string =>
  count === 1
    ? "1 sale you charged on this device hasn't reached Tally yet. It stays here and is sent the next time you sign in on this device, with a connection. Until then, Tally's stock and sales don't include it."
    : `${salesWord(count)} you charged on this device haven't reached Tally yet. They stay here and are sent the next time you sign in on this device, with a connection. Until then, Tally's stock and sales don't include them.`;

/**
 * Every way out of the app (the sidebar, the phone header, the palette) goes
 * through here. Sales queued at the till belong to the person who charged
 * them and stay on this device when they sign out, to be sent the next time
 * they sign in here; the warning says so, since until then Tally doesn't
 * know about them.
 */
export const SignOutGuard = ({
  userId,
  children,
}: {
  readonly userId: string;
  readonly children: ReactNode;
}) => {
  const [queued, setQueued] = useState<number | null>(null);

  const request = useCallback(async () => {
    const waiting = await countQueuedSales(userId);

    if (waiting === 0) {
      await signOut();

      return;
    }

    setQueued(waiting);
  }, [userId]);

  return (
    <SignOutContext value={request}>
      {children}
      <ConfirmDialog
        cancelLabel="Stay signed in"
        confirmLabel="Sign out anyway"
        description={waitingWarning(queued ?? 0)}
        onConfirm={async () => {
          await signOut();

          return { error: null };
        }}
        onOpenChange={(open) => {
          if (!open) {
            setQueued(null);
          }
        }}
        open={queued !== null}
        pendingLabel="Signing out…"
        title={`Sign out with ${salesWord(queued ?? 0)} waiting to send?`}
      />
    </SignOutContext>
  );
};

/** A sign-out button for the shell; the look comes from the caller. */
export const SignOutButton = ({
  label,
  className,
  children,
}: {
  readonly label: string;
  readonly className: string;
  readonly children: ReactNode;
}) => {
  const signOutSafely = useSignOut();
  const [pending, startTransition] = useTransition();

  return (
    <button
      aria-label={label}
      className={className}
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await signOutSafely();
        });
      }}
      type="button"
    >
      {children}
    </button>
  );
};
