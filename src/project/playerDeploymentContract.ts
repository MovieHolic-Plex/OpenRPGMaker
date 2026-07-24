import { contractFailure, WebExportContractError } from "@/project/playerDeploymentErrors";
import {
  assertDisjointPathSets,
  contractPath,
  isRecord,
  parseFileRecords,
  parseJsonObject,
  parsePathList,
  samePathList,
} from "@/project/playerDeploymentPaths";
import type {
  DeploymentFileRecord,
  ParsedPlayerDeploymentManifest,
  PlayerDeploymentAdapters,
} from "@/project/playerDeploymentTypes";

export const WEB_PLAYER_CONTRACT = Object.freeze({
  sentinel: "rpg-zzu/player-sdk-manifest",
  contractVersion: 2,
  schemaVersion: 4,
  deploymentSchemaVersion: 1,
  entryHtml: "player.html",
  entryScript: "player.js",
  viteManifest: "player-manifest.json",
});

export async function parsePlayerDeploymentManifest(
  bytes: Uint8Array,
  adapters: Required<PlayerDeploymentAdapters>,
): Promise<ParsedPlayerDeploymentManifest> {
  const manifest = parseJsonObject(bytes, "manifest-malformed", adapters.parseJson);
  if (
    manifest["sentinel"] !== WEB_PLAYER_CONTRACT.sentinel
    || manifest["contractVersion"] !== WEB_PLAYER_CONTRACT.contractVersion
    || manifest["schemaVersion"] !== WEB_PLAYER_CONTRACT.schemaVersion
  ) {
    contractFailure("manifest-contract-mismatch");
  }
  const files = parseFileRecords(manifest["files"]);
  const sourceInputs = parseFileRecords(manifest["sourceInputs"]);
  const [artifactDigest, sourceDigest] = await safeDigestPair(files, sourceInputs, adapters.hashText);
  if (
    manifest["artifactDigest"] !== artifactDigest
    || manifest["artifactVersion"] !== artifactDigest.slice(0, 16)
    || manifest["sourceDigest"] !== sourceDigest
    || !isNonEmptyString(manifest["sourceRevision"])
    || !isValidTimestamp(manifest["builtAt"])
  ) {
    contractFailure("manifest-contract-mismatch");
  }
  const deployment = manifest["deployment"];
  if (!isRecord(deployment) || deployment["schemaVersion"] !== WEB_PLAYER_CONTRACT.deploymentSchemaVersion) {
    contractFailure("manifest-contract-mismatch");
  }
  const entryHtml = contractPath(deployment["entryHtml"]);
  const entryScript = contractPath(deployment["entryScript"]);
  const viteManifest = contractPath(deployment["viteManifest"]);
  if (
    entryHtml !== WEB_PLAYER_CONTRACT.entryHtml
    || entryScript !== WEB_PLAYER_CONTRACT.entryScript
    || viteManifest !== WEB_PLAYER_CONTRACT.viteManifest
  ) {
    contractFailure("manifest-contract-mismatch");
  }
  const artifactPaths = parsePathList(deployment["artifactPaths"]);
  if (!samePathList(artifactPaths, files.map((file) => file.path))) contractFailure("manifest-incomplete");
  const runtimeAssets = parseFileRecords(deployment["runtimeAssets"]);
  assertDisjointPathSets(files.map((file) => file.path), runtimeAssets.map((file) => file.path));
  const runtimeAssetDigest = await safeDigest(runtimeAssets, adapters.hashText);
  const expectedDeploymentDigest = await safeHashText(adapters.hashText, JSON.stringify({
    artifactDigest,
    runtimeAssetDigest,
    entryHtml,
    entryScript,
    viteManifest,
  }));
  if (
    deployment["runtimeAssetDigest"] !== runtimeAssetDigest
    || deployment["deploymentDigest"] !== expectedDeploymentDigest
  ) {
    contractFailure("manifest-contract-mismatch");
  }
  return { artifactDigest, files, deployment: { entryHtml, entryScript, viteManifest, runtimeAssets } };
}

async function safeDigestPair(
  files: readonly DeploymentFileRecord[],
  sources: readonly DeploymentFileRecord[],
  hashText: (text: string) => Promise<string>,
): Promise<readonly [string, string]> {
  try {
    return await Promise.all([digestFileRecords(files, hashText), digestFileRecords(sources, hashText)]);
  } catch (error) {
    if (error instanceof WebExportContractError) throw error;
    contractFailure("manifest-contract-mismatch");
  }
}

async function safeDigest(
  records: readonly DeploymentFileRecord[],
  hashText: (text: string) => Promise<string>,
): Promise<string> {
  return safeHashText(hashText, JSON.stringify(records.map((record) => [record.path, record.bytes, record.sha256])));
}

async function digestFileRecords(
  records: readonly DeploymentFileRecord[],
  hashText: (text: string) => Promise<string>,
): Promise<string> {
  return hashText(JSON.stringify(records.map((record) => [record.path, record.bytes, record.sha256])));
}

async function safeHashText(hashText: (text: string) => Promise<string>, text: string): Promise<string> {
  try {
    return await hashText(text);
  } catch (error) {
    if (error instanceof WebExportContractError) throw error;
    contractFailure("manifest-contract-mismatch");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidTimestamp(value: unknown): boolean {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
