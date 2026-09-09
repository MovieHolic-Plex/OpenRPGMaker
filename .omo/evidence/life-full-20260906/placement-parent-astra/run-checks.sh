#!/usr/bin/env bash
set -eu
cd /home/main/z-project/rpg-zzu-life-full-p4
E="$PWD/.omo/evidence/life-full-20260906/placement-parent-astra"
S=$(mktemp -d /dev/shm/st_01a07948.XXXXXX)
export TMPDIR="$S/tmp" VITE_CACHE_DIR="$S/vite-cache"
mkdir -p "$TMPDIR" "$VITE_CACHE_DIR" "$S/dist"
printf '%s\n' "$S" > "$E/scratch-path.txt"
test ! -e dist && test ! -L dist
ln -s "$S/dist" dist
cleanup() {
  du -sh "$S" > "$E/cleanup-size.txt"
  if [ "$(readlink dist)" = "$S/dist" ]; then unlink dist; fi
  rm -rf "$S"
  printf '{"scratchRemoved":true,"ownedDistSymlinkRemoved":true,"serversStarted":false,"sharedCachesCleaned":false}\n' > "$E/cleanup.json"
}
trap cleanup EXIT
check_identity() {
  test "$(git rev-parse HEAD)" = b5c679efc6c5e575f7a1afb65dfa86939aade325
  sha256sum --quiet -c "$E/tracked-before.sha256"
}
run() {
  name=$1; seconds=$2; shift 2
  check_identity > "$E/$name.identity-before.log" 2>&1 || exit 91
  printf 'flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15s %ss ' "$seconds" >> "$E/commands.txt"
  printf '%q ' "$@" >> "$E/commands.txt"; printf '\n' >> "$E/commands.txt"
  set +e
  flock --timeout 900 /tmp/rpg-zzu-life-full-qa-01a0727b.lock timeout --kill-after=15s "${seconds}s" "$@" > "$E/$name.stdout" 2> "$E/$name.stderr"
  code=$?
  set -e
  printf '%s\n' "$code" > "$E/$name.exit"
  check_identity > "$E/$name.identity-after.log" 2>&1 || exit 91
}
run tests 420 node scripts/run-vitest.mjs run --configLoader runner --cache=false test/lifePlacementSafety.test.ts test/p2SpatialTransactions.test.ts test/p2SpatialPersistence.test.ts test/p2SpatialSchema.test.ts test/p2SpatialReferenceIntegrity.test.ts test/linkedAnimalHousing.test.ts test/spatialPaymentReceipts.test.ts test/lifeRecoveryPersistence.test.ts test/seasonalForage.test.ts test/toolActionAuthoringParity.test.ts test/p2LifeRuntime.test.ts test/p2HostileAudit.test.ts test/lifeSkillDisabledHarvest.test.ts test/p2SessionPersistence.test.ts --maxWorkers=2 --minWorkers=1
run diagnostics 360 node "$E/diagnostics.mjs"
run public-probe 360 node node_modules/vite-node/vite-node.mjs --config vitest.config.ts "$E/public-probe.mts"
run independent-seams 360 node node_modules/vite-node/vite-node.mjs --config vitest.config.ts "$E/independent-seams.mts"
run typecheck 360 npm run typecheck:app
run build 900 npm run build
git show -s --format='%H%n%T%n%P' > "$E/identity-after.txt"
git status --porcelain >> "$E/identity-after.txt"
sha256sum --quiet -c "$E/tracked-before.sha256" > "$E/source-after-check.stdout" 2> "$E/source-after-check.stderr"
printf '%s\n' "$?" > "$E/source-after-check.exit"
