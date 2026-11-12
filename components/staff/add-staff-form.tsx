"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";

import { addStaff } from "@/app/(app)/staff/actions";
import type { AddStaffState } from "@/app/(app)/staff/actions";
import { Button } from "@/components/ui/button";
import { submitWithoutReset } from "@/lib/submit-without-reset";

interface AddStaffFormProps {
  readonly branches: readonly { readonly id: string; readonly name: string }[];
}

const INITIAL: AddStaffState = { created: null, error: null };

export const AddStaffForm = ({ branches }: AddStaffFormProps) => {
  const [state, action, pending] = useActionState(addStaff, INITIAL);
  const [role, setRole] = useState("storekeeper");

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
        <label className="grid gap-1.5 text-sm font-medium">
          Full name
          <input
            autoComplete="off"
            className="field"
            maxLength={80}
            name="name"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Work email
          <input
            autoComplete="off"
            className="field"
            name="email"
            required
            spellCheck={false}
            type="email"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Role
          <select
            className="field"
            name="role"
            onChange={(event) => {
              setRole(event.target.value);
            }}
            value={role}
          >
            <option value="cashier">Cashier</option>
            <option value="storekeeper">Storekeeper</option>
            <option value="manager">Branch manager</option>
            <option value="admin">Head office</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Branch
          <select
            className="field"
            defaultValue=""
            disabled={role === "admin"}
            name="branchId"
            required={role !== "admin"}
          >
            <option value="">
              {role === "admin" ? "All branches" : "Choose a branch"}
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
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
