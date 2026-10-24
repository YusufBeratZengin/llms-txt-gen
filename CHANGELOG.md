# Changelog

All notable changes to this project are documented here, following [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Parse front matter comments before scalar conversion so commented draft flags skip unpublished pages.
- Resolve relative links from each CLI output file's directory. The API accepts `outputDir` (default: `dir`) and `fullOutputDir` (default: `outputDir`) for the same purpose; `baseUrl` takes precedence.
- Accept escaped brackets in generated link labels during validation.
- Reject full-output token budgets that cannot fit the initial title and summary.

### Added

- `llms-txt-gen [generate]` builds `llms.txt` from a folder of Markdown files, with front matter / first heading / first paragraph extraction, `--base-url`, include / exclude / optional globs, and directory-based sections.
- `--full` writes `llms-full.txt`; `--max-tokens` caps it using an offline token estimate.
- `llms-txt-gen check` validates an existing `llms.txt` (`--strict` turns warnings into failures).
- Programmatic API: `generate`, `check`, `scanFiles` and helpers.
