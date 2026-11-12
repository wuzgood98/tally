/** "12" → 12; anything else (blank, "1.5", "-3", "1e3") → null. */
export const wholeNumber = (text: string): number | null =>
  /^\d+$/u.test(text.trim()) && Number.isSafeInteger(Number(text))
    ? Number(text)
    : null;
