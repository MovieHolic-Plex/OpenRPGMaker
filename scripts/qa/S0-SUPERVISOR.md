# S0 supervisor verification

The supervisor read both Python files and the handoff, then independently ran
the lightweight boundary tests with an empty outer environment and Python
`-I -S -B`.

`mon_RNFDXA68SC661VSQ` / `bash_100` exited0: all12 tests passed together.
Both Python files returned no LSP errors before execution. The supervisor
parsed all19 exported receipts: launcher outcomes include0,23 and125 as expected,
and every recorded owned scratch was removed without a cleanup error.

Supervisor receipts remain at:
`/var/tmp/s0-supervisor-selftests-u5olwA`.
They are fixture-only proofs, not project gate results.

The source view, network/filesystem/environment denial, unchanged uid1000,
capability drop, child inheritance, exact failing-command exit and failure
cleanup were tested with fake values. No live project/provider request,
installation or user configuration change was made.

The corresponding testing-guide note was added in this isolated tree.
Its INDEX coordinates must be regenerated with the final merged UI docs.
Do not claim final source capture or N1/N2/N3/B1/B2/G1 have passed from this
self-test. The real-source/dependency capture and command results remain
separate acceptance evidence.

## Real-input capture preflight

`mon_BCGFMFENSGZW03NK` / `bash_101` exited0 after capturing the stable S0
worktree and the actual installed dependency tree, then running `/usr/bin/true`
inside the boundary. This was NOT the changing main UI tree or a project gate.

- Run: `e747132a-9307-4c8d-ae5e-68d3f977cee4`.
- Source HEAD: `d4303a65fa738c5bf4bf8ebc2f020368cdf18b26`.
- Selected files: 7713.
- Source hash: `87bebfe1062b79b4ea009213b71f950bbf0b2ce0634b21c980f2b8bbf92509a6`.
- Dependencies hash: `954096e660d97d8aae17c1d6cfbff5ff723b67771a05a7d0cff60e6cd296b6b2`.
- Boundary: uid1000, capabilities0, no-new-privileges, loopback only,
  zero nonlocal routes. Command/launcher exit0, error null, scratch removed.
- Retained receipt/manifest:
  `/var/tmp/s0-real-capture-E73H3Y/capture/`.

This note was added after that capture, so its source hash is historical
preflight identity, not a pin for later final validation.
