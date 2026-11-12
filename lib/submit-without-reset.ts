import { startTransition } from "react";
import type { SubmitEvent } from "react";

/**
 * React 19 resets a `<form action={…}>` after the action settles. That wipes
 * controlled radios and checkboxes in the DOM while their React state survives,
 * so the form could post different choices than the live price shows.
 *
 * Dispatching the action ourselves skips the reset. Keep `action={formAction}`
 * on the form as well: it still handles submits that happen before hydration.
 */
export const submitWithoutReset =
  (dispatch: (formData: FormData) => void) =>
  (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      dispatch(formData);
    });
  };
