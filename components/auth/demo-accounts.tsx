import { signIn } from "@/app/login/actions";
import { DEMO_PASSWORD, STAFF } from "@/lib/db/seed-data";
import { ROLE_LABELS as ROLE_LABEL } from "@/lib/site";

/** Three people who show the three levels of access, all at Spintex. */
const PICKS = [STAFF[0], STAFF[2], STAFF[3]];

/** Plain forms, so they work before any JavaScript loads. */
const signInAs = async (formData: FormData) => {
  "use server";
  await signIn({ email: "", error: null }, formData);
};

export const DemoAccounts = ({
  next,
}: {
  readonly next: string | undefined;
}) => (
  <section
    aria-labelledby="demo-heading"
    className="border-line mt-8 border-t pt-6"
  >
    <h2
      className="text-ink-2 text-xs font-medium tracking-wide uppercase"
      id="demo-heading"
    >
      Demo accounts
    </h2>
    <p className="text-ink-2 mt-1 text-sm">
      Sample data for a fictional retailer. Every account uses the password{" "}
      <code className="bg-surface-2 rounded px-1 py-0.5 font-mono text-xs">
        {DEMO_PASSWORD}
      </code>
      .
    </p>
    <ul className="mt-3 grid gap-2">
      {PICKS.map((person) => (
        <li key={person.email}>
          <form action={signInAs}>
            <input name="email" type="hidden" value={person.email} />
            <input name="password" type="hidden" value={DEMO_PASSWORD} />
            <input name="next" type="hidden" value={next ?? ""} />
            <button
              className="press border-line bg-surface hover:border-line-strong hover:bg-surface-2 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left"
              type="submit"
            >
              <span className="grid">
                <span className="text-sm font-medium">{person?.name}</span>
                <span className="text-ink-2 text-xs">
                  {ROLE_LABEL[person.role]}
                  {person.branchId ? " · Spintex" : " · all branches"}
                </span>
              </span>
              <span className="text-brand text-sm font-medium">Sign in</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  </section>
);
