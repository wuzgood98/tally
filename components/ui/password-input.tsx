import {
  PasswordInput as PasswordInputPrimitive,
  PasswordInputControl,
  PasswordInputToggle,
} from "@ui-sdk/react/password-input";
import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps } from "react";

type PasswordInputProps = Omit<
  ComponentProps<typeof PasswordInputPrimitive>,
  "children" | "className"
> &
  Pick<ComponentProps<"input">, "id" | "aria-describedby" | "placeholder"> & {
    /** Boxed like every field, or written on a rule (the sign-in label). */
    readonly look?: "box" | "line";
  };

const CONTROL_LOOK = { box: "field pe-10", line: "field-line pe-10" } as const;

/*
 * ui-sdk draws the wrapper as a box of its own, with a focus ring when the
 * control inside is focused. Here the control draws the field, so the wrapper
 * is reset to a plain container and focus looks like every other field's.
 */
const WRAPPER =
  "relative h-auto rounded-none border-0 bg-transparent p-0 outline-none";

export const PasswordInput = ({
  id,
  "aria-describedby": describedBy,
  placeholder,
  look = "box",
  ...props
}: PasswordInputProps) => (
  <PasswordInputPrimitive className={WRAPPER} {...props}>
    <PasswordInputControl
      aria-describedby={describedBy}
      className={CONTROL_LOOK[look]}
      id={id}
      placeholder={placeholder}
    />
    <PasswordInputToggle
      aria-label="Show password"
      className="press text-ink-3 hover:text-ink rounded-e-control absolute inset-y-0 end-0 grid w-10 place-items-center"
    >
      <Eye aria-hidden="true" className="size-4 in-data-visible:hidden" />
      <EyeOff
        aria-hidden="true"
        className="size-4 not-in-data-visible:hidden"
      />
    </PasswordInputToggle>
  </PasswordInputPrimitive>
);
