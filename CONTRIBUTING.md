# Contributing to OPRN Studio

Thanks for helping improve OPRN Studio. Small, focused pull requests are easiest to review.

## Before opening a pull request

1. Create a branch from `main`.
2. Keep generated output, credentials, local project databases, and screenshots out of the commit.
3. Run the checks relevant to the files you changed. The pull request checks are the final gate.
4. Describe the user-facing effect, the files changed, and how you verified it.

## Code and assets

- Follow the existing TypeScript and formatting conventions.
- Keep editor code and the MIT-licensed runtime separated.
- Do not add assets copied from commercial packs or game ROMs. Include attribution for third-party material.
- Add a regression test to the existing test file for the module you fixed. Create a new test file only when no file tests that module yet, and name it after the module, not the bug.
- Do not write tests that pin prose (prompts, docs, UI copy) or that only guard a removed feature.
- Never commit API keys, OAuth secrets, project databases, `.env` files, or credentials from local tooling.

## Pull requests

Use the pull request template. A maintainer review is required before merge, and the continuous-integration checks must pass.

By contributing, you agree to the terms in [CLA.md](CLA.md).
