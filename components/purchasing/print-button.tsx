"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog, where "Save as PDF" is one option. */
export const PrintButton = () => (
  <Button
    onClick={() => {
      globalThis.print();
    }}
    size="md"
    type="button"
  >
    <Printer aria-hidden="true" />
    Print or save as PDF
  </Button>
);
