import type { ReactNode } from "react";

import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";

interface PanelProps {
  readonly title?: ReactNode;
  readonly action?: ReactNode;
  readonly children: ReactNode;
  /** Placement only, such as margins or grid spans: it lands on the frame. */
  readonly className?: string;
  /** Tables run edge to edge; prose gets padding. */
  readonly flush?: boolean;
  readonly id?: string;
}

/** A titled card: the heading sits on the frame, the content in its panel. */
export const Panel = ({
  title,
  action,
  children,
  className,
  flush = false,
  id,
}: PanelProps) => (
  <Frame
    aria-labelledby={
      title !== undefined && id !== undefined ? `${id}-title` : undefined
    }
    as="section"
    className={className}
  >
    {title === undefined ? null : (
      <FrameHeader>
        <div className="flex items-center justify-between gap-3">
          <FrameTitle id={id === undefined ? undefined : `${id}-title`}>
            {title}
          </FrameTitle>
          {action}
        </div>
      </FrameHeader>
    )}
    <FramePanel clip flush={flush}>
      {children}
    </FramePanel>
  </Frame>
);
