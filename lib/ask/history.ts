/**
 * The conversation the browser sends back with each question. It's
 * untrusted: anyone could post a long or invented one. So only the text of
 * the last few messages goes to the model; earlier tool results don't (the
 * tools run again, from the session), and the question has a length cap.
 */

import type { UIMessage } from "ai";

import { messageText } from "@/lib/ask/conversation";
import { ASK_HISTORY_LIMIT, ASK_QUESTION_MAX_LENGTH } from "@/lib/ask/settings";

/** An earlier answer is kept to this length, enough for a follow-up. */
const ANSWER_MAX_LENGTH = 4000;

export type AskHistory =
  | { readonly ok: true; readonly messages: UIMessage[] }
  | { readonly ok: false; readonly error: string };

export const trimHistory = (messages: readonly UIMessage[]): AskHistory => {
  const kept: UIMessage[] = [];

  for (const message of messages.slice(-ASK_HISTORY_LIMIT)) {
    const text = messageText(message);
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
  const question = last === undefined ? "" : messageText(last);

  if (last?.role !== "user" || question === "") {
    return { error: "Ask a question.", ok: false };
  }

  if (question.length > ASK_QUESTION_MAX_LENGTH) {
    return {
      error: `Keep the question under ${ASK_QUESTION_MAX_LENGTH} characters.`,
      ok: false,
    };
  }

  // The model reads a conversation that starts with a question, so a cut
  // that begins on an answer drops it.
  const firstQuestion = kept.findIndex((message) => message.role === "user");

  return { messages: kept.slice(Math.max(firstQuestion, 0)), ok: true };
};
