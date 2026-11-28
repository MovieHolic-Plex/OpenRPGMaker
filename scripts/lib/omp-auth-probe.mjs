#!/usr/bin/env node
// Legacy OMP SQLite auth probe — disabled after @oh-my-pi removal (2026-11-28).
process.stdout.write(`${JSON.stringify({ available: false })}\n`);
