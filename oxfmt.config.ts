import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Installed agent skills are vendored; skills-lock.json pins their hashes.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "**/.agents/skills",
    "**/.claude/skills",
  ],
});
