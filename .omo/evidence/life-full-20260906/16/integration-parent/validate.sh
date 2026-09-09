#!/usr/bin/env bash
set -u
cd /home/main/z-project/rpg-zzu-life-full-p5 || exit 2
out=.omo/evidence/life-full-20260906/16/integration-parent/run-1
mkdir "$out" || exit 2
run_check() {
 local label="$1"; shift
 printf '%q ' "$@" > "$out/$label.command"; printf '\n' >> "$out/$label.command"
 "$@" > "$out/$label.log" 2>&1
 local code=$?
 printf '%s\n' "$code" > "$out/$label.exit"
 printf '%s exit %s\n' "$label" "$code"
 return "$code"
}
git rev-parse HEAD > "$out/head.txt"
git write-tree > "$out/input-tree.txt"
git status --porcelain > "$out/status.txt"
overall=0
run_check tests npm test -- test/lifeRecoveryLedgerUi.test.ts test/lifeRecovery.test.ts test/lifeRecoveryPersistence.test.ts test/lifeRecoveryRecordKeys.test.ts test/p0DayTransitionSceneFailure.test.ts test/p1DayTransitionIntegration.test.ts test/p1WeatherDayTransition.test.ts test/p2DayTransition.test.ts test/p0LifeLedgerUi.test.ts test/p2LifeLedgerUi.test.ts test/playerStatusMenu.test.ts test/playerStatusMenuClosingGuard.test.ts test/playerStatusMenuEdgeDock.test.ts test/playerStatusMenuEntryIcons.test.ts test/playerStatusMenuMotion.test.ts test/playerStatusMenuPortrait.test.ts test/runtimeCursorMenu.test.ts test/runtimeDomTitleGuard.test.ts test/playerInputCss.test.ts test/animalHousingConfirmationLifecycle.test.ts test/spatialRecoveryRights.test.ts test/scheduledTimeDiagnostics.test.ts test/p0TransitionControlFlow.test.ts test/timeSystem.test.ts test/lifeEconomyConsumerParity.test.ts test/shopPrice.test.ts test/shopMerchantGold.test.ts test/shopHaggleRuntime.test.ts test/p0Bundles.test.ts test/p0Shipping.test.ts test/p0EconomySafetyFollowup.test.ts test/p0SafetyHardening.test.ts test/p0ProjectSchema.test.ts test/lifeAuthoringReferences.test.ts test/databaseReferenceGuards.test.ts test/eventDraftValidator.test.ts test/previewSimulation.test.ts test/sceneTestRunner.test.ts test/p0ToolCapability.test.ts test/p0SessionPersistence.test.ts test/runtimeQaFrames.test.ts test/makerClockIntegration.test.ts test/lifeQaObservability.test.ts test/runtimeQaInstrumentationBoundary.test.ts test/runtimeQaReport.test.ts --maxWorkers=4 || overall=1
run_check typecheck npm run typecheck:app || overall=1
run_check build npm run build || overall=1
run_check unchanged git diff --exit-code || overall=1
run_check staged-whitespace git diff --cached --check || overall=1
exit "$overall"
