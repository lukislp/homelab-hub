# Contributing to homelab-hub

Thanks for taking the time. homelab-hub is a single-maintainer project, so the process is
deliberately small - but it is the same for every change, including the maintainer's own.

## How changes get in

1. Open an issue first for anything bigger than a typo or an obvious bug fix, so the direction can
   be agreed before you spend time on it. Use the templates under `.github/ISSUE_TEMPLATE/`.
2. Fork the repository (or branch, if you have write access) and make your change on a branch.
3. Open a pull request against `master`. The pull-request template asks for what changed and why.
4. `master` is protected: a PR merges only after the whole test stage of
   [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) is green and the branch is up to
   date with `master` (enable auto-merge and it lands on its own once that is the case). Nobody
   pushes to `master` directly, not even the maintainer.

## What a pull request needs

- **Conventional Commits.** The version and the changelog are generated from the commit messages
  (`feat:` = minor release, `fix:` = patch release, `build:`/`ci:`/`docs:`/`test:` = no release).
  Squash-merge keeps the PR title as the commit message, so give the PR a Conventional Commit
  title.
- **Green required checks.** `test-smoke`, `test-typecheck`, `test-coverage`, `test-security`,
  `test-k8s-manifests`, `test-e2e`, `build` and `review / dependency-review` are required; a red
  one blocks the merge.
- **Tests for new functionality.** New features and bug fixes come with tests under `tests/`
  (`tests/server/` for the Node backend, `tests/lib/` and `tests/store/` for the frontend). A PR
  that adds behaviour without a test is asked to add one. The coverage badge in the README is
  regenerated from the merged coverage report on every release and is expected not to drop.
- **Types.** `npx tsc -b --noEmit` runs as `test-typecheck`; the build itself (`npm run build`)
  type-checks too. Do not silence a type error without saying why in the PR.
- **Dependencies.** `npm audit --audit-level=high` runs as `test-security` and must stay clean.
- **Deployment manifests.** Changes under `k8s/` are validated by `npm run validate:k8s`
  (`test-k8s-manifests`), which includes the Gateway API schemas.

## Running things locally

Node 24 or newer (`engines` in `package.json`).

```bash
npm install
npm run server   # API on :8080, data in ./data/links.json
npm run dev      # Vite dev server, proxies /api -> :8080
```

The same commands CI runs:

```bash
npm run build           # TypeScript check + production build
npm test                # unit tests (vitest)
npm run test:coverage   # same, with a coverage report (coverage/index.html)
npm run smoke           # API smoke test (endpoints, limits, traversal, probe sweep)
npm run e2e             # headless browser test - needs Chromium
npm run validate:k8s    # manifest checks + kubeconform
```

`e2e` and `shots` look for Chromium at `/opt/pw-browsers` or via `PW_CHROMIUM=/path/to/chrome`.

## Security issues

Please do not open a public issue for a vulnerability - use the private reporting path described
in [SECURITY.md](SECURITY.md). The [Code of Conduct](CODE_OF_CONDUCT.md) applies to every
interaction in this repository.
