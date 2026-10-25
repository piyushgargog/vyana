# Design v2 evidence (issue #492)

Before/after screenshots and the axe run for the design-system PR, kept with the change
instead of on a side branch.

| File | What it shows |
| --- | --- |
| `home-390-before.png` / `home-390-after.png` | The public home at 390px, main vs this branch: gradient hero band, "Get the app" / "Open on the web" actions, the stepped display size (40px here, not 56px). |
| `login-390-before.png` / `login-390-after.png` | The login page at 390px, main vs this branch. |
| `axe-after.json` | axe-core (wcag2a + wcag2aa) against this branch's `/`, `/privacy`, `/terms`, `/login`: **no violations** on any of the four (17–22 passes each). The same axe spec runs in CI (`tests/e2e/public.spec.ts`). |

Two gaps, stated plainly:

- **1366px captures** could not be produced in the environment this was prepared in —
  its headless browsers fail or return a blank surface at every desktop width tried
  (1024, 1280 and 1366px, retried 2026-10-25; the 390px captures above are from the
  same setup). The desktop layout is covered by the component tests in
  `apps/web/tests/unit/design-shell.test.ts` (sidebar / segmented nav / tab bar width
  classes, and the 40 → 56 → 64px display steps are plain CSS in `globals.css`)
  rather than by a picture.
- **The dashboard shell** needs a signed-in session; the demo logins are issue #99
  (Piyush's), so no signed-in screenshot can be taken here. The shell's three
  navigation forms are pinned by the same component tests.
