import { buildStandaloneHtml, inlineCssAssetUrls } from "./standaloneHtml";
import { inventoryEntries } from "./gameRelease";
import { sha256HexText } from "../util/sha256";
import { assetDataUrl, encodeBase64, loadPublicationRuntime, publicationAssetEntries } from "./publicationExport";
import type { FetchBytes } from "./playerDeploymentTypes";
import type { PreparedWebExport } from "./webExportTypes";

export async function buildStandaloneRelease(prepared: PreparedWebExport, fetchBytes: FetchBytes): Promise<string> {
  const archive = await loadPublicationRuntime(prepared, fetchBytes);
  const assets = await publicationAssetEntries(prepared, archive);
  const inlineAssets = Object.fromEntries(assets.map(entry => [entry.name, assetDataUrl(entry)]));
  const script = await archive.read("standalone/standalone.js");
  const rawCss = await archive.read("standalone/standalone.css");
  const { css, missing } = await inlineCssAssetUrls(new TextDecoder().decode(rawCss), inlineAssets, async path => {
    const entry = { name: path, bytes: await archive.read(`public/${path}`) };

    return assetDataUrl(entry);
  });
  if (missing.length || /@import\b|url\(\s*["']?(?:https?:|\/\/)/i.test(css)) throw new Error("Standalone CSS dependency unavailable");
  const payloads = { "standalone.js": encodeBase64(script), "standalone.css": encodeBase64(new TextEncoder().encode(css)),
    "project.json": encodeBase64(new TextEncoder().encode(prepared.projectJson)),
    "source/standalone.css": encodeBase64(rawCss),
    ...(archive.runtime.collectorVersion === 2 ? { "source/dependency-collector.js": encodeBase64(await archive.read("standalone/dependency-collector.js")) } : {}),
    "source/web-sdk.json": encodeBase64(await archive.read("web/sdk-manifest.json")),
    "source/standalone-sdk.json": encodeBase64(await archive.read("standalone/sdk-manifest.json")) };
  const files = await inventoryEntries([
    ...Object.entries(payloads).map(([name, value]) => ({ name, bytes: Uint8Array.from(atob(value), c => c.charCodeAt(0)) })),
    ...Object.entries(inlineAssets).map(([name, value]) => ({ name, bytes: Uint8Array.from(atob(value.split(",")[1]), c => c.charCodeAt(0)) })),
  ]);
  const body = { sentinel: "oprn/standalone-release", format: 1, publication: archive.publication,
    runtime: archive.runtime, files };
  const provenance = { ...body, releaseId: await sha256HexText(JSON.stringify(body)) };
  const html = buildStandaloneHtml({ title: prepared.project.meta.title, css: "", script: "", projectJson: "null", inlineAssets });
  return html.replace("<script></script>", `<script type="application/json" id="oprn-release-provenance">${JSON.stringify(provenance).replace(/</g, "\\u003c")}</script>
<script type="application/json" id="oprn-release-payloads">${JSON.stringify(payloads)}</script>
<script>${STANDALONE_VERIFIER}</script>`);
}

// Data stays inert until every decoded payload is verified. No network dependency.
const STANDALONE_VERIFIER = `(async()=>{try{
const node=id=>document.getElementById(id),decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const manifest=JSON.parse(node('oprn-release-provenance').textContent),payloads=JSON.parse(node('oprn-release-payloads').textContent),assets=JSON.parse(node('oprn-standalone-assets').textContent);
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),hashJson=value=>hash(new TextEncoder().encode(JSON.stringify(value)));
const {releaseId,...body}=manifest,runtime=manifest.runtime;
if(manifest.sentinel!=='oprn/standalone-release'||manifest.format!==1||await hashJson(body)!==releaseId)throw Error('release identity');
if(runtime.sentinel!=='oprn/runtime-archive'||runtime.format!==1||runtime.projectSchema!==4||![1,2].includes(runtime.collectorVersion)||JSON.stringify(runtime.saveSchemas)!=='[4,5,6]')throw Error('unsupported runtime');
if(runtime.capabilities!==undefined&&(!Array.isArray(runtime.capabilities)||!runtime.capabilities.every(c=>typeof c==='string'&&/^[a-z][a-z0-9-]*-v[1-9][0-9]*$/.test(c))||new Set(runtime.capabilities).size!==runtime.capabilities.length))throw Error('unsupported capabilities');
const {runtimeTarget,...runtimeBody}=runtime;if(await hashJson(runtimeBody)!==runtimeTarget||manifest.publication.runtimeTarget!==runtimeTarget)throw Error('runtime identity');
const required=['standalone.js','standalone.css','project.json','source/standalone.css','source/web-sdk.json','source/standalone-sdk.json'];
if(runtime.collectorVersion===2)required.push('source/dependency-collector.js');
if(required.some(name=>typeof payloads[name]!=='string'))throw Error('missing required payload');
const names=[...Object.keys(payloads),...Object.keys(assets)];if(new Set(names).size!==names.length||manifest.files.length!==names.length||new Set(manifest.files.map(f=>f.path)).size!==names.length)throw Error('payload inventory');
for(const file of manifest.files){if(!names.includes(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('file metadata');const value=payloads[file.path]??assets[file.path]?.split(',')[1];if(!value)throw Error('missing payload');const bytes=decode(value);if(bytes.length!==file.bytes||await hash(bytes)!==file.sha256)throw Error('integrity');}
for(const [local,original] of [['standalone.js','standalone/standalone.js'],['source/standalone.css','standalone/standalone.css'],['source/web-sdk.json','web/sdk-manifest.json'],['source/standalone-sdk.json','standalone/sdk-manifest.json']]){const actual=manifest.files.find(f=>f.path===local),proof=runtime.files.find(f=>f.path===original);if(!proof||actual.bytes!==proof.bytes||actual.sha256!==proof.sha256)throw Error('runtime provenance');}
for(const name of runtime.requiredAssets){const actual=manifest.files.find(f=>f.path===name),proof=runtime.files.find(f=>f.path==='public/'+name);if(!actual||!proof||actual.bytes!==proof.bytes||actual.sha256!==proof.sha256)throw Error('runtime asset closure');}
const text=key=>new TextDecoder().decode(decode(payloads[key]));node('oprn-standalone-project').textContent=text('project.json');
if(JSON.stringify(JSON.parse(text('project.json')).meta.publication)!==JSON.stringify(manifest.publication))throw Error('project identity');
if(runtime.collectorVersion===2){const actual=manifest.files.find(f=>f.path==='source/dependency-collector.js');for(const path of ['web/dependency-collector.js','standalone/dependency-collector.js']){const proof=runtime.files.find(f=>f.path===path);if(!proof||actual.bytes!==proof.bytes||actual.sha256!==proof.sha256)throw Error('collector provenance');}
const collect=new Function(text('source/dependency-collector.js')+';return OPRN_RELEASE_COLLECTOR.collectReleaseDependencies;')();for(const dep of collect(text('project.json'))){const actual=manifest.files.find(f=>f.path===dep.path);if(!actual)throw Error('project dependency');if(dep.dataUrl!==undefined){const bytes=decode(dep.dataUrl.split(',')[1]);if(actual.bytes!==bytes.length||actual.sha256!==await hash(bytes))throw Error('embedded dependency');}else{const proof=runtime.files.find(f=>f.path==='public/'+dep.path);if(!proof||actual.bytes!==proof.bytes||actual.sha256!==proof.sha256)throw Error('project dependency');}}}
const transformed=text('source/standalone.css').replace(/url\\(\\s*["']?(\\/?[^"')]+)["']?\\s*\\)/g,(whole,raw)=>{if(raw.startsWith('#')||raw.startsWith('data:'))return whole;const key=raw.replace(/^\\.?\\//,'').split('?')[0];if(!assets[key])throw Error('CSS dependency');return 'url("'+assets[key]+'")';});
if(transformed!==text('standalone.css'))throw Error('transformed CSS provenance');
const style=document.createElement('style');style.textContent=text('standalone.css');document.head.append(style);
const script=document.createElement('script');script.textContent=text('standalone.js');document.body.append(script);
}catch(error){document.getElementById('app').textContent='게임 파일 검증에 실패했습니다.';console.error('[release integrity]',error);}})();`;
