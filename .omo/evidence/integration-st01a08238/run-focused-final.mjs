import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const files = [
  'approachCorrection', 'pr687VerificationIntegration', 'canonicalAcceptanceOwnership', 'sceneVerificationRepair',
  'verificationSelectionOwnership', 'assistantVerificationEvidence', 'aiStickyChecklist', 'proposalCompleteness',
  'aiCompletionAccounting', 'aiTurnAppliedAccounting', 'transparentTileLayerRouting',
  'nonHistoryIntegrationSeams', 'historyRecoveryAdmission',
  'aiConversationRemoteHistory', 'aiConversationHistoryModal', 'aiChatSessionScope', 'projectWikiHistorySources',
  'aiSettingsHistoryFocus', 'mapConversationRemote', 'mapConversationStore', 'conversationStore',
  'aiAssistantSession', 'aiRunEndProof', 'aiWorkItemStall', 'assistantAcceptanceSession', 'assistantDependencyRetry',
  'assistantVerificationContinuation', 'assistantVisualEvidenceSession', 'npcRewardSession', 'runOutcomeApplyFixture',
  'toolSchemaProviderCompat', 'independentReview', 'assistantIndependentReview', 'assistantReviewApprovalLifecycle',
  'assistantIndependentReviewCapacity', 'independentReviewEvidenceScale', 'assistantReviewEvidenceOverflow',
  'assistantTilesetVisualReview', 'assistantBackgroundReview', 'assistantFunctionalReviewIntegration', 'consumedApprovalReporting',
  'storePersistenceLineage', 'storeDeferredLineage', 'transactionalRemoteSourceLineage', 'storePersistenceProof',
  'functionalPersistenceProof', 'projectWikiTimeout', 'projectWikiDelivery', 'devMediaPromotion', 'mediaImportDurability',
  'audioPreviewSession', 'audioPreviewSurfaces', 'newProjectDialog', 'eventValidationNavigationContract',
  'eventValidationRecoveryFields', 'aiLlmClient', 'assistantAcceptanceProvider',
  'independentReviewLinkedMaps', 'independentReviewMapDeltas', 'independentReviewReferenceScope',
  'authoredSoftConfirmReviewEquality', 'authoredWorldReviewApplication', 'assistantAuthoredBaseline',
  'advisoryLintProvenance', 'assistantAcceptanceRequestBaseline', 'gameTitlePersistenceProof', 'aiOutcomeContinuationDelivery',
].map(name => `test/${name}.test.ts`);
if (new Set(files).size !== files.length) throw new Error('Duplicate selected test file');
writeFileSync('.omo/evidence/integration-st01a08238/focused-final-manifest.json', JSON.stringify(files, null, 2) + '\n');
const args = ['test', '--', ...files, '--maxWorkers=2', '--minWorkers=1', '--reporter=default', '--reporter=json',
  '--outputFile=.omo/evidence/integration-st01a08238/focused-final.json'];
console.log(JSON.stringify({ command: ['npm', ...args], historyProjection: false, files: files.length }));
const result = spawnSync('npm', args, { stdio: 'inherit' });
writeFileSync('.omo/evidence/integration-st01a08238/focused-final.exit', `${result.status ?? 'signal:' + result.signal}\n`);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
