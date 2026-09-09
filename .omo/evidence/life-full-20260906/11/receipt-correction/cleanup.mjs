import assert from "node:assert/strict";
import { readFile, writeFile, readdir, rm, readlink, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
const root = process.cwd(), out = new URL("./", import.meta.url);
assert.equal(root,"/home/main/z-project/rpg-zzu-life-full-housing-receipts");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const files = ["src/project/lifeRecovery.ts","src/project/spatialPlacementTransactions.ts","test/spatialPaymentReceipts.test.ts","openwiki/runtime-project-schema.md"];
const sourceHashes = Object.fromEntries(await Promise.all(files.map(async file => [file,sha(await readFile(file))])));
const parent = "/home/main/z-project/rpg-zzu-life-full-p4/.omo/evidence/life-full-20260906/phase4-parent";
const provenance = {};
for (const name of ["payment-capacity-probe.mjs","payment-capacity-red.json"]) {
  const current = sha(await readFile(join(parent,name))), copied = sha(await readFile(new URL(name,out)));
  assert.equal(current,copied); provenance[name] = current;
}
const buildArtifacts = {};
for (const file of ["dist/export-player/player-manifest.json","dist/export-player/player.js","dist/standalone-player/standalone.js"]) buildArtifacts[file] = sha(await readFile(file));
assert.equal(await readlink("dist"),"/dev/shm/st_01a0786a-receipt-qa/dist");
await rm("dist");
await rm("/dev/shm/st_01a0786a-receipt-qa",{recursive:true,force:true});
for (const name of ["cache","node_modules"]) await rm(new URL(name,out),{recursive:true,force:true});
const portReleased = await new Promise((resolve,reject) => {
  const server=createServer();server.once("error",reject);server.listen(39921,"127.0.0.1",()=>server.close(error=>error?reject(error):resolve(true)));
});
const exists = async path => { try { await lstat(path); return true; } catch(error) { if(error.code === "ENOENT") return false; throw error; } };
assert.equal(await exists("dist"),false);
assert.equal(await exists("/dev/shm/st_01a0786a-receipt-qa"),false);
const native=JSON.parse(await readFile(new URL("native-verified/public-lifecycle.json",out),"utf8"));
assert.equal(native.pass,true);assert.equal(native.receiptRecovery.cleaned,true);
const report={root,base:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),branch:execFileSync("git",["branch","--show-current"],{encoding:"utf8"}).trim(),sourceHashes,parentProvenanceUnchanged:provenance,buildArtifacts,cleanup:{port39921Released:portReleased,distRemoved:true,ownedTmpfsRemoved:true,ownedCacheAndConfigTempRemoved:true,native:native.cleanup,nativeStorageKeyRemoved:true,sharedCleanup:false},sourceDiff:execFileSync("git",["diff","--stat"],{encoding:"utf8"})};
await writeFile(new URL("identity-cleanup.json",out),JSON.stringify(report,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify(report,null,2));
