"use client";

import { toast } from "@ui-sdk/react/toast";
import { ArrowRight, LockKeyhole, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import type { ReactNode } from "react";

import { changePassword, saveName } from "@/app/(app)/settings/actions";
import { TallyMark } from "@/components/brand/tally-mark";
import { useSettingsForm } from "@/components/settings/use-settings-form";
import { Checkbox } from "@/components/ui/choice";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { initialsOf } from "@/lib/badge";
import { barRuns, ean13Modules } from "@/lib/barcode";
import { NAME_MAX_LENGTH } from "@/lib/limits";
import { submitWithoutReset } from "@/lib/submit-without-reset";

type Side = "front" | "back";

interface StaffBadgeProps {
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly branch: string;
  readonly company: string;
  /** Printed under the bars: home branch and role, like "AMS · CASHIER" or "HQ · HEAD OFFICE". */
  readonly staffCode: string;
  /** A valid EAN-13 for the bars, so they scan like the shelf label's. */
  readonly barcode: string;
  /** Demo accounts share one password, so it can't be changed there. */
  readonly demo: boolean;
}

const Barcode = ({ code }: { readonly code: string }) => {
  const modules = ean13Modules(code);

  return (
    <svg
      aria-hidden="true"
      className="h-6 w-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${modules.length} 40`}
    >
      {barRuns(modules).map((bar) => (
        <rect
          fill="currentColor"
          height="40"
          key={bar.x}
          width={bar.width}
          x={bar.x}
        />
      ))}
    </svg>
  );
};

/**
 * The ink button printed on the badge, like the sign-in label's. A plain
 * `<button>`: `<Button>` owns its size and type (the `no-restyle` lint), and
 * none of its sizes is this badge's.
 */
const InkButton = ({
  children,
  pending,
  disabled = false,
}: {
  readonly children: ReactNode;
  readonly pending: boolean;
  readonly disabled?: boolean;
}) => (
  <button
    className="press bg-ink text-paper hover:bg-brand flex h-10 items-center justify-between rounded-sm px-3.5 font-semibold disabled:opacity-45 data-pending:cursor-progress"
    data-pending={pending ? "" : undefined}
    disabled={pending || disabled}
    type="submit"
  >
    {children}
    <ArrowRight aria-hidden="true" className="size-4" />
  </button>
);

/** The dashed "turn over" strip; plain for the same reason as `InkButton`. */
const TurnButton = ({
  children,
  onClick,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
}) => (
  <button
    className="press group/turn border-line-strong text-ink-2 hover:border-ink hover:text-ink flex h-8 items-center justify-center gap-1.5 rounded-sm border border-dashed font-mono text-xs"
    onClick={onClick}
    type="button"
  >
    <RefreshCw
      aria-hidden="true"
      className="size-3.5 transition-transform duration-200 ease-(--ease-out-quick) [@media(hover:hover)_and_(pointer:fine)]:group-hover/turn:rotate-90"
    />
    {children}
  </button>
);

type BadgeFront = Omit<StaffBadgeProps, "demo">;

const toastNameSaved = () => {
  toast.success("Name saved", {
    description: "It's on your badge and in the sidebar.",
  });
};

const NameFace = ({
  badge,
  onTurn,
}: {
  readonly badge: BadgeFront;
  readonly onTurn: () => void;
}) => {
  // What's typed, once they start typing; until then the saved name.
  const [typed, setTyped] = useState<string | null>(null);
  const draft = typed ?? badge.name;

  const [state, action, pending] = useSettingsForm(saveName, toastNameSaved);

  const invalid = state.error === null ? undefined : true;
  const unchanged = draft.trim() === badge.name;

  return (
    <form
      action={action}
      className="flex grow flex-col gap-3"
      noValidate
      onSubmit={submitWithoutReset(action)}
    >
      <div className="flex items-center gap-2 font-mono text-xs font-semibold tracking-widest uppercase">
        <TallyMark className="text-brand size-4.5 shrink-0" />
        <span className="truncate">{badge.company}</span>
        <span className="text-ink-3 ms-auto font-medium">Staff</span>
      </div>

      <div className="grid grid-cols-[5.25rem_1fr] items-end gap-3.5">
        <div
          aria-hidden="true"
          className="badge-photo grid h-25 place-items-center rounded-sm text-3xl font-semibold tracking-tight"
        >
          {initialsOf(draft) || "?"}
        </div>
        <p className="text-xl leading-tight font-semibold tracking-tight">
          <span className="text-ink-3 mb-1 block font-mono text-xs font-medium tracking-widest uppercase">
            Role
          </span>
          {badge.role}
        </p>
      </div>

      <Field invalid={invalid}>
        <FieldLabel tone="caption">Name on badge</FieldLabel>
        <Input
          aria-describedby={invalid ? "badge-name-error" : undefined}
          autoComplete="name"
          look="display"
          maxLength={NAME_MAX_LENGTH}
          name="name"
          defaultValue={badge.name}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
          required
        />
      </Field>
      {state.error === null ? null : (
        <p
          className="text-danger -mt-1 text-xs"
          id="badge-name-error"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
        <dt className="text-ink-3">Branch</dt>
        <dd>{badge.branch}</dd>
        <dt className="text-ink-3">Email</dt>
        <dd className="break-all">{badge.email}</dd>
      </dl>

      <InkButton disabled={unchanged} pending={pending}>
        {pending ? "Saving…" : "Save name"}
      </InkButton>

      <div className="text-ink mt-auto">
        <Barcode code={badge.barcode} />
        <p className="text-ink-2 mt-1 text-center font-mono text-xs tracking-widest">
          {badge.staffCode}
        </p>
      </div>

      <TurnButton onClick={onTurn}>Turn over to change password</TurnButton>
    </form>
  );
};

const PasswordFace = ({
  demo,
  company,
  onTurn,
  onChanged,
}: {
  readonly demo: boolean;
  readonly company: string;
  readonly onTurn: () => void;
  readonly onChanged: () => void;
}) => {
  const [state, action, pending] = useSettingsForm(changePassword, (form) => {
    toast.success("Password changed", {
      description:
        form.get("signOutOthers") === "on"
          ? "Your other devices are signed out."
          : "Use it next time you sign in.",
    });
    onChanged();
  });

  const invalid = state.error === null ? undefined : true;

  // No submitWithoutReset, unlike the other settings forms: after a failed
  // try the password fields clear on purpose, so a wrong password isn't left
  // sitting in them.
  return (
    <form action={action} className="flex grow flex-col gap-3" noValidate>
      <div aria-hidden="true" className="bg-ink -mx-5 mt-1 h-8" />
      <h3 className="text-md font-semibold tracking-tight">Change password</h3>

      <fieldset className="contents" disabled={demo}>
        <Field invalid={invalid}>
          <FieldLabel tone="caption">Current password</FieldLabel>
          <PasswordInput
            aria-describedby={invalid ? "badge-password-error" : undefined}
            autoComplete="current-password"
            look="line"
            name="currentPassword"
            required
          />
        </Field>
        <Field invalid={invalid}>
          <FieldLabel tone="caption">New password</FieldLabel>
          <PasswordInput
            aria-describedby={invalid ? "badge-password-error" : undefined}
            autoComplete="new-password"
            look="line"
            name="newPassword"
            required
          />
        </Field>
        <label className="text-ink-2 flex items-center gap-2 font-mono text-xs">
          <Checkbox defaultChecked name="signOutOthers" />
          Sign out my other devices
        </label>
      </fieldset>

      {demo ? (
        <p className="bg-warn-soft text-warn flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs">
          <LockKeyhole aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          Passwords can&apos;t be changed in the demo, so the sample accounts
          keep working for everyone.
        </p>
      ) : null}
      {state.error === null ? null : (
        <p
          className="text-danger text-xs"
          id="badge-password-error"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <InkButton disabled={demo} pending={pending}>
        {pending ? "Changing…" : "Change password"}
      </InkButton>
      <TurnButton onClick={onTurn}>Back to the front</TurnButton>
      <p className="text-ink-3 mt-auto text-center font-mono text-xs">
        If found, return to {company} head office.
      </p>
    </form>
  );
};

/**
 * "You" on the settings page: a staff badge on a lanyard. The front carries
 * the name, which you can rewrite; turn it over for the password.
 */
export const StaffBadge = (props: StaffBadgeProps) => {
  const [side, setSide] = useState<Side>("front");
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  const turn = (next: Side) => {
    setSide(next);
    // The face is already in the DOM; focus its first field as it turns.
    const face = next === "back" ? backRef.current : frontRef.current;
    requestAnimationFrame(() => {
      face?.querySelector<HTMLElement>("input")?.focus({ preventScroll: true });
    });
  };

  const face =
    "badge-face badge-slot label-paper relative flex flex-col rounded-xl px-5 pt-8.5 pb-4.5";

  return (
    <div className="badge-settle drop-shadow-badge relative mx-auto -mt-5 w-full max-w-76 pt-18 lg:-mt-8">
      <div aria-hidden="true" className="absolute top-0 left-1/2 h-16 w-0">
        <i className="lanyard-strap absolute top-0 -left-3.75 h-16 w-3.75 origin-bottom skew-x-[22deg]" />
        <i className="lanyard-strap absolute top-0 left-0 h-16 w-3.75 origin-bottom -skew-x-[22deg]" />
      </div>
      <div
        aria-hidden="true"
        className="lanyard-clip absolute top-14 left-1/2 z-10 h-6.5 w-5 -translate-x-1/2 rounded-t-sm rounded-b-lg"
      />
      <div className="badge-flip" data-side={side}>
        <div
          className={`${face} badge-front`}
          inert={side === "back"}
          ref={frontRef}
        >
          <NameFace
            badge={props}
            onTurn={() => {
              turn("back");
            }}
          />
        </div>
        <div
          className={`${face} badge-back`}
          inert={side === "front"}
          ref={backRef}
        >
          <PasswordFace
            company={props.company}
            demo={props.demo}
            onChanged={() => {
              turn("front");
            }}
            onTurn={() => {
              turn("front");
            }}
          />
        </div>
      </div>
    </div>
  );
};
