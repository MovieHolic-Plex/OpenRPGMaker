#!/bin/bash
# Rebuild walk-hard.mjs from its parts (head + shared helpers lifted from ../walk.mjs + battery mechanics).
cd "$(dirname "$0")" && cat walk-head.part.mjs walk-base.part.mjs walk-mechs.part.mjs > walk-hard.mjs && node --check walk-hard.mjs && echo ok
