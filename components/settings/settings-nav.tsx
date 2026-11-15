"use client";

import { useEffect, useState } from "react";

export interface SettingsSection {
  readonly id: string;
  readonly label: string;
}

/** How far down the window a section's top must pass to count as current. */
const READING_LINE = 0.3;

/** Pixels from the very bottom that still count as the foot of the page. */
const FOOT_SLACK = 4;

/**
 * The sections as a pill bar that sticks under the header while you scroll,
 * marking the one you're reading. Plain anchor links, so it works before
 * hydration and the browser's own history and focus apply.
 */
export const SettingsNav = ({
  sections,
}: {
  readonly sections: readonly SettingsSection[];
}) => {
  const [current, setCurrent] = useState(sections[0]?.id);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;

      const atFoot =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - FOOT_SLACK;

      const line = window.innerHeight * READING_LINE;

      // The last section whose top has passed the reading line; at the foot
      // of the page, the last section, which may be too short to get there.
      const reached = atFoot
        ? sections.at(-1)
        : sections.findLast((section) => {
            const element = document.querySelector(
              `#${CSS.escape(section.id)}`
            );

            return (
              element !== null && element.getBoundingClientRect().top <= line
            );
          });

      setCurrent(reached?.id ?? sections[0]?.id);
    };

    const onScroll = () => {
      if (frame === 0) {
        frame = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  if (sections.length < 2) {
    return null;
  }

  return (
    <nav
      aria-label="Settings sections"
      className="border-line bg-surface/90 shadow-sticky sticky top-25 z-20 mb-7 inline-flex max-w-full [scrollbar-width:none] gap-0.5 overflow-x-auto rounded-full border p-0.75 backdrop-blur-md lg:top-15"
    >
      {sections.map((section) => (
        <a
          aria-current={section.id === current ? "true" : undefined}
          className="press text-ink-2 hover:text-ink aria-[current]:bg-brand-soft aria-[current]:text-brand inline-flex h-7 items-center rounded-full px-3 font-medium whitespace-nowrap"
          href={`#${section.id}`}
          key={section.id}
          onClick={() => {
            setCurrent(section.id);
          }}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
};
