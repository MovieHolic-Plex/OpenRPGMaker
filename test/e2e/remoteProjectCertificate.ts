import { createHash, randomBytes, randomUUID } from "node:crypto";

const CERTIFICATE = "isolated-owned-fixture-v1";
const ISOLATION_MARKER = "rpg-zzu-e2e-owned-only";
const PROJECT_REF = /^[a-z0-9]{20}$/;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const PROJECT_TITLE = /^rpg-zzu-e2e-[A-Za-z0-9_-]{16,}$/;
const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RemoteCertificateErrorCode =
  | "certificate"
  | "isolation-marker"
  | "dedicated-url"
  | "dedicated-key"
  | "project-ref"
  | "ordinary-url"
  | "ordinary-key";

export type RemoteCertificateResult =
  | { readonly ok: false; readonly code: RemoteCertificateErrorCode }
  | { readonly ok: true; readonly certificate: ValidatedRemoteCertificate };

export type RemoteCertificateEnvironment = Readonly<Record<string, string | undefined>>;

export type ValidatedRemoteCertificate = Readonly<{
  appCapability: string;
  anonKey: string;
  credentialDigest: string;
  projectRef: string;
  url: string;
}>;

export type ProjectCanonicalPayload = Readonly<{
  serialized: string;
  value: unknown;
}>;

export type OwnedProjectReceipt = Readonly<{
  projectId: string;
  title: string;
}>;

export type RemoteRequest = Readonly<{
  body?: string;
  headers: Readonly<Record<string, string>>;
  method: "DELETE" | "GET";
  url: string;
}>;

export type RemoteResponse = Readonly<{
  body: string;
  status: number;
}>;

export type RemoteTransport = (request: RemoteRequest) => Promise<RemoteResponse>;

export type RemoteLifecycleResult = Readonly<{
  canonicalPayload: string;
}>;

export type RemoteLifecycleOrchestratorInput<T extends RemoteLifecycleResult> = Readonly<{
  certificate: ValidatedRemoteCertificate;
  receipt: OwnedProjectReceipt;
  transport: RemoteTransport;
  runOwnedLifecycle: () => Promise<T>;
}>;

export function validateRemoteCertificateEnvironment(
  env: RemoteCertificateEnvironment,
  options: { readonly allowTestLocalhost?: boolean } = {},
): RemoteCertificateResult {
  if (env.RPGZZU_E2E_REMOTE_CERTIFICATE !== CERTIFICATE) return failure("certificate");
  if (env.RPGZZU_E2E_REMOTE_ISOLATION_MARKER !== ISOLATION_MARKER) return failure("isolation-marker");
  const projectRef = env.RPGZZU_E2E_REMOTE_PROJECT_REF ?? "";
  if (!PROJECT_REF.test(projectRef)) return failure("project-ref");
  const dedicatedUrl = parseCertificateUrl(env.RPGZZU_E2E_REMOTE_URL, projectRef, options.allowTestLocalhost === true);
  if (!dedicatedUrl) return failure("dedicated-url");
  const dedicatedKey = env.RPGZZU_E2E_REMOTE_ANON_KEY?.trim() ?? "";
  if (!JWT_SHAPE.test(dedicatedKey)) return failure("dedicated-key");
  const ordinaryUrl = parseOrdinaryUrl(env.VITE_SUPABASE_URL);
  if (ordinaryUrl !== dedicatedUrl) return failure("ordinary-url");
  if (env.VITE_SUPABASE_ANON_KEY?.trim() !== dedicatedKey) return failure("ordinary-key");
  return {
    ok: true,
    certificate: Object.freeze({
      appCapability: randomBytes(32).toString("base64url"),
      anonKey: dedicatedKey,
      credentialDigest: createHash("sha256").update(dedicatedKey).digest("hex"),
      projectRef,
      url: dedicatedUrl,
    }),
  };
}

export function requireRemoteCertificateEnvironment(
  env: RemoteCertificateEnvironment,
  options: { readonly allowTestLocalhost?: boolean } = {},
): ValidatedRemoteCertificate {
  const result = validateRemoteCertificateEnvironment(env, options);
  if (!result.ok) throw new RemoteCertificateFailure(`environment-${result.code}`);
  return result.certificate;
}

export function createOwnedProjectReceipt(): OwnedProjectReceipt {
  return Object.freeze({
    projectId: randomUUID(),
    title: `rpg-zzu-e2e-${randomBytes(18).toString("base64url")}`,
  });
}

export function assertOwnedProjectReceipt(receipt: OwnedProjectReceipt): void {
  if (!Object.isFrozen(receipt) || !PROJECT_ID.test(receipt.projectId) || !PROJECT_TITLE.test(receipt.title)) {
    throw new RemoteCertificateFailure("receipt-invalid");
  }
}

export async function assertOwnedProjectAbsent(
  certificate: ValidatedRemoteCertificate,
  receipt: OwnedProjectReceipt,
  transport: RemoteTransport,
): Promise<void> {
  assertOwnedProjectReceipt(receipt);
  const byId = await readRows(certificate, receipt, transport, false);
  const exact = await readRows(certificate, receipt, transport, true);
  if (byId.length !== 0 || exact.length !== 0) throw new RemoteCertificateFailure("preflight-not-absent");
}

export async function assertOwnedProjectPresent(
  certificate: ValidatedRemoteCertificate,
  receipt: OwnedProjectReceipt,
  transport: RemoteTransport,
  expectedCanonicalPayload?: string,
): Promise<Readonly<{ current_json?: unknown; project_id: string; title: string }>> {
  assertOwnedProjectReceipt(receipt);
  const byId = await readRows(certificate, receipt, transport, false);
  const exact = await readRows(certificate, receipt, transport, true);
  if (byId.length !== 1 || exact.length !== 1 || !sameOwnedRow(byId[0], receipt) || !sameOwnedRow(exact[0], receipt)) {
    throw new RemoteCertificateFailure("ownership-mismatch");
  }
  if (expectedCanonicalPayload !== undefined) {
    const expected = parseCanonicalPayload(expectedCanonicalPayload);
    if (!("current_json" in exact[0]!) || canonicalJson(exact[0]!.current_json) !== expected.serialized) {
      throw new RemoteCertificateFailure("payload-mismatch");
    }
  }
  return exact[0]!;
}

export async function runRemoteProjectLifecycle<T extends RemoteLifecycleResult>(
  input: RemoteLifecycleOrchestratorInput<T>,
): Promise<T> {
  const { certificate, receipt, transport } = input;
  await assertOwnedProjectAbsent(certificate, receipt, transport);

  let result: T | undefined;
  let primaryFailure: unknown;
  try {
    result = await input.runOwnedLifecycle();
    await assertOwnedProjectPresent(certificate, receipt, transport, result.canonicalPayload);
  } catch (error) {
    primaryFailure = error;
  }

  let cleanupFailure: unknown;
  try {
    await deleteExactOwnedProjectIfPresent(certificate, receipt, transport);
  } catch (error) {
    cleanupFailure = error;
  }

  if (primaryFailure !== undefined && cleanupFailure !== undefined) {
    throw new AggregateError([primaryFailure, cleanupFailure], "lifecycle-and-cleanup-failed");
  }
  if (primaryFailure !== undefined) throw primaryFailure;
  if (cleanupFailure !== undefined) throw cleanupFailure;
  if (result === undefined) throw new RemoteCertificateFailure("lifecycle-result-missing");
  return result;
}

export async function deleteExactOwnedProject(
  certificate: ValidatedRemoteCertificate,
  receipt: OwnedProjectReceipt,
  transport: RemoteTransport,
): Promise<void> {
  await assertOwnedProjectPresent(certificate, receipt, transport);
  const response = await transport({
    headers: headers(certificate, "write"),
    method: "DELETE",
    url: projectUrl(certificate, receipt, true),
  });
  const rows = parseRows(response, "delete");
  if (rows.length !== 1 || !sameOwnedRow(rows[0], receipt)) throw new RemoteCertificateFailure("delete-representation-mismatch");
  const byId = await readRows(certificate, receipt, transport, false);
  const exact = await readRows(certificate, receipt, transport, true);
  if (byId.length !== 0 || exact.length !== 0) throw new RemoteCertificateFailure("final-presence");
}

async function deleteExactOwnedProjectIfPresent(
  certificate: ValidatedRemoteCertificate,
  receipt: OwnedProjectReceipt,
  transport: RemoteTransport,
): Promise<void> {
  assertOwnedProjectReceipt(receipt);
  const byId = await readRows(certificate, receipt, transport, false);
  const exact = await readRows(certificate, receipt, transport, true);
  if (byId.length === 0 && exact.length === 0) {
    await assertOwnedProjectAbsent(certificate, receipt, transport);
    return;
  }
  if (byId.length !== 1 || exact.length !== 1 || !sameOwnedRow(byId[0], receipt) || !sameOwnedRow(exact[0], receipt)) {
    throw new RemoteCertificateFailure("cleanup-ownership-mismatch");
  }
  await deleteExactOwnedProject(certificate, receipt, transport);
}

export class RemoteCertificateFailure extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "RemoteCertificateFailure";
  }
}

function failure(code: RemoteCertificateErrorCode): RemoteCertificateResult {
  return { ok: false, code };
}

function parseCertificateUrl(raw: string | undefined, projectRef: string, allowTestLocalhost: boolean): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (allowTestLocalhost && url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) {
      return url.origin;
    }
    if (url.protocol !== "https:" || url.port || url.hostname !== `${projectRef}.supabase.co`) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function parseOrdinaryUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function projectUrl(certificate: ValidatedRemoteCertificate, receipt: OwnedProjectReceipt, includeTitle: boolean): string {
  const query = new URLSearchParams({
    select: includeTitle ? "project_id,title,current_json" : "project_id,title",
    project_id: `eq.${receipt.projectId}`,
  });
  if (includeTitle) query.set("title", `eq.${receipt.title}`);
  return `${certificate.url}/rest/v1/projects?${query.toString()}`;
}

async function readRows(
  certificate: ValidatedRemoteCertificate,
  receipt: OwnedProjectReceipt,
  transport: RemoteTransport,
  includeTitle: boolean,
): Promise<readonly Record<string, unknown>[]> {
  const response = await transport({ headers: headers(certificate, "read"), method: "GET", url: projectUrl(certificate, receipt, includeTitle) });
  return parseRows(response, "read");
}

function parseRows(response: RemoteResponse, phase: string): readonly Record<string, unknown>[] {
  if (response.status < 200 || response.status >= 300) throw new RemoteCertificateFailure(`${phase}-http`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.body);
  } catch {
    throw new RemoteCertificateFailure(`${phase}-decode`);
  }
  if (!Array.isArray(parsed) || parsed.some((row) => !isRecord(row))) throw new RemoteCertificateFailure(`${phase}-shape`);
  return parsed;
}

function parseCanonicalPayload(serialized: string): ProjectCanonicalPayload {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new RemoteCertificateFailure("expected-payload-decode");
  }
  return Object.freeze({ serialized: canonicalJson(value), value });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function sameOwnedRow(row: Record<string, unknown> | undefined, receipt: OwnedProjectReceipt): boolean {
  return row?.project_id === receipt.projectId && row.title === receipt.title;
}

function headers(certificate: ValidatedRemoteCertificate, mode: "read" | "write"): Readonly<Record<string, string>> {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${certificate.anonKey}`,
    apikey: certificate.anonKey,
    ...(mode === "read"
      ? { "Accept-Profile": "rpg_zzu" }
      : { "Content-Profile": "rpg_zzu", Prefer: "return=representation" }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
