import { Frame, FramePanel } from "@/components/ui/frame";
import { Table, Td, Th } from "@/components/ui/table";
import { FLASH_COOKIE } from "@/lib/flash";
import { SCOPE_COOKIE } from "@/lib/scope";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Better Auth's session cookie (`__Secure-` in front of it over HTTPS). */
const SESSION_COOKIE = "better-auth.session_token";

/** Everything Tally keeps in the browser. Add a row for anything new. */
const STORAGE = [
  {
    name: SESSION_COOKIE,
    use: "Keeps you signed in. Gone when you sign out, or after eight hours.",
  },
  {
    name: SCOPE_COOKIE,
    use: "Remembers the branch you were looking at. Kept for a year.",
  },
  {
    name: SIDEBAR_COOKIE,
    use: "Remembers that you folded the sidebar into icons. Removed when you unfold it.",
  },
  {
    name: FLASH_COOKIE,
    use: "Carries a “saved” message to the next page. Lasts a minute at most.",
  },
  {
    name: THEME_STORAGE_KEY,
    use: "Your light or dark theme. Kept in this browser’s local storage, never sent to the server.",
  },
] as const;

export const StorageTable = () => (
  <Frame>
    <FramePanel clip flush>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>What it&rsquo;s for</Th>
          </tr>
        </thead>
        <tbody>
          {STORAGE.map((item) => (
            <tr key={item.name}>
              <Td nowrap>
                <code className="font-mono text-xs">{item.name}</code>
              </Td>
              <Td tone="muted">{item.use}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </FramePanel>
  </Frame>
);
