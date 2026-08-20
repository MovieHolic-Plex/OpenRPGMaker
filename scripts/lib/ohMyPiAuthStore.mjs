// Disk auth for oh-my-pi providers. Tokens/keys stay on the machine, never in the browser.
// Path: $RPG_ZZU_OH_MY_PI_AUTH_PATH or ~/.rpg-zzu/oh-my-pi-auth.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export function defaultOhMyPiAuthPath() {
  return process.env.RPG_ZZU_OH_MY_PI_AUTH_PATH
    || join(homedir(), ".rpg-zzu", "oh-my-pi-auth.json");
}

function emptyDoc() {
  return { version: 1, providers: {} };
}

function readDoc(path) {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!raw || typeof raw !== "object") return emptyDoc();
    const providers = raw.providers && typeof raw.providers === "object" ? raw.providers : {};
    return { version: 1, providers };
  } catch {
    return emptyDoc();
  }
}

function writeDoc(path, doc) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

export function createOhMyPiAuthStore(filePath = defaultOhMyPiAuthPath()) {
  const load = () => readDoc(filePath);
  const save = (doc) => writeDoc(filePath, doc);

  return {
    path: filePath,
    has(provider) {
      return Boolean(load().providers[provider]);
    },
    get(provider) {
      const row = load().providers[provider];
      return row && typeof row === "object" ? row : undefined;
    },
    setApiKey(provider, apiKey) {
      const doc = load();
      doc.providers[provider] = { kind: "apiKey", apiKey: String(apiKey) };
      save(doc);
    },
    setOAuth(provider, creds) {
      const doc = load();
      doc.providers[provider] = {
        kind: "oauth",
        access: String(creds.access ?? ""),
        refresh: String(creds.refresh ?? ""),
        expires: Number(creds.expires) || 0,
        enterpriseUrl: creds.enterpriseUrl,
        projectId: creds.projectId,
        email: creds.email,
        accountId: creds.accountId,
        apiEndpoint: creds.apiEndpoint,
        orgId: creds.orgId,
        orgName: creds.orgName,
        authorizedAt: creds.authorizedAt,
      };
      save(doc);
    },
    isExpired(provider) {
      const row = this.get(provider);
      if (!row || row.kind !== "oauth") return false;
      return Date.now() >= Number(row.expires || 0);
    },
    publicStatus(provider) {
      const row = this.get(provider);
      if (!row) return { connected: false, provider };
      if (row.kind === "apiKey") return { connected: Boolean(row.apiKey), provider, authKind: "apiKey" };
      const expired = Date.now() >= Number(row.expires || 0);
      return {
        connected: !expired && Boolean(row.access || row.refresh),
        provider,
        authKind: "oauth",
        planType: row.orgName,
        expired,
      };
    },
  };
}

export const ohMyPiAuthStore = createOhMyPiAuthStore();
