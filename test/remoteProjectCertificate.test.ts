import { describe, expect, it } from "vitest";
import {
  assertOwnedProjectAbsent,
  assertOwnedProjectPresent,
  createOwnedProjectReceipt,
  deleteExactOwnedProject,
  validateRemoteCertificateEnvironment,
  runRemoteProjectLifecycle,
  type RemoteCertificateEnvironment,
  type RemoteRequest,
  type RemoteResponse,
} from "./e2e/remoteProjectCertificate";

const REF = "abcdefghijklmnopqrst";
const KEY = "aaa.bbb.ccc";
const URL = `https://${REF}.legacyDb.co`;

function validEnv(): RemoteCertificateEnvironment {
  return {
    OPRN_E2E_REMOTE_CERTIFICATE: "isolated-owned-fixture-v1",
    OPRN_E2E_REMOTE_URL: URL,
    OPRN_E2E_REMOTE_ANON_KEY: KEY,
    OPRN_E2E_REMOTE_ISOLATION_MARKER: "rpg-zzu-e2e-owned-only",
    OPRN_E2E_REMOTE_PROJECT_REF: REF,
    VITE_LEGACY_DB_URL: `${URL}/`,
    VITE_LEGACY_DB_ANON_KEY: KEY,
  };
}

describe("remote certificate environment gate", () => {
  const invalid: Array<[string, (env: Record<string, string | undefined>) => void]> = [
    ["absent certificate", (env) => delete env.OPRN_E2E_REMOTE_CERTIFICATE],
    ["wrong certificate", (env) => { env.OPRN_E2E_REMOTE_CERTIFICATE = "wrong"; }],
    ["absent marker", (env) => delete env.OPRN_E2E_REMOTE_ISOLATION_MARKER],
    ["wrong marker", (env) => { env.OPRN_E2E_REMOTE_ISOLATION_MARKER = "wrong"; }],
    ["missing dedicated URL", (env) => delete env.OPRN_E2E_REMOTE_URL],
    ["missing dedicated key", (env) => delete env.OPRN_E2E_REMOTE_ANON_KEY],
    ["missing ref", (env) => delete env.OPRN_E2E_REMOTE_PROJECT_REF],
    ["malformed URL", (env) => { env.OPRN_E2E_REMOTE_URL = "not-a-url"; }],
    ["HTTP live URL", (env) => { env.OPRN_E2E_REMOTE_URL = "http://localhost"; env.VITE_LEGACY_DB_URL = "http://localhost"; }],
    ["non LegacyDb host", (env) => { env.OPRN_E2E_REMOTE_URL = "https://example.com"; env.VITE_LEGACY_DB_URL = "https://example.com"; }],
    ["host ref mismatch", (env) => { env.OPRN_E2E_REMOTE_URL = "https://zzzzzzzzzzzzzzzzzzzz.legacyDb.co"; env.VITE_LEGACY_DB_URL = env.OPRN_E2E_REMOTE_URL; }],
    ["malformed ref", (env) => { env.OPRN_E2E_REMOTE_PROJECT_REF = "short"; }],
    ["empty key", (env) => { env.OPRN_E2E_REMOTE_ANON_KEY = ""; }],
    ["malformed key", (env) => { env.OPRN_E2E_REMOTE_ANON_KEY = "not-jwt"; }],
    ["ordinary URL absent", (env) => delete env.VITE_LEGACY_DB_URL],
    ["ordinary URL mismatch", (env) => { env.VITE_LEGACY_DB_URL = "https://zzzzzzzzzzzzzzzzzzzz.legacyDb.co"; }],
    ["ordinary key absent", (env) => delete env.VITE_LEGACY_DB_ANON_KEY],
    ["ordinary key mismatch", (env) => { env.VITE_LEGACY_DB_ANON_KEY = "xxx.yyy.zzz"; }],
  ];

  it.each(invalid)("rejects %s before any transport exists", (_name, mutate) => {
    const env = { ...validEnv() };
    mutate(env);
    expect(validateRemoteCertificateEnvironment(env).ok).toBe(false);
  });

  it("returns normalized opaque certificate and a fresh high-entropy capability", () => {
    const first = validateRemoteCertificateEnvironment(validEnv());
    const second = validateRemoteCertificateEnvironment(validEnv());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.certificate.url).toBe(URL);
    expect(first.certificate.projectRef).toBe(REF);
    expect(first.certificate.credentialDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.certificate.appCapability.length).toBeGreaterThanOrEqual(32);
    expect(first.certificate.appCapability).not.toBe(second.certificate.appCapability);
    expect(JSON.stringify(first.certificate)).not.toContain("Authorization");
  });

  it("permits HTTP localhost only under the explicit fake option", () => {
    const env = { ...validEnv(), OPRN_E2E_REMOTE_URL: "http://127.0.0.1:54321", VITE_LEGACY_DB_URL: "http://127.0.0.1:54321" };
    expect(validateRemoteCertificateEnvironment(env).ok).toBe(false);
    expect(validateRemoteCertificateEnvironment(env, { allowTestLocalhost: true }).ok).toBe(true);
  });

  it("does not accept ordinary credentials as dedicated fallback", () => {
    const env = { VITE_LEGACY_DB_URL: URL, VITE_LEGACY_DB_ANON_KEY: KEY };
    expect(validateRemoteCertificateEnvironment(env)).toEqual({ ok: false, code: "certificate" });
  });
});

describe("owned project lifecycle", () => {
  function certificate() {
    const result = validateRemoteCertificateEnvironment(validEnv());
    if (!result.ok) throw new Error(result.code);
    return result.certificate;
  }

  it("uses exact dual predicates, one representation delete, and final absence reads", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const requests: RemoteRequest[] = [];
    let present = true;
    const transport = async (request: RemoteRequest): Promise<RemoteResponse> => {
      requests.push(request);
      if (request.method === "DELETE") {
        present = false;
        return { status: 200, body: JSON.stringify([{ project_id: receipt.projectId, title: receipt.title }]) };
      }
      return { status: 200, body: present ? JSON.stringify([{ project_id: receipt.projectId, title: receipt.title }]) : "[]" };
    };
    await deleteExactOwnedProject(cert, receipt, transport);
    const deletes = requests.filter((request) => request.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.url).toContain(`project_id=eq.${receipt.projectId}`);
    expect(deletes[0]!.url).toContain(`title=eq.${encodeURIComponent(receipt.title)}`);
    expect(deletes[0]!.headers.Prefer).toBe("return=representation");
    expect(deletes[0]!.headers["Content-Profile"]).toBe("rpg_zzu");
    expect(requests.slice(-2).every((request) => request.method === "GET")).toBe(true);
  });

  it.each([
    ["zero rows", "[]"],
    ["multiple rows", "MULTIPLE"],
    ["wrong title", "WRONG_TITLE"],
    ["malformed JSON", "{"],
  ])("issues zero DELETE for pre-delete ownership failure: %s", async (_name, mode) => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const requests: RemoteRequest[] = [];
    const transport = async (request: RemoteRequest): Promise<RemoteResponse> => {
      requests.push(request);
      if (mode === "MULTIPLE") return { status: 200, body: JSON.stringify([{ project_id: receipt.projectId, title: receipt.title }, { project_id: receipt.projectId, title: receipt.title }]) };
      if (mode === "WRONG_TITLE") return { status: 200, body: JSON.stringify([{ project_id: receipt.projectId, title: "not-owned" }]) };
      return { status: 200, body: mode };
    };
    await expect(deleteExactOwnedProject(cert, receipt, transport)).rejects.toThrow();
    expect(requests.filter((request) => request.method === "DELETE")).toHaveLength(0);
  });

  it("rejects a canonical payload mismatch before DELETE", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const requests: RemoteRequest[] = [];
    const row = { current_json: { z: 1, nested: { b: 2, a: 1 } }, project_id: receipt.projectId, title: receipt.title };
    const transport = async (request: RemoteRequest): Promise<RemoteResponse> => {
      requests.push(request);
      return { status: 200, body: JSON.stringify([row]) };
    };
    await expect(assertOwnedProjectPresent(cert, receipt, transport, JSON.stringify({ nested: { a: 1, b: 2 }, z: 2 })))
      .rejects.toThrow("payload-mismatch");
    expect(requests.filter((request) => request.method === "DELETE")).toHaveLength(0);
  });

  it("accepts an equal canonical payload independent of object key order", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const row = { current_json: { z: 1, nested: { b: 2, a: 1 } }, project_id: receipt.projectId, title: receipt.title };
    await expect(assertOwnedProjectPresent(
      cert,
      receipt,
      async () => ({ status: 200, body: JSON.stringify([row]) }),
      JSON.stringify({ nested: { a: 1, b: 2 }, z: 1 }),
    )).resolves.toMatchObject({ project_id: receipt.projectId, title: receipt.title });
  });

  it("preflight requires exact absence and performs GET only", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const requests: RemoteRequest[] = [];
    await assertOwnedProjectAbsent(cert, receipt, async (request) => {
      requests.push(request);
      return { status: 200, body: "[]" };
    });
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.method === "GET")).toBe(true);
  });

  it("runs absence, lifecycle, canonical presence, and exact cleanup in order", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    const requests: RemoteRequest[] = [];
    let row: { project_id: string; title: string; current_json: unknown } | undefined;
    const transport = async (request: RemoteRequest): Promise<RemoteResponse> => {
      requests.push(request);
      if (request.method === "DELETE") {
        const deleted = row;
        row = undefined;
        return { status: 200, body: JSON.stringify(deleted ? [deleted] : []) };
      }
      return { status: 200, body: JSON.stringify(row ? [row] : []) };
    };
    const canonicalPayload = JSON.stringify({ nested: { a: 1, b: 2 } });
    await expect(runRemoteProjectLifecycle({
      certificate: cert,
      receipt,
      transport,
      runOwnedLifecycle: async () => {
        row = { project_id: receipt.projectId, title: receipt.title, current_json: { nested: { b: 2, a: 1 } } };
        return { canonicalPayload };
      },
    })).resolves.toEqual({ canonicalPayload });
    expect(row).toBeUndefined();
    expect(requests.filter((request) => request.method === "DELETE")).toHaveLength(1);
  });

  it("preserves primary and cleanup failures together", async () => {
    const cert = certificate();
    const receipt = createOwnedProjectReceipt();
    let row: { project_id: string; title: string; current_json: unknown } | undefined;
    const transport = async (request: RemoteRequest): Promise<RemoteResponse> => {
      if (request.method === "DELETE") return { status: 500, body: "cleanup denied" };
      return { status: 200, body: JSON.stringify(row ? [row] : []) };
    };
    const failure = runRemoteProjectLifecycle({
      certificate: cert,
      receipt,
      transport,
      runOwnedLifecycle: async () => {
        row = { project_id: receipt.projectId, title: receipt.title, current_json: {} };
        throw new Error("primary failed");
      },
    });
    await expect(failure).rejects.toBeInstanceOf(AggregateError);
  });
});
