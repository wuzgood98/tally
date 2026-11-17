import { createCn } from "cn/config";

/**
 * Class merging that knows Tally's extra type sizes (`globals.css`), so
 * `text-figure` next to `text-warn` keeps both instead of reading the size as
 * a colour and dropping it, and the `rounded-control` corner.
 */
export const cn = createCn({
  extend: { theme: { radius: ["control"], text: ["2xs", "md", "figure"] } },
});
