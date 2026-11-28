// Offline CCA enum-preservation audit (google-antigravity OAuth disabled 2026-11-28).
import assert from "node:assert/strict";
import { antigravityToolEnumPayload, ToolSchemaTransportError } from "../lib/ohMyPiToolEnums.ts";

for (const leaf of [
  { type: "integer", enum: [1, null] },
  { type: ["integer", "null"], enum: [1, 2] },
  { type: ["integer", "null"], enum: [1, 1, null] },
  { type: ["integer", "null"], enum: [1, 1.5, null] },
  { type: ["integer", "null"], enum: [null] },
]) {
  assert.throws(() => antigravityToolEnumPayload("offline", [{ name: "invalid", parameters: { type: "object", properties: { level: leaf } } }]), ToolSchemaTransportError);
}
console.log(JSON.stringify({ ok: true, malformedSchemasRejected: 5 }));
