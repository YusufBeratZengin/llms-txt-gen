# Contributing

Use Node.js 20 or newer. Runtime code is dependency-free ESM with JSDoc types; only lint and type tools are dev dependencies.

```sh
npm ci
npm run check   # eslint + tsc --strict + tests with coverage
```

`npm test` runs every test file in one process through `scripts/test.mjs` (add new test files there) and prints coverage. Tests do not touch the network and create fixtures only under the ignored `.tmp-test/`. Keep line coverage at 85% or higher.

After changing the generator output for the sample folder, run `npm run demo` to regenerate `docs/demo.svg`, and update the transcript in both READMEs; a test fails when they drift.

Guidelines:

- Add a test for every behavior change; a regression test must fail without the fix.
- Keep the README (English) and README.tr.md (Turkish) in sync, and update CHANGELOG.md under `[Unreleased]`.
- Use small Conventional Commits (`feat`, `fix`, `docs`, `test`, `ci`, `chore`).
- Never put real personal data, credentials, or local absolute paths in code, tests, or docs.
- Where the llms.txt proposal is unclear, record the decision in the README section "Standard notes and uncertainty".

## Releasing

1. Move the `[Unreleased]` notes into a dated version section and bump `version` in `package.json`.
2. Run `npm run check` and `npm pack --dry-run`.
3. Commit as `chore(release): vX.Y.Z`, create the matching `vX.Y.Z` tag, and push the tag.
4. `.github/workflows/publish.yml` checks that the tag matches `package.json`, runs lint and tests, then publishes with provenance.

The maintainer configures npm trusted publishing (OIDC) for this repository, workflow file `publish.yml` and environment `npm` before the first release. If trusted publishing is unavailable, the fallback is an `NPM_TOKEN` repository secret exposed to the publish step as `NODE_AUTH_TOKEN`. Do not publish during a review or improvement pass.
