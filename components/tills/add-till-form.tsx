"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";

import { addTill } from "@/app/(app)/tills/actions";
import type { AddTillState } from "@/app/(app)/tills/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import { PendingLabel } from "@/components/ui/spinner";
import { submitWithoutReset } from "@/lib/submit-without-reset";

interface AddTillFormProps {
  readonly stores: readonly { readonly id: string; readonly name: string }[];
}

const INITIAL: AddTillState = { created: null, error: null };

/** The key appears once, right here, with a button to copy it. */
const NewKey = ({
  name,
  value,
}: {
  readonly name: string;
  readonly value: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <div
      aria-live="polite"
      className="border-brand bg-brand-soft/60 rounded-lg border p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-medium">
        <KeyRound aria-hidden="true" className="size-4" />
        Key for {name}
      </p>
      <p className="text-ink-2 mt-1">
        Put this into the till&rsquo;s settings now. It won&rsquo;t be shown
        again; if it&rsquo;s lost, revoke the till and add a new one.
      </p>
      <p className="bg-surface mt-3 rounded-md px-3 py-2 font-mono text-xs break-all">
        {value}
      </p>
      <div className="mt-3">
        <Button
          onClick={() => {
            void copy();
          }}
          size="md"
          type="button"
          variant="outline"
        >
          {copied ? "Copied" : "Copy key"}
        </Button>
      </div>
    </div>
  );
};

export const AddTillForm = ({ stores }: AddTillFormProps) => {
  const [state, action, pending] = useActionState(addTill, INITIAL);

  return (
    <div className="grid gap-4">
      {state.created ? (
        <NewKey name={state.created.name} value={state.created.key} />
      ) : null}

      <form
        action={action}
        className="grid gap-4"
        // Keep what was typed after an error; a new key clears it after success.
        key={state.created?.key ?? "new"}
        onSubmit={submitWithoutReset(action)}
      >
        <Field>
          <FieldLabel>Store</FieldLabel>
          <Select
            name="branchId"
            options={namedOptions(stores)}
            placeholder="Choose a store"
            required
          />
        </Field>
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            autoComplete="off"
            maxLength={60}
            name="name"
            placeholder="e.g. Till 3, ground floor"
            required
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending} size="md" type="submit">
            <PendingLabel label="Creating…" pending={pending}>
              Add till
            </PendingLabel>
          </Button>
          <p aria-live="polite" className="text-danger text-sm">
            {state.error}
          </p>
        </div>
      </form>
    </div>
  );
};
