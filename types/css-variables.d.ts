import "react";

/**
 * Lets `style` carry CSS custom properties (`style={{ "--x": "40%" }}`), so a
 * component passes a computed value to a class like `left-(--x)` instead of
 * setting the property inline.
 */
declare module "react" {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined;
  }
}
