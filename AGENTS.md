# AGENTS.md

## Misc

Use conventional commit style messages.

## Formatting

**ALWAYS run `npm run format` after making any change.** This is not optional and applies to every
file you touch — source, tests, docs, config, JSON, CSS, YAML and Markdown alike.

oxfmt is the formatter; its settings live in `.oxfmtrc.json`. It reads `.gitignore`, so build output
is skipped automatically.

- `npm run format` — format the repo in place
- `npm run format:check` — verify without writing

## Linting

**ALWAYS run `npm run lint` after making any change** and fix what it reports.

oxlint is the linter; its settings live in `.oxlintrc.json`. It lints `src/` and `scripts/` — `dist/`
and `docs/` are excluded via `ignorePatterns`.

- `npm run lint` — report violations
- `npm run lint:fix` — apply the fixes oxlint can make automatically

The `correctness`, `suspicious` and `perf` categories are errors. `style` and `pedantic` are
deliberately off: oxfmt already owns layout, and the remainder is opinion rather than defect
detection — turning them on produced thousands of diagnostics that fight the existing house style.

Prefer fixing the code over silencing the rule. When a rule genuinely misfires, add it to a scoped
entry in `overrides` (by file glob) rather than disabling it repo-wide, and record why inline — the
existing entries cover the boxed-`String` picklist markers in `src/evaluator/schema.ts`, the
sequential polling loop in `scripts/`, and the data-driven Vitest suites in `src/__tests__/`.

## Commit hook

A `pre-commit` hook in `.githooks/` runs both the format check and oxlint against the whole codebase
and **blocks the commit** if either fails, so skipping those steps will stop the commit rather than
slip through. It checks a snapshot of the index, not the working tree, so it sees exactly what the
commit will contain: a file formatted on disk but not re-staged still blocks, and unstaged edits
never do. The hook is wired up by the `prepare` script (`git config core.hooksPath .githooks`) on
`npm install`. Emergency bypass: `git commit --no-verify`.

## Types

`tsconfig.json` sets `isolatedDeclarations`, so **every exported symbol needs an explicit type
annotation** — an exported function with an inferred return type will fail `npm run build`.

`npm run typecheck` checks the whole tree including tests and scripts (`tsconfig.typecheck.json`);
`npm run build` only emits declarations for the published `src/`.

The root package is CommonJS, which is why the vitest config is `vitest.config.mts`. **Do not add
`"type": "module"` to package.json** — it would make the published `dist/cjs` build load as ESM and
break every CommonJS consumer.

## Testing

We maintain very high test coverage, add tests for any changes.

## Documentation

Make sure all changes are represented in the documentation as appropriate.

The `docs/` directory contains a Docusaurus site with its own `package-lock.json`. Run `npm install`
then `npm start` inside `docs/` for local development. The site imports the library from `../dist`
rather than from npm, so run `npm run build` in the repository root before starting, building or
typechecking (`npm run typecheck`) the docs.

if you build this, an llm markdown file is available: `docs/build/llms-full.txt` - this could be a good way to learn about the entire project if you are working on a very large task.

## Dependency overrides

`npm audit` is kept clean with `overrides` in `package.json` (root and `docs/`) wherever a
transitive dependency has a patched release that its parent does not yet accept. Every override is
a stopgap, so when the parent moves onto the patched range itself, drop the override rather than
leaving it to pin the tree forever. Run `npm audit` in both the root and `docs/` when upgrading
dependencies, and remember that a bare override applies to the whole tree. When another copy of the
package must stay on an older major, key the override by range (`"minimatch@^9.0.0": "^9.0.7"`):
npm then only rewrites dependency edges whose declared range intersects the key. Do not nest the
override under the parent package instead — npm 11 hoisted the overridden copy and handed it to
`serve-handler` as well, which would have broken `docusaurus serve`.

Root:

- `basic-ftp` → `^6.2.3`. ReDoS advisories (GHSA-c475-qrg2-pj4r and two later ones); `get-uri`,
  reached through release-it → proxy-agent → pac-proxy-agent, still accepts only 5.x. The only 6.0
  breaking change disables separate FTP transfer hosts, which `get-uri` never uses. Remove once
  `get-uri` depends on `basic-ftp@^6.2.3` or later.

Docs site:

- `minimatch@^9.0.0` → `^9.0.7` and `yaml@^2.0.0` → `^2.8.3`, for the exact pins in
  `docusaurus-plugin-llms`. The fixes are patch releases in the same major. Keyed by range because
  `serve-handler` needs `minimatch` 3.x, whose CommonJS entry is a function where 9.x exports an
  object. Remove once the plugin's own pins reach those versions.
- `tinypool` → `^2.1.2`. Prototype-pollution advisories; 2.0 only dropped Node 18, and the
  Docusaurus 4 canary already depends on `^2.1.2` with the same SSG worker code. Remove once
  `@docusaurus/core` does the same.
- `serialize-javascript` → `^7.0.5`. RCE and CPU-exhaustion advisories; 7.0 only requires Node 20,
  and the current copy-webpack-plugin and css-minimizer-webpack-plugin releases already use 7.x.
  Remove once `@docusaurus/bundler` takes versions of those plugins that do.
- `postcss-selector-parser` → `^7.1.6`. CPU-exhaustion advisory with no fix in 6.x; the cssnano 7
  plugins moved from 6.x to 7.x in a patch release, and the rest of the tree already uses 7.1.6.
  Remove once `@docusaurus/cssnano-preset` moves to cssnano 7 or later.
- `uuid` → `^11.1.1`. Bounds-check advisory; 11 keeps the CommonJS entry point that `sockjs`
  requires, whereas 12 drops it, so do not raise this to 12.x. Remove once `sockjs` depends on
  `uuid@^11.1.1` or later, or once Docusaurus moves to webpack-dev-server 6, which no longer uses
  `sockjs`.

`braces` and `sprintf-js` in the docs site have no patched release at all, so they stay flagged
until one is published.

## Releasing

Releases are cut from `main` by CI, kicked off from your terminal:

```sh
npm run release              # derive the version from CHANGELOG.md
npm run release -- --dry-run # show the plan, dispatch nothing
npm run release -- minor     # force a bump level (major | minor | patch)
npm run release -- 3.0.0     # force an explicit version
```

The bump is derived from the `[Unreleased]` section of `CHANGELOG.md` by
`scripts/derive-increment.mjs`, reading **section headings only** — never the entry text, so an
entry that merely mentions a breaking change cannot turn a patch into a major:

| `[Unreleased]` contains                                   | Bump  |
| --------------------------------------------------------- | ----- |
| `### Breaking Changes`                                    | major |
| `### Added` or `### Deprecated`                           | minor |
| `### Changed`, `### Removed`, `### Fixed`, `### Security` | patch |

**So keep `[Unreleased]` accurate — it decides the version.** Those seven headings are the whole
vocabulary; anything else is an error rather than a guess, because guessing risks publishing a
breaking change as a patch. Internal or tooling-only entries go under `### Changed`. An empty
`[Unreleased]` aborts the release. `npm run release:increment` shows the reasoning without
releasing.

The `Changelog` workflow enforces this on every pull request that touches published code: it fails
if `CHANGELOG.md` was not updated, and then fails again if `[Unreleased]` does not classify to a
bump — so a touched-but-empty section is caught too. Label a pull request `skip-changelog` to opt
out when a change genuinely needs no entry.

The script refuses to run unless you are on `main`, the working tree is clean, and your branch
matches `origin/main`. It then dispatches the `Release` workflow with the computed version and
tails the run. The bump, build and publish all happen on CI, so npm provenance (OIDC) is preserved
— running the release locally would lose it.

Release commits pass `--no-verify`: they are machine generated from already checked files, and a
hook failing mid-release would abort after the npm publish.

`scripts/derive-increment.mjs`, `scripts/release.mjs`, `.githooks/pre-commit` and the
`.github/workflows/ci.yml`, `release.yml` and `changelog.yml` workflows are shared verbatim with
[soql-parser-js](https://github.com/jetstreamapp/soql-parser-js),
[simple-excel](https://github.com/jetstreamapp/simple-excel) and
[simple-xml](https://github.com/jetstreamapp/simple-xml) — keep every copy in sync when changing
them.
