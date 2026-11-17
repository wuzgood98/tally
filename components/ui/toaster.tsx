"use client";

import type { RenderProp } from "@ui-sdk/react/primitive";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from "@ui-sdk/react/toast";
import type { ToastType } from "@ui-sdk/react/toast";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

const ICONS: Partial<Record<ToastType, { icon: LucideIcon; tone: string }>> = {
  error: { icon: CircleAlert, tone: "text-danger" },
  info: { icon: Info, tone: "text-brand" },
  success: { icon: CircleCheck, tone: "text-good" },
  warning: { icon: TriangleAlert, tone: "text-warn" },
};

// An action with an href moves within the app, so it goes through the router.
const routerLink: RenderProp = ({ href, children, ...props }) =>
  href === undefined ? (
    <button type="button" {...props}>
      {children}
    </button>
  ) : (
    <Link href={String(href)} {...props}>
      {children}
    </Link>
  );

const ToastIcon = ({ type }: { readonly type: ToastType }) => {
  const look = ICONS[type];

  if (look === undefined) {
    return null;
  }

  const Icon = look.icon;

  return (
    <Icon
      aria-hidden="true"
      className={`${look.tone} mt-px size-4 shrink-0 self-start`}
    />
  );
};

/**
 * Where toasts appear: bottom right, newest nearest the edge. Mounted once in
 * the app layout; anything can call `toast()` from `@ui-sdk/react/toast`.
 */
export const Toaster = () => (
  <ToastRegion align="end" className="m-4 print:hidden" side="bottom">
    {(item) => (
      <Toast className="toast-motion border-line-strong bg-surface-2 text-ink flex-nowrap items-start gap-2.5 rounded-xl px-3.5 py-3 shadow-lg select-none">
        <ToastIcon type={item.type} />
        <div className="grid min-w-0 grow gap-0.5">
          <ToastTitle className="text-sm font-medium" />
          <ToastDescription className="text-ink-2 order-none text-xs" />
          {item.action === undefined ? null : (
            <ToastAction
              className="press text-brand mt-1 h-auto min-w-0 justify-self-start border-0 bg-transparent p-0 text-xs font-medium hover:underline"
              render={routerLink}
            />
          )}
        </div>
        <ToastClose
          aria-label="Dismiss"
          className="press text-ink-3 hover:text-ink hover:bg-surface rounded-control -me-1 -mt-0.5 grid size-6 shrink-0 place-items-center"
        >
          <X aria-hidden="true" className="size-3.5" />
        </ToastClose>
      </Toast>
    )}
  </ToastRegion>
);
