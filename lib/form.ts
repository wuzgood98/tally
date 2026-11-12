/**
 * Reading FormData at the edge. Every field arrives as text or a file; these
 * treat a missing field or an unexpected file as empty text.
 */

export const formText = (form: FormData, key: string): string => {
  const value = form.get(key);

  return value === null || value instanceof File ? "" : value.trim();
};

/** Text, or null when blank: for optional fields. */
export const formOptional = (form: FormData, key: string): string | null => {
  const value = formText(form, key);

  return value === "" ? null : value;
};

/** A whole number typed into a field, or NaN so validation can say so. */
export const formInt = (form: FormData, key: string): number => {
  const value = formText(form, key);

  return /^\d+$/u.test(value) ? Number(value) : Number.NaN;
};

/** Exactly as typed: passwords may start or end with a space. */
export const formSecret = (form: FormData, key: string): string => {
  const value = form.get(key);

  return value === null || value instanceof File ? "" : value;
};
