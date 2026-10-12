# Contributing to Vyana

`main` is protected. **Nobody can push to it directly, not even admins.** Every change lands through a pull request that passes CI and gets one approval.

Before writing code, read the team plan, `PLAN.md`. It is shared privately and is **never committed** (it is gitignored), so keep your copy in the repo root.
- **Section 0** tells you how to brief your coding LLM.
- **Section 8** says which files you own.
- **Section 9** lists your tasks.

## 1. Branches

Create one short-lived branch per task, cut from the latest `main`:

```
<name>/<task-id>-<short-slug>
```

| Example | Task |
|---|---|
| `piyush/p5-medicine-compare` | P5 |
| `arvind/a2-sos-screen` | part of A2 |
| `vaibhav/v3-rls-policies` | V3 |

For a fix that has no task, use `<name>/fix-<slug>`, e.g. `arvind/fix-login-crash`.

```bash
git switch main && git pull --rebase
git switch -c piyush/p5-medicine-compare
```

Keep your branch fresh while you work. **Never merge `main` into your branch; rebase instead.**

```bash
git fetch origin && git rebase origin/main
git push --force-with-lease      # OK on YOUR branch only
```

## 2. Commits

We use [Conventional Commits](https://www.conventionalcommits.org): `type(scope): what changed`.

| type | when |
|---|---|
| `feat` | new feature |
| `fix` | bug fix |
| `refactor` | code change, no behavior change |
| `chore` | tooling, deps, config |
| `docs` | docs only |
| `test` | tests only |
| `ci` | GitHub Actions |
| `style` | formatting only |
| `perf` | performance |

| scope | area |
|---|---|
| `web` | the web app |
| `mobile` | the mobile app |
| `api` | API routes |
| `shared` | `@vyana/shared` |
| `db` | database |
| `tinyfish` | TinyFish layer |
| `ai` | AI layer |
| `ui` | UI components |
| `deps` | dependencies |
| `repo` | repository setup |

Examples:

```
feat(api): add medicines compare route with parallel TinyFish agents
fix(mobile): reschedule dose reminders after app restart
feat(db): add RLS policies for prescriptions
```

**Rules:**
- Make small commits that each do one thing.
- Write the subject in the imperative, lowercase, with no full stop, under 72 characters.
- Never commit secrets or `.env` files. Only `.env.example` is committed.

## 3. Pull requests

1. Push your branch and open a PR into `main`.
2. **PR title = a Conventional Commit**, e.g. `feat(api): medicines compare route`. CI checks it, because it becomes the commit message when the PR is squashed.
3. Fill in the template and link the issue with `Closes #<n>`.
4. Wait for **all checks to pass** and get **1 approval** from a teammate.
5. Resolve every review comment.
6. Merge with **Squash and merge** (default), or **Rebase and merge** if every commit in the PR is meaningful on its own. Merge commits are disabled. The branch is deleted automatically after merge.
7. Move your card on the [project board](https://github.com/users/piyushgargog/projects/1) to **Done**. Closing the issue does this automatically.

Keep PRs small. Several small PRs per task are better than one huge PR.

## 4. Contract changes

The DB schema, API contracts and shared exports (`PLAN.md` §5–7) are shared by everyone.

If you need to change one:
1. Tell the owner first.
2. The owner updates **`PLAN.md` + code + mocks in the same PR**.
3. The owner posts `CONTRACT CHANGED: …` in the team chat.

## 5. Reviews

As a reviewer, check that:
- the PR touches only the author's files
- the contracts were respected
- there are no secrets
- the "Done when" condition from the issue is met
- UI changes meet [`ACCESSIBILITY.md`](ACCESSIBILITY.md) (screen reader labels, contrast, text scaling, keyboard on web)

Approve or request changes within a few hours. Fast reviews keep everyone unblocked.

## 6. Conduct

Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md).
