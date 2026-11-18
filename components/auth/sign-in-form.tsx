"use client";

import { ArrowRight } from "lucide-react";
import { useActionState } from "react";

import { signIn } from "@/app/login/actions";
import type { SignInState } from "@/app/login/actions";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PendingLabel } from "@/components/ui/spinner";

const INITIAL: SignInState = { email: "", error: null };

export const SignInForm = ({ next }: { readonly next: string | undefined }) => {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const invalid = state.error === null ? undefined : true;

  return (
    <form action={action} className="mt-3 grid gap-2" noValidate>
      <input name="next" type="hidden" value={next ?? ""} />
      <Field invalid={invalid} layout="rule">
        <FieldLabel tone="caption">Email</FieldLabel>
        <Input
          aria-describedby={invalid ? "sign-in-error" : undefined}
          autoComplete="username"
          defaultValue={state.email}
          inputMode="email"
          look="line"
          name="email"
          placeholder="you@akwaaba.example"
          required
          spellCheck={false}
          type="email"
        />
      </Field>
      <Field invalid={invalid} layout="rule">
        <FieldLabel tone="caption">Password</FieldLabel>
        <PasswordInput
          aria-describedby={invalid ? "sign-in-error" : undefined}
          autoComplete="current-password"
          look="line"
          name="password"
          placeholder="Your password"
          required
        />
      </Field>
      <p
        aria-live="polite"
        className="text-danger min-h-5 text-sm"
        id="sign-in-error"
      >
        {state.error}
      </p>
      <button
        className="press bg-ink text-paper hover:bg-brand text-md flex h-11 items-center justify-between rounded-sm px-3.5 font-semibold disabled:opacity-70 data-pending:cursor-progress"
        data-pending={pending ? "" : undefined}
        disabled={pending}
        type="submit"
      >
        <PendingLabel label="Scanning in…" pending={pending}>
          Scan in
        </PendingLabel>
        <ArrowRight aria-hidden="true" className="size-4" />
      </button>
    </form>
  );
};
