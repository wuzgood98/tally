"use client";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import type { VariantProps } from "class-variance-authority";
import { useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingLabel } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ButtonLook = VariantProps<typeof buttonVariants>;

/** What a server action hands back: an error to show, or none. */
interface ActionResult {
  readonly error: string | null;
}

interface ConfirmReason {
  readonly label: string;
  readonly placeholder?: string;
  /** Shown when they confirm with the reason left empty. */
  readonly missing: string;
}

interface ConfirmDialogProps {
  /**
   * The button that opens the dialog. Leave it out when something else opens
   * it, such as a switch, and control it with `open` and `onOpenChange`.
   */
  readonly trigger?: ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly triggerVariant?: ButtonLook["variant"];
  readonly triggerSize?: ButtonLook["size"];
  /** The question, such as "Revoke Front till?". */
  readonly title: ReactNode;
  /** What happens if they agree. */
  readonly description: ReactNode;
  readonly confirmLabel: string;
  readonly pendingLabel: string;
  /** What the cancel button says; "Cancel" reads oddly when cancelling. */
  readonly cancelLabel?: string;
  /** `danger` for anything that takes something away. */
  readonly tone?: "danger" | "default";
  /** Asks for a required reason, which is passed to `onConfirm`. */
  readonly reason?: ConfirmReason;
  /** More to read before agreeing, under the description, like a list. */
  readonly children?: ReactNode;
  /** Runs the action. A returned error keeps the dialog open and shows it. */
  readonly onConfirm: (reason: string) => Promise<ActionResult>;
}

/**
 * Every "are you sure?" in Tally. The dialog stays open while the action runs,
 * so a slow network can't be mistaken for a finished one, and shows the
 * action's error in place. Escape and Cancel leave everything as it was.
 */
export const ConfirmDialog = ({
  trigger,
  triggerVariant = "default",
  triggerSize = "md",
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  tone = "default",
  reason,
  onConfirm,
  open,
  onOpenChange,
  children,
}: ConfirmDialogProps) => {
  const [, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const noteInput = useRef<HTMLInputElement>(null);
  const noteId = useId();

  const confirm = async (): Promise<void> => {
    const trimmed = note.trim();

    if (reason !== undefined && trimmed === "") {
      throw new Error(reason.missing);
    }

    // Server actions run inside a transition, so the page they re-render
    // (or navigate to) arrives without a flash of the old state.
    const { promise, resolve, reject } = Promise.withResolvers<ActionResult>();

    startTransition(async () => {
      try {
        resolve(await onConfirm(trimmed));
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    const result = await promise;

    if (result.error !== null) {
      throw new Error(result.error);
    }
  };

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (next) {
          setNote("");
        }

        onOpenChange?.(next);
      }}
      open={open}
      pendingAnnouncement={pendingLabel}
    >
      {trigger === undefined ? null : (
        <AlertDialogTrigger
          className={buttonVariants({
            size: triggerSize,
            variant: triggerVariant,
          })}
        >
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogBackdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs transition-opacity duration-200 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0" />
      {/* It renders in place, so it resets what a table cell passes down. */}
      <AlertDialogContent
        className="border-line-strong bg-surface text-ink shadow-float ease-out-quick z-50 m-auto w-full max-w-md rounded-2xl border p-5 text-start font-sans font-normal tracking-normal whitespace-normal normal-nums transition-[opacity,scale,translate] duration-200 data-ending-style:translate-y-1 data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:translate-y-2 data-starting-style:scale-96 data-starting-style:opacity-0 motion-reduce:data-ending-style:translate-none motion-reduce:data-ending-style:scale-none motion-reduce:data-starting-style:translate-none motion-reduce:data-starting-style:scale-none"
        // Ask for the reason straight away; otherwise start on Cancel.
        initialFocus={
          reason === undefined ? undefined : () => noteInput.current
        }
      >
        <AlertDialogTitle className="text-md font-semibold tracking-tight text-balance">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-ink-2 mt-1.5 text-sm text-pretty">
          {description}
        </AlertDialogDescription>
        {children}

        {reason === undefined ? null : (
          <Field className="mt-4">
            <FieldLabel htmlFor={noteId}>{reason.label}</FieldLabel>
            <Input
              autoComplete="off"
              id={noteId}
              maxLength={500}
              name="note"
              onValueChange={(value) => {
                setNote(value);
              }}
              placeholder={reason.placeholder}
              ref={noteInput}
              value={note}
            />
          </Field>
        )}

        <AlertDialogClose
          action={confirm}
          render={(props, state) => (
            <div className="mt-5 grid gap-3">
              {state.error instanceof Error ? (
                <p className="text-danger text-sm" role="alert">
                  {state.error.message}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <AlertDialogClose
                  className={buttonVariants({ size: "md", variant: "ghost" })}
                >
                  {cancelLabel}
                </AlertDialogClose>
                <button
                  {...props}
                  className={cn(
                    buttonVariants({
                      size: "md",
                      variant: tone === "danger" ? "destructive" : "default",
                    })
                  )}
                  type="button"
                >
                  <PendingLabel label={pendingLabel} pending={state.pending}>
                    {confirmLabel}
                  </PendingLabel>
                </button>
              </div>
            </div>
          )}
          value="confirm"
        />
      </AlertDialogContent>
    </AlertDialog>
  );
};
