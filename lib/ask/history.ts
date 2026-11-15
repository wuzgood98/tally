/**
 * The conversation the browser sends back with each question. It's
 * untrusted: anyone could post a long or invented one. So only the text of
 * the last few messages goes to the model; earlier tool results don't (the
 * tools run again, from the session), and the question has a length cap.
 */

import type { UIMessage } from "ai";

import { ASK_HISTORY_LIMIT, ASK_QUESTION_MAX_LENGTH } from "@/lib/ask/settings";

/** An earlier answer is kept to this length, enough for a follow-up. */
const ANSWER_MAX_LENGTH = 4000;

export type AskHistory =
  | { readonly ok: true; readonly messages: UIMessage[] }
  | { readonly ok: false; readonly error: string };

const textOf = (message: UIMessage): string => {
  const texts: string[] = [];

  for (const part of message.parts) {
    if (part.type === "text") {
      texts.push(part.text);
    }
  }

  return texts.join("\n").trim();
};

export const trimHistory = (messages: readonly UIMessage[]): AskHistory => {
  const kept: UIMessage[] = [];

  for (const message of messages.slice(-ASK_HISTORY_LIMIT)) {
    const text = textOf(message);
    const spoken = message.role === "user" || message.role === "assistant";

    if (spoken && text !== "") {
      kept.push({
        id: message.id,
        parts: [{ text: text.slice(0, ANSWER_MAX_LENGTH), type: "text" }],
        role: message.role,
      });
    }
  }

  const last = messages.at(-1);
  const question = last === undefined ? "" : textOf(last);

  if (last?.role !== "user" || question === "") {
    return { error: "Ask a question.", ok: false };
  }

  if (question.length > ASK_QUESTION_MAX_LENGTH) {
    return {
      error: `Keep the question under ${ASK_QUESTION_MAX_LENGTH} characters.`,
      ok: false,
    };
  }

  return { messages: kept, ok: true };
};
