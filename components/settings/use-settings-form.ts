"use client";

import { useActionState } from "react";

import type { SettingsFormState } from "@/app/(app)/settings/actions";

type SettingsAction = (
  previous: SettingsFormState,
  form: FormData
) => Promise<SettingsFormState>;

const INITIAL: SettingsFormState = { error: null };

/**
 * A settings form's action state, calling `onSaved` (a toast, a turn of the
 * badge) after each save that worked. Errors stay in the state, inline.
 */
export const useSettingsForm = (
  action: SettingsAction,
  onSaved: (form: FormData) => void
) =>
  useActionState(async (previous: SettingsFormState, form: FormData) => {
    const next = await action(previous, form);

    if (next.error === null) {
      onSaved(form);
    }

    return next;
  }, INITIAL);
