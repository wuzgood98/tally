"use client";

import { useActionState } from "react";

import { signIn } from "@/app/login/actions";
import type { SignInState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

const INITIAL: SignInState = { email: "", error: null };

export const SignInForm = ({ next }: { readonly next: string | undefined }) => {
  const [state, action, pending] = useActionState(signIn, INITIAL);
  const invalid = state.error === null ? undefined : true;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input name="next" type="hidden" value={next ?? ""} />
      <Field invalid={invalid}>
        <FieldLabel>Work email</FieldLabel>
        <Input
          aria-describedby={invalid ? "sign-in-error" : undefined}
          autoComplete="username"
          defaultValue={state.email}
          inputMode="email"
          name="email"
          required
          spellCheck={false}
          type="email"
        />
      </Field>
      <Field invalid={invalid}>
        <FieldLabel>Password</FieldLabel>
        <PasswordInput
          aria-describedby={invalid ? "sign-in-error" : undefined}
          autoComplete="current-password"
          name="password"
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
      <Button size="md" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
};
