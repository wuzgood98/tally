"use client";

import { toast } from "@ui-sdk/react/toast";
import { LockKeyhole, Sparkles, TriangleAlert } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { switchAskTally } from "@/app/(app)/settings/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Switch } from "@/components/ui/switch";
import type { AskTallyState } from "@/lib/ask/settings";
import { cn } from "@/lib/utils";

interface AskTallySwitchProps {
  readonly state: AskTallyState;
  /** "Efua Asante on 15 Nov 2026", once someone has turned it on. */
  readonly turnedOn: string | null;
  readonly hourlyLimit: number;
}

/** What the consent screen asks head office to know, in short. */
const GOOD_TO_KNOW = (hourlyLimit: number) =>
  [
    { figure: String(hourlyLimit), text: "questions per person, per hour." },
    {
      figure: "~50",
      text: "requests a day on free models; each question uses 2–3.",
    },
    {
      figure: "Paid",
      text: "For real company data, choose a paid model whose terms you accept (ASK_TALLY_MODEL).",
    },
    { figure: "Never", text: "Cashiers never get Ask Tally." },
  ] as const;

const Status = ({
  state,
  turnedOn,
}: Pick<AskTallySwitchProps, "state" | "turnedOn">) => {
  if (state === "no_key") {
    return (
      <p className="text-ink-3 flex items-start gap-1.5 text-xs">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Needs <code className="font-mono">OPENROUTER_API_KEY</code> on the
          server.
        </span>
      </p>
    );
  }

  if (state === "on_no_key") {
    return (
      <p className="bg-warn-soft text-warn flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs">
        <TriangleAlert
          aria-hidden="true"
          className="mt-0.5 size-3.5 shrink-0"
        />
        <span>
          Turned on, but the server has no{" "}
          <code className="font-mono">OPENROUTER_API_KEY</code>. Ask Tally is
          hidden until it&apos;s set.
        </span>
      </p>
    );
  }

  if (state === "on") {
    return (
      <p className="text-ink-3 text-xs">
        {turnedOn === null ? "On." : `Turned on by ${turnedOn}.`}
      </p>
    );
  }

  return (
    <p className="text-ink-3 text-xs">
      Off. Nobody sees Ask Tally in the palette.
    </p>
  );
};

/**
 * Ask Tally's company-wide switch (head office). Turning it on goes through
 * the consent screen; turning it off takes nothing away, so it's one click.
 */
export const AskTallySwitch = ({
  state,
  turnedOn,
  hourlyLimit,
}: AskTallySwitchProps) => {
  const optedIn = state === "on" || state === "on_no_key";
  const [shown, setShown] = useOptimistic(optedIn);
  const [pending, startTransition] = useTransition();
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const turnOff = () => {
    setError(null);
    startTransition(async () => {
      setShown(false);
      const result = await switchAskTally(false);
      setError(result.error);

      if (result.error === null) {
        toast.success("Ask Tally turned off", {
          description: "It's gone from everyone's palette.",
        });
      }
    });
  };

  const lit = shown && state !== "on_no_key";

  return (
    <Frame>
      <FramePanel>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-10 place-items-center rounded-lg transition-colors duration-150",
              lit ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-3"
            )}
          >
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <p
              className="flex items-center gap-2 font-medium"
              id="ask-switch-label"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full transition duration-150",
                  lit ? "bg-good ring-good/20 ring-3" : "bg-ink-3"
                )}
              />
              Ask Tally for everyone but cashiers
            </p>
            <p className="text-ink-3 text-xs" id="ask-switch-hint">
              Sends each question, with the figures needed to answer it, to
              OpenRouter.
            </p>
          </div>
          <Switch
            aria-describedby="ask-switch-hint"
            aria-labelledby="ask-switch-label"
            checked={shown}
            disabled={state === "no_key" || pending}
            onCheckedChange={(next) => {
              if (next) {
                setError(null);
                setConsent(true);
              } else {
                turnOff();
              }
            }}
            size="lg"
          />
          <div aria-live="polite" className="col-start-2 col-end-4">
            <Status state={state} turnedOn={turnedOn} />
            {error === null ? null : (
              <p className="text-danger mt-1 text-xs" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </FramePanel>
      <FramePanel>
        <dl className="grid gap-3 sm:grid-cols-3 sm:gap-0">
          {[
            { label: "questions per person", value: `${hourlyLimit} / hour` },
            { label: "never changes stock", value: "Reads only" },
            { label: "each person sees only what they may", value: "By role" },
          ].map((fact) => (
            <div
              className="sm:border-line sm:border-l sm:border-dashed sm:px-3.5 sm:first:border-0 sm:first:ps-0"
              key={fact.value}
            >
              <dt className="sr-only">{fact.label}</dt>
              <dd className="figures text-md font-medium tracking-tight">
                {fact.value}
              </dd>
              <dd className="text-ink-3 text-xs">{fact.label}</dd>
            </div>
          ))}
        </dl>
      </FramePanel>

      <ConfirmDialog
        confirmLabel="Turn on Ask Tally"
        description="Each question sends product names, stock figures, costs, branch and staff names to OpenRouter and the AI model's host. Free models' hosts may keep or train on what they receive. Ask Tally only reads, never changes stock, and shows each person only what they're allowed to see."
        onConfirm={async () => {
          const result = await switchAskTally(true);

          if (result.error === null) {
            toast.success("Ask Tally is on", {
              description:
                "It's in the command palette for everyone but cashiers.",
            });
          }

          return result;
        }}
        onOpenChange={setConsent}
        open={consent}
        pendingLabel="Turning on…"
        title="Turn on Ask Tally?"
      >
        <div className="mt-4">
          <p className="text-ink-3 mb-1.5 text-xs font-medium">Good to know</p>
          <ul className="border-line border-t border-dashed">
            {GOOD_TO_KNOW(hourlyLimit).map((item) => (
              <li
                className="border-line text-ink-2 grid grid-cols-[3rem_1fr] gap-2.5 border-b border-dashed py-1.75 text-sm last:border-0 last:pb-0"
                key={item.figure}
              >
                <b className="figures text-ink text-xs leading-5 font-medium">
                  {item.figure}
                </b>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </ConfirmDialog>
    </Frame>
  );
};
