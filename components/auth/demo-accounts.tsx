import { signIn } from "@/app/login/actions";
import { DEMO_PASSWORD, STAFF } from "@/lib/db/seed-data";
import { ROLE_LABELS as ROLE_LABEL } from "@/lib/site";

/** One person per level of access: head office, then three people at Spintex. */
const PICKS = [STAFF[0], STAFF[2], STAFF[3], STAFF[14]];

/** Plain forms, so they work before any JavaScript loads. */
const signInAs = async (formData: FormData) => {
  "use server";
  await signIn({ email: "", error: null }, formData);
};

/** The label's line items: one row per demo seat, each its own sign-in. */
export const DemoAccounts = ({
  next,
}: {
  readonly next: string | undefined;
}) => (
  <section
    aria-labelledby="demo-heading"
    className="border-ink-2 mt-4 border-t border-dashed pt-3 font-mono text-xs"
  >
    <div className="flex items-baseline justify-between gap-3">
      <h2
        className="text-ink-2 text-2xs tracking-widest uppercase"
        id="demo-heading"
      >
        Demo seats
      </h2>
      <p className="text-ink-2 text-2xs">
        password <span className="text-ink font-medium">{DEMO_PASSWORD}</span>
      </p>
    </div>
    <ul className="mt-1.5 grid">
      {PICKS.map((person) => (
        <li key={person.email}>
          <form action={signInAs}>
            <input name="email" type="hidden" value={person.email} />
            <input name="password" type="hidden" value={DEMO_PASSWORD} />
            <input name="next" type="hidden" value={next ?? ""} />
            <button
              aria-label={`Sign in as ${person.name}, ${ROLE_LABEL[person.role]}`}
              className="group hover:bg-surface-2 flex w-full items-baseline justify-between gap-3 rounded-sm px-1.5 py-1 text-left"
              type="submit"
            >
              <span className="text-ink-2 min-w-0 truncate">
                <span className="text-ink font-medium">
                  {ROLE_LABEL[person.role]}
                </span>
                {person.branchId ? " · Spintex" : " · all sites"}
              </span>
              <span className="text-brand shrink-0 font-semibold group-hover:underline">
                use
              </span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  </section>
);
