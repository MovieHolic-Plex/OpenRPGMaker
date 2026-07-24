---
kind: dependency_management
name: pnpm Monorepo with Single-Project Dependency Locking
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - .infisical.json
---

This repository uses pnpm as its package manager and lockfile format, despite being a single-package project (no workspace: references in any package.json). The dependency management setup is minimal and flat.

### System & Toolchain
- Package manager: pnpm (lockfile v9.0)
- Lockfile: pnpm-lock.yaml — committed to the repo for reproducible installs across CI and developer machines
- Workspace config: pnpm-workspace.yaml exists but contains only an unused allowBuilds.esbuild placeholder; no actual workspace packages are declared, so this is effectively a single-project layout
- No vendoring: No vendor/, node_modules/ checked in, and no private registry configuration beyond a standard npm registry

### Declared Dependencies
The root package.json declares a very small surface area:
- Runtime: phaser@^3.90.0 (the Phaser 3 game engine)
- Dev tooling: vite@^6, vitest@^4, typescript@^5, @playwright/test@^1, happy-dom@^20

All other code lives in src/, scripts/, test/, and evals/ as plain TypeScript/Node scripts that import from these shared dev dependencies rather than from sibling packages. There are no internal workspace:* cross-references.

### Secrets / Private Registry
- .infisical.json points to an Infisical workspace for secrets management, but it does not configure a private npm registry or auth proxy. Runtime secrets (e.g., LLM API keys) are expected to be supplied via environment variables at runtime.

### Conventions & Rules
- All third-party versions are pinned through the lockfile; developers should update via pnpm up and commit the updated pnpm-lock.yaml.
- No separate per-subproject manifests exist — everything is managed from the root package.json.
- No private npm registry, token, or .npmrc is present; all packages come from the public npm registry.