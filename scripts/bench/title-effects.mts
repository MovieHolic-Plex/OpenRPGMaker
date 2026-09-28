/** Isolated real-renderer SwiftShader differential/benchmark; no editor or project storage.
 * Start player QA server first (PLAYER_QA_URL, default port 9944).
 * Run: npx tsx --tsconfig tsconfig.app.json scripts/bench/title-effects.mts
 */
import { build } from "esbuild";
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadavg } from "node:os";

const root = process.cwd();
const bundle = await build({
  stdin: { contents: `
    import * as current from "${process.env.TITLE_EFFECT_BENCH_IMPLEMENTATION === "legacy" ? "./test/fixtures/titleEffects/legacyRenderer" : "./src/player/titleEffects/renderer"}";
    import * as legacy from "./test/fixtures/titleEffects/legacyRenderer";
    window.renderers = {current, legacy};
  `, resolveDir: root },
  bundle: true, write: false, format: "iife", platform: "browser",
  tsconfig: resolve(root, "tsconfig.app.json"),
});
const browser = await chromium.launch({ headless: true, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const errors: string[] = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", e => { if (e.type() === "warning" || e.type() === "error") errors.push(e.text()); });
try {
  await page.goto(process.env.PLAYER_QA_URL ?? "http://127.0.0.1:9944/player.html", {waitUntil:"networkidle"});
  // Linux netlink changes can cancel localhost module requests. Retry only this transport failure.
  for(let attempt=0;attempt<2 && errors.some(e=>e.includes("ERR_NETWORK_CHANGED"));attempt++) {
    errors.length=0;
    await page.reload({waitUntil:"networkidle"});
  }
  await page.addStyleTag({content: "canvas {width:320px;height:240px}"});
  await page.addScriptTag({ content: 'window.__name = (fn) => fn;\n' + bundle.outputFiles[0]!.text });
  const effects = JSON.parse(readFileSync(resolve(root, "verify-shots/title-opening/art/forestMorning.effects.json"), "utf8")).effects;
  const result = await page.evaluate(async (effects) => {
    const drawStats = new WeakMap<WebGL2RenderingContext, {particle: number; color: number}>();
    const originalDraw = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function(...args) {
      const stats = drawStats.get(this) ?? {particle:0,color:0};
      if (this.getParameter(this.FRAMEBUFFER_BINDING)) stats.particle++; else stats.color++;
      drawStats.set(this,stats);
      return originalDraw.apply(this,args);
    };
    const nativeParameter = WebGL2RenderingContext.prototype.getParameter;
    let fullQuality = true;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {
      if (fullQuality && parameter === 0x9246) return "Hardware GPU quality test";
      return nativeParameter.call(this, parameter);
    };
    const {current, legacy} = (window as any).renderers;
    const source = document.createElement("canvas");
    source.width = 480; source.height = 270;
    const ctx = source.getContext("2d")!;
    // Nonuniform image exposes UV/refraction errors.
    for (let y = 0; y < 270; y++) {
      for (let x = 0; x < 480; x++) {
        ctx.fillStyle = `rgb(${40+x%130},${50+y%140},${70+(x+y)%100})`;
        ctx.fillRect(x,y,1,1);
      }
    }
    const imageUrl = source.toDataURL();
    const make = async (renderer: any, options: any) => {
      const canvas = renderer.createTitleEffectsCanvas({ imageUrl, effects, ...options });
      document.body.append(canvas);
      for (let i=0; i<1000 && canvas.dataset.titleEffectsRenderer === "pending"; i++)
        await new Promise(r=>setTimeout(r,10));
      if (canvas.dataset.titleEffectsRenderer !== "webgl") throw Error(JSON.stringify(canvas.dataset));
      return canvas as HTMLCanvasElement;
    };
    const read = (canvas: HTMLCanvasElement) => {
      const gl=canvas.getContext("webgl2")!;
      const pixels = new Uint8Array(canvas.width*canvas.height*4);
      gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if (gl.getError()) throw Error("WebGL error");
      if (!pixels.some((v,i)=>i%4!==3&&v>0)) throw Error("Empty frame");
      return pixels;
    };
    const release = (canvas: HTMLCanvasElement) => {
      current.stopTitleEffects(canvas); legacy.stopTitleEffects(canvas);
      canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    const comparisons: any[] = [];
    let gpu = "";
    const region = [[0.1,0.2],[0.9,0.2],[0.85,0.9],[0.1,0.8]];
    for (const fit of ["stretch","cover","contain"]) {
      for (const time of [0,1.25,17,123.456]) {
        const sets = [effects, [
          {kind:"motes",region,count:96,speed:4},
          {kind:"glow",source:[0.4,0.5]},
          {kind:"motes",source:[0.65,-0.05],toward:[0.45,0.75],count:96},
          {kind:"parallax",intensity:0.8}, ...effects.slice(0,7),
        ]];
        for (let set=0;set<sets.length;set++) {
          const opts={fit,freezeAtSec:time,effects:sets[set]};
          const a=await make(legacy,opts), b=await make(current,opts);
          // Force synchronous redraw immediately before readPixels (drawing buffer not preserved).
          legacy.updateTitleEffectsCanvas(a,sets[set]);
          const pa=read(a);
          const agl=a.getContext("webgl2")!;
          const debug=agl.getExtension("WEBGL_debug_renderer_info");
          gpu=debug ? nativeParameter.call(agl,debug.UNMASKED_RENDERER_WEBGL) : agl.getParameter(agl.RENDERER);
          current.updateTitleEffectsCanvas(b,sets[set]);
          const pb=read(b);
          const draws={...drawStats.get(b.getContext("webgl2")!)!};
          let max=0, changed=0, sum=0;
          for(let j=0;j<pa.length;j++){const d=Math.abs(pa[j]!-pb[j]!);max=Math.max(max,d);sum+=d;if(d)changed++;}
          comparisons.push({fit,time,set,max,changed,mean:sum/pa.length,draws});
          release(a);release(b);
        }
      }
    }
    // Compare full-resolution and automatic software-quality paths of the same current shader; readPixels waits for actual rendering (Chromium finish alone does not).
    const timings:any[]=[];
    // Exclude inspection overhead from timed draws.
    WebGL2RenderingContext.prototype.drawArrays = originalDraw;
    for (let round = 0; round < 3; round++) {
      const canvases = {
        full: await make(current, {freezeAtSec:1.25}),
        software: await (async () => { fullQuality=false; const c=await make(current,{freezeAtSec:1.25}); fullQuality=true; return c; })(),
      };
      const samples: Record<string, number[]> = {full:[], software:[]};
      for (let frame = 0; frame < 28; frame++) {
        // Pair adjacent measurements and alternate order to reduce shared-host drift.
        const order = (round + frame) % 2 ? ["software", "full"] : ["full", "software"];
        for (const name of order) {
          const renderer = current;
          const canvas = canvases[name as keyof typeof canvases];
          const started = performance.now();
          renderer.updateTitleEffectsCanvas(canvas, effects);
          read(canvas);
          if (frame >= 4) samples[name]!.push(performance.now() - started);
        }
      }
      for (const name of ["full", "software"]) {
        const times = samples[name]!.sort((a,b)=>a-b);
        timings.push({round,name,median:times[times.length>>1],p95:times[Math.floor(times.length*.95)]});
        release(canvases[name as keyof typeof canvases]);
      }
    }
    // Fixed/reduced motion and editor live update after resize.
    const c=await make(current,{freezeAtSec:0});
    c.style.width="257px";c.style.height="193px";
    current.updateTitleEffectsCanvas(c,[{kind:"motes",region,count:1}]);
    read(c);
    const resize={width:c.width,height:c.height,animated:c.dataset.titleEffectsAnimated};
    release(c);
    // Frozen depth + particle resources must be recreated after real context loss.
    const restored=await make(current,{freezeAtSec:1.25,depthUrl:imageUrl});
    await new Promise(r=>setTimeout(r,100));
    const updatedEffects=effects.map((e:any)=>({...e,intensity:0.45}));
    current.updateTitleEffectsCanvas(restored,updatedEffects);
    const before=read(restored);
    current.updateTitleEffectsCanvas(restored,effects);
    const restoreGl=restored.getContext("webgl2")!;
    const lose=restoreGl.getExtension("WEBGL_lose_context")!;
    let prevented=false;
    restored.addEventListener("webglcontextlost", e=>{prevented=e.defaultPrevented;});
    lose.loseContext();
    await new Promise(r=>setTimeout(r,100));
    const lostState=restored.dataset.titleEffectsRenderer;
    current.updateTitleEffectsCanvas(restored,updatedEffects);
    if(prevented) lose.restoreContext();
    for(let i=0;i<100 && restored.dataset.titleEffectsRenderer!=="webgl";i++) await new Promise(r=>setTimeout(r,20));
    await new Promise(r=>setTimeout(r,100));
    let restoredMax=255;
    if (!restoreGl.isContextLost()) {
      const activeProgram=restoreGl.getParameter(restoreGl.CURRENT_PROGRAM);
      if (Math.abs(restoreGl.getUniform(activeProgram,restoreGl.getUniformLocation(activeProgram,"uB"))[0]-0.45)>0.001) throw Error("Lost live uniform update");
      current.updateTitleEffectsCanvas(restored,updatedEffects);
      const after=read(restored);
      restoredMax=before.reduce((m,v,i)=>Math.max(m,Math.abs(v-after[i]!)),0);
    }
    const recovery={prevented,lostState,restoredMax,depth:restored.dataset.titleEffectsDepth};
    release(restored);
    fullQuality=false;
    const software=await make(current,{freezeAtSec:0});
    const softwareSize={width:software.width,height:software.height};
    release(software);
    fullQuality=true;
    const animated=await make(current,{});
    const gl=animated.getContext("webgl2")!;
    let animatedDraws=0;
    gl.drawArrays=function(...args) {animatedDraws++; return originalDraw.apply(this,args);};
    const animationLoss=gl.getExtension("WEBGL_lose_context")!;
    let animationPrevented=false;
    animated.addEventListener("webglcontextlost",e=>{animationPrevented=e.defaultPrevented;});
    animationLoss.loseContext();
    await new Promise(r=>setTimeout(r,100));
    const lossDraws=animatedDraws;
    await new Promise(r=>setTimeout(r,100));
    const quiet=animatedDraws===lossDraws;
    if(animationPrevented) animationLoss.restoreContext();
    for(let i=0;i<100&&animatedDraws===lossDraws;i++) await new Promise(r=>setTimeout(r,20));
    const animationRecovery={quiet,resumed:animatedDraws>lossDraws};
    animated.remove();
    await new Promise(r=>setTimeout(r,100));
    const detached=gl.isContextLost();
        const stopped= current.createTitleEffectsCanvas({imageUrl,effects});
    document.body.append(stopped);
    current.stopTitleEffects(stopped);
    await new Promise(r=>setTimeout(r,100));
    const stoppedBeforeLoad=stopped.dataset.titleEffectsRenderer!=="webgl" && !current.updateTitleEffectsCanvas(stopped,effects);
    stopped.remove();
    return {gpu,comparisons,timings,resize,detached,recovery,softwareSize,animationRecovery,stoppedBeforeLoad};
  }, effects);
  // Extension fallback and reduced-motion use the production renderer.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(async effects => {
    const proto=WebGL2RenderingContext.prototype;
    const original=proto.getExtension;
    proto.getExtension=function(name: string) { return name==="EXT_color_buffer_float"?null:original.call(this,name); };
    const r=(window as any).renderers.current;
    const canvas=r.createTitleEffectsCanvas({effects,imageUrl:"data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#789"/></svg>')});
    document.body.append(canvas);
    for(let i=0;i<1000&&canvas.dataset.titleEffectsRenderer==="pending";i++)await new Promise(r=>setTimeout(r,10));
    proto.getExtension=original;
    return {...canvas.dataset};
  },effects);
  const report={browser:browser.version(),loadavg:loadavg(),...result,reduced,errors};
  const output=process.env.TITLE_EFFECT_BENCH_OUTPUT ?? "/tmp/shader-results.json";
  writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if(result.comparisons.some(x=>x.max>1 || x.draws.particle!==2 || x.draws.color!==2)||!result.detached||reduced.titleEffectsAnimated!=="false"||errors.length)process.exitCode=1;
} finally { await browser.close(); }
