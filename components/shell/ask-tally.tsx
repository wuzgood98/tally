"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, ChevronLeft, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import { shellIconButton } from "@/components/shell/icon-button";
import { Button } from "@/components/ui/button";
import {
  ASK_FAILED,
  askFailure,
  askStatusLine,
  isEmptyAnswer,
  linkRecords,
  messageText,
  toolLinks,
} from "@/lib/ask/conversation";
import type { AskFailure } from "@/lib/ask/conversation";
import { ASK_QUESTION_MAX_LENGTH } from "@/lib/ask/settings";

import { AskAnswer } from "./ask-answer";

const TRANSPORT = new DefaultChatTransport({ api: "/api/ask" });

export interface AskPanelProps {
  /** What was typed before choosing Ask Tally; asked at once if not empty. */
  readonly initialQuestion: string;
  readonly suggestions: readonly string[];
  /** Back to the palette's commands. */
  readonly onBack: () => void;
  /** A link in an answer was followed: close the palette. */
  readonly onFollowLink: () => void;
}

const Suggestions = ({
  onAsk,
  suggestions,
}: {
  readonly onAsk: (question: string) => void;
  readonly suggestions: readonly string[];
}) => (
  <div className="px-2 py-3">
    <p className="text-ink-3 px-2.5 pb-1 text-xs">Try asking</p>
    <ul>
      {suggestions.map((question) => (
        <li key={question}>
          <button
            className="text-ink-2 hover:bg-ink/6 hover:text-ink focus-visible:bg-ink/6 focus-visible:text-ink flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-start text-sm outline-none"
            onClick={() => {
              onAsk(question);
            }}
            type="button"
          >
            <Sparkles
              aria-hidden="true"
              className="text-ink-3 size-4 shrink-0"
            />
            <span className="grow">{question}</span>
          </button>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Ask Tally inside the palette: a question box where the search was, the
 * conversation below. It lives while the palette is open; nothing is kept.
 */
export const AskPanel = ({
  initialQuestion,
  onBack,
  onFollowLink,
  suggestions,
}: AskPanelProps) => {
  const { error, messages, regenerate, sendMessage, status } = useChat({
    transport: TRANSPORT,
  });

  const carried = initialQuestion.trim();
  const tooLong = carried.length > ASK_QUESTION_MAX_LENGTH;

  // A question carried over that's too long to ask waits in the box, cut
  // to fit, for the person to shorten.
  const [draft, setDraft] = useState(() =>
    tooLong ? carried.slice(0, ASK_QUESTION_MAX_LENGTH) : ""
  );

  const asked = useRef(false);

  const busy = status === "submitted" || status === "streaming";

  const ask = (question: string): void => {
    const text = question.trim();

    if (text === "" || busy) {
      return;
    }

    setDraft("");
    void sendMessage({ text });
  };

  // The question typed before choosing Ask Tally, once (the ref survives
  // React's development double run).
  useEffect(() => {
    if (!asked.current && carried !== "" && !tooLong) {
      asked.current = true;
      void sendMessage({ text: carried });
    }
  }, [carried, sendMessage, tooLong]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // As on the palette's other pages: Backspace in an empty box goes back,
    // until there's a conversation to lose.
    if (event.key === "Backspace" && draft === "" && messages.length === 0) {
      event.preventDefault();
      onBack();
    }
  };

  const links = toolLinks(messages);
  // The same set for as long as the same links are in it, so the answers'
  // link context holds still while text streams in.
  const hrefKey = [...links.hrefs].join(" ");

  const hrefs = useMemo(
    () => new Set(hrefKey === "" ? [] : hrefKey.split(" ")),
    [hrefKey]
  );

  const last = messages.at(-1);
  const answering = last?.role === "assistant" ? last : undefined;
  // While busy, say what's happening, unless the answer's text is arriving.
  const writing = answering?.parts.at(-1)?.type === "text";
  const showStatus = busy && !writing;

  // A finished answer with no words is a failure too, not a blank.
  const blank: AskFailure | null =
    status === "ready" && isEmptyAnswer(last)
      ? { message: ASK_FAILED, retry: true }
      : null;

  const failure = error === undefined ? blank : askFailure(error);

  return (
    <div className="flex min-h-0 grow flex-col">
      <form
        className="border-line flex items-center gap-1.5 border-b ps-2 pe-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <button
          aria-label="Back to search"
          className={shellIconButton}
          onClick={onBack}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </button>
        <input
          aria-label="Ask Tally a question"
          autoComplete="off"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- focus moves here from the palette's search box
          autoFocus
          className="placeholder:text-ink-3 h-12 min-w-0 grow bg-transparent text-base outline-none sm:text-sm"
          enterKeyHint="send"
          maxLength={ASK_QUESTION_MAX_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={
            messages.length === 0
              ? "Ask about stock, orders or sales…"
              : "Ask a follow-up…"
          }
          value={draft}
        />
        <Button
          aria-label="Ask"
          disabled={busy || draft.trim() === ""}
          size="icon"
          type="submit"
        >
          <ArrowUp />
        </Button>
      </form>
      <div
        aria-busy={busy}
        aria-label="Ask Tally conversation"
        aria-live="polite"
        // Reversed, the column scrolls from its end: the latest of the
        // conversation stays in view as it streams, with no script.
        className="flex min-h-40 grow flex-col-reverse overflow-y-auto overscroll-contain"
        role="log"
      >
        {/* mb-auto: short content sits at the top, not the bottom. */}
        <div className="mb-auto">
          {messages.length === 0 && !busy ? (
            <Suggestions onAsk={ask} suggestions={suggestions} />
          ) : (
            <div className="flex flex-col gap-3 px-4 py-3">
              {messages.map((message) =>
                message.role === "user" ? (
                  <p
                    className="bg-ink/6 text-ink max-w-[85%] self-end rounded-2xl rounded-ee-md px-3 py-2 text-sm"
                    key={message.id}
                  >
                    {messageText(message)}
                  </p>
                ) : (
                  <div
                    className="text-ink-2 text-sm leading-relaxed"
                    key={message.id}
                  >
                    <AskAnswer
                      hrefs={hrefs}
                      onFollow={onFollowLink}
                      text={linkRecords(messageText(message), links.labels)}
                    />
                  </div>
                )
              )}
              {showStatus ? (
                <p className="text-ink-3 animate-pulse text-sm motion-reduce:animate-none">
                  {askStatusLine(answering)}
                </p>
              ) : null}
              {failure === null ? null : (
                <div className="text-ink-2 flex flex-wrap items-center gap-2 text-sm">
                  <span>{failure.message}</span>
                  {failure.retry ? (
                    <Button
                      onClick={() => {
                        void regenerate();
                      }}
                      size="md"
                      variant="outline"
                    >
                      <RotateCcw data-icon="inline-start" />
                      Retry
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="border-line text-ink-3 border-t px-4 py-2.5 text-xs">
        Answers come from Tally&rsquo;s own figures, for the branches you can
        see. Ask Tally can&rsquo;t change anything.
      </p>
    </div>
  );
};
