"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** A period link's label, which breathes while its report loads. */
export const PeriodLabel = ({ children }: { readonly children: ReactNode }) => {
  const { pending } = useLinkStatus();

  return <span className={cn(pending && "pending-pulse")}>{children}</span>;
};
