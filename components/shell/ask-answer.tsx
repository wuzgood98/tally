"use client";

import Link from "next/link";
import { createContext, use, useMemo } from "react";
import type { ComponentProps, ReactNode } from "react";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface AnswerLinks {
  /** Links the tools returned: the only ones an answer may follow. */
  readonly hrefs: ReadonlySet<string>;
  readonly onFollow: () => void;
}

const AnswerLinksContext = createContext<AnswerLinks>({
  hrefs: new Set(),
  onFollow: () => {
    /* outside an answer there is nothing to close */
  },
});

/** A link the tools handed over opens its page; anything else is text. */
const AnswerLink = ({ children, href }: ComponentProps<"a">) => {
  const { hrefs, onFollow } = use(AnswerLinksContext);

  if (href === undefined || !hrefs.has(href)) {
    return <span>{children}</span>;
  }

  return (
    <Link
      className="text-ink decoration-ink/30 hover:decoration-ink font-medium underline underline-offset-2"
      href={href}
      onClick={onFollow}
    >
      {children}
    </Link>
  );
};

const AnswerTable = ({ children }: { readonly children?: ReactNode }) => (
  <div className="border-line my-2 overflow-x-auto rounded-lg border">
    <table className="w-full text-xs">{children}</table>
  </div>
);

const AnswerHeading = ({ children }: { readonly children?: ReactNode }) => (
  <p className="text-ink font-medium">{children}</p>
);

const COMPONENTS: Components = {
  a: AnswerLink,
  h1: AnswerHeading,
  h2: AnswerHeading,
  h3: AnswerHeading,
  li: ({ children }) => <li className="ps-0.5">{children}</li>,
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 ps-5">{children}</ol>
  ),
  p: ({ children }) => (
    <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-ink font-medium">{children}</strong>
  ),
  table: AnswerTable,
  td: ({ children }) => (
    <td className="border-line border-t px-2 py-1.5 align-top tabular-nums">
      {children}
    </td>
  ),
  th: ({ children }) => (
    <th className="text-ink-3 px-2 py-1.5 text-start font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-1 ps-5">{children}</ul>
  ),
};

const PLUGINS = [remarkGfm];

interface AskAnswerProps extends AnswerLinks {
  readonly text: string;
}

/**
 * An answer's markdown. Raw HTML is never rendered, and only links the
 * tools returned become links: a made-up URL stays plain text.
 */
export const AskAnswer = ({ hrefs, onFollow, text }: AskAnswerProps) => {
  const links = useMemo(() => ({ hrefs, onFollow }), [hrefs, onFollow]);

  return (
    <AnswerLinksContext value={links}>
      <Markdown components={COMPONENTS} remarkPlugins={PLUGINS} skipHtml>
        {text}
      </Markdown>
    </AnswerLinksContext>
  );
};
