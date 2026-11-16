"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAuth } from "@/lib/auth";
import { databaseReady } from "@/lib/db";
import { forgetFlash } from "@/lib/flash-server";
import { formSecret, formText } from "@/lib/form";

export interface SignInState {
  readonly email: string;
  readonly error: string | null;
}

const credentials = z.object({
  email: z.email("Enter your work email address."),
  next: z.string(),
  password: z.string().min(1, "Enter your password."),
});

/** Only same-site paths, so a crafted link can't bounce you elsewhere after signing in. */
const safeNext = (next: string): string =>
  next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";

/** Signs in and sets the session cookie; returns why it failed, or null. */
const attemptSignIn = async (
  email: string,
  password: string
): Promise<string | null> => {
  try {
    await getAuth().api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });

    return null;
  } catch (error) {
    if (!(error instanceof APIError)) {
      throw error;
    }

    if (error.status === "UNAUTHORIZED") {
      return "That email and password don't match an account.";
    }

    return error.message === ""
      ? "Couldn't sign you in. Try again."
      : error.message;
  }
};

export const signIn = async (
  _previous: SignInState,
  formData: FormData
): Promise<SignInState> => {
  const email = formText(formData, "email");

  const parsed = credentials.safeParse({
    email,
    next: formText(formData, "next"),
    password: formSecret(formData, "password"),
  });

  if (!parsed.success) {
    return {
      email,
      error: parsed.error.issues[0]?.message ?? "Check your details.",
    };
  }

  await databaseReady();
  const failure = await attemptSignIn(parsed.data.email, parsed.data.password);

  if (failure === null) {
    await forgetFlash();
    redirect(safeNext(parsed.data.next));
  }

  return { email, error: failure };
};

export const signOut = async (): Promise<void> => {
  await getAuth().api.signOut({ headers: await headers() });
  await forgetFlash();
  redirect("/login");
};
