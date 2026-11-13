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
  Pick<ComponentProps<"input">, "id" | "aria-describedby" | "placeholder">;

export const PasswordInput = ({
  id,
  "aria-describedby": describedBy,
  placeholder,
  ...props
}: PasswordInputProps) => (
  <PasswordInputPrimitive className="relative" {...props}>
    <PasswordInputControl
      aria-describedby={describedBy}
      className="field pe-10"
      id={id}
      placeholder={placeholder}
    />
    <PasswordInputToggle
      aria-label="Show password"
      className="press text-ink-3 hover:text-ink absolute inset-y-0 end-0 grid w-10 place-items-center rounded-e-md"
    >
      <Eye aria-hidden="true" className="size-4 in-data-visible:hidden" />
      <EyeOff
        aria-hidden="true"
        className="size-4 not-in-data-visible:hidden"
      />
    </PasswordInputToggle>
  </PasswordInputPrimitive>
);
