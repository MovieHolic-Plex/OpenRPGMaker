// scripts/lib/canonical-project-digest.mjs
// Pure, deterministic canonical serialization + content digest for the horror browser QA.
//
// This is the "same data, same digest" contract between the Node-side Supabase reload and the
// in-browser project state. `stableProjectSerialize` sorts object keys recursively and emits a
// canonical JSON string, so key order in the source object never changes the digest. The browser
// side replicates the same canonical string and hashes it with crypto.subtle (SHA-256); the
// Node side uses this module. A mismatch — derived independently from actual project data on each
// side — must fail the browser capture.

import { createHash } from "node:crypto";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Deterministic canonical JSON string. Keys are recursively sorted; primitives are emitted
 * directly. This must stay byte-for-byte identical to the browser-side implementation so both
 * sides derive the same digest from the same project content.
 */
export function stableProjectSerialize(value, indent = 0) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((entry) => stableProjectSerialize(entry, indent + 1));
    return `[\n${items.map((item) => `${"  ".repeat(indent + 1)}${item}`).join(",\n")}\n${"  ".repeat(indent)}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    if (keys.length === 0) return "{}";
    const entries = keys.map((key) => {
      const serialized = stableProjectSerialize(value[key], indent + 1);
      return `${"  ".repeat(indent + 1)}${JSON.stringify(key)}: ${serialized}`;
    });
    return `{\n${entries.join(",\n")}\n${"  ".repeat(indent)}}`;
  }
  if (typeof value === "string") return JSON.stringify(value);
  return String(value);
}

/** SHA-256 hex digest of the canonical project serialization. */
export function canonicalProjectDigest(project) {
  return createHash("sha256").update(stableProjectSerialize(project), "utf8").digest("hex");
}

/**
 * A self-contained JS expression string the browser can evaluate to compute the SAME canonical
 * digest from the in-page project object, using crypto.subtle (SHA-256). This keeps the
 * browser side independent — it runs actual code, not a value copied from Node.
 *
 * Usage from the capture: evaluate it as a function bound to window, then call it on the
 * live project snapshot. Must produce the identical 64-hex string as `canonicalProjectDigest`.
 */
export const browserCanonicalDigestSource = `(async function(project){
  var isPO=function(v){return v!==null&&typeof v==="object"&&!Array.isArray(v);};
  var ser=function(v,ind){ind=ind||0;
    if(Array.isArray(v)){if(v.length===0)return"[]";
      var its=v.map(function(e){return ser(e,ind+1);});
      return"[\\n"+its.map(function(it){return"  ".repeat(ind+1)+it;}).join(",\\n")+"\\n"+"  ".repeat(ind)+"]";}
    if(isPO(v)){var ks=Object.keys(v).sort();if(ks.length===0)return"{}";
      var en=ks.map(function(k){return"  ".repeat(ind+1)+JSON.stringify(k)+": "+ser(v[k],ind+1);});
      return"{\\n"+en.join(",\\n")+"\\n"+"  ".repeat(ind)+"}";}
    if(typeof v==="string")return JSON.stringify(v);return String(v);};
  var bytes=new TextEncoder().encode(ser(project));
  var buf=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
})`;

/**
 * Execute the self-contained digest function in a browser-like evaluator. Both the project and
 * function source are explicit serialized arguments; the evaluated callback has no Node closure.
 */
export async function evaluateBrowserCanonicalDigest(project, evaluate) {
  return await evaluate(
    async ({ project: browserProject, source }) => {
      const digest = new Function(`return (${source})`)();
      return await digest(browserProject);
    },
    { project, source: browserCanonicalDigestSource },
  );
}
