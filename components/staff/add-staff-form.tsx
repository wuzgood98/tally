"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";

import { addStaff } from "@/app/(app)/staff/actions";
import type { AddStaffState } from "@/app/(app)/staff/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SelectOptions } from "@/components/ui/select";
import { namedOptions } from "@/components/ui/select-options";
import { submitWithoutReset } from "@/lib/submit-without-reset";

interface AddStaffFormProps {
  readonly branches: readonly { readonly id: string; readonly name: string }[];
}

const ROLE_OPTIONS = [
  { label: "Cashier", value: "cashier" },
  { label: "Storekeeper", value: "storekeeper" },
  { label: "Branch manager", value: "manager" },
  { label: "Head office", value: "admin" },
] as const satisfies SelectOptions;

const INITIAL: AddStaffState = { created: null, error: null };

export const AddStaffForm = ({ branches }: AddStaffFormProps) => {
  const [state, action, pending] = useActionState(addStaff, INITIAL);
  const [role, setRole] = useState<string>("storekeeper");

  return (
    <div className="grid gap-4">
      {state.created ? (
        <div
          className="border-brand bg-brand-soft/60 rounded-lg border p-4 text-sm"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 font-medium">
            <KeyRound aria-hidden="true" className="size-4" />
            Account created for {state.created.name}
          </p>
          <p className="text-ink-2 mt-1">
            Give them this temporary password in person. It won&rsquo;t be shown
            again.
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-2">Email</dt>
            <dd className="font-mono">{state.created.email}</dd>
            <dt className="text-ink-2">Password</dt>
            <dd className="font-mono text-base font-semibold tracking-wide">
              {state.created.password}
            </dd>
          </dl>
        </div>
      ) : null}

      <form
        action={action}
        className="grid gap-4 sm:grid-cols-2"
        // Keep what was typed after an error; a new key clears it after success.
        key={state.created?.email ?? "new"}
        onSubmit={submitWithoutReset(action)}
      >
        <Field>
          <FieldLabel>Full name</FieldLabel>
          <Input autoComplete="off" maxLength={80} name="name" required />
        </Field>
        <Field>
          <FieldLabel>Work email</FieldLabel>
          <Input
            autoComplete="off"
            name="email"
            required
            spellCheck={false}
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel>Role</FieldLabel>
          <Select
            name="role"
            onValueChange={(value) => {
              setRole(value ?? "cashier");
            }}
            options={ROLE_OPTIONS}
            value={role}
          />
        </Field>
        <Field>
          <FieldLabel>Branch</FieldLabel>
          <Select
            disabled={role === "admin"}
            name="branchId"
            options={namedOptions(branches)}
            placeholder={role === "admin" ? "All branches" : "Choose a branch"}
            required={role !== "admin"}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button size="md" disabled={pending} type="submit">
            {pending ? "Creating…" : "Create account"}
          </Button>
          <p aria-live="polite" className="text-danger text-sm">
            {state.error}
          </p>
        </div>
      </form>
    </div>
  );
};
