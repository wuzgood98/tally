"use client";

import { useActionState } from "react";

import { signIn } from "@/app/login/actions";
import type { SignInState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const INITIAL: SignInState = { email: "", error: null };

export const SignInForm = ({ next }: { readonly next: string | undefined }) => {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input name="next" type="hidden" value={next ?? ""} />
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="email">
        Work email
        <input
          aria-describedby={state.error === null ? undefined : "sign-in-error"}
          aria-invalid={state.error === null ? undefined : true}
          autoComplete="username"
          className="field"
          defaultValue={state.email}
          id="email"
          inputMode="email"
          name="email"
          required
          spellCheck={false}
          type="email"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="password">
        Password
        <input
          aria-describedby={state.error === null ? undefined : "sign-in-error"}
          aria-invalid={state.error === null ? undefined : true}
          autoComplete="current-password"
          className="field"
          id="password"
          name="password"
          required
          type="password"
        />
      </label>
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
