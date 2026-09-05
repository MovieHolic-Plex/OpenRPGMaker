import fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { createServer as createNetServer } from "node:net";

const out = "output/evidence/stone-hearth";
const port = await new Promise((resolve,reject) => {
  const probe = createNetServer();
  probe.on("error",reject);
  probe.listen(0,"127.0.0.1",() => {
    const port = probe.address().port;
    probe.close(() => resolve(port));
  });
});
const vite = await createServer({
  configFile:"vite.player-qa.config.ts",configLoader:"runner",cacheDir:`${out}/.vite-qa`,
  server:{host:"127.0.0.1",port,strictPort:true},logLevel:"warn",
});
await vite.listen();
const url = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({headless:true,args:["--no-sandbox","--use-gl=swiftshader","--disable-gpu"]});
const page = await browser.newPage({viewport:{width:1280,height:960}});
const errors = [];
page.on("pageerror",error=>errors.push(error.message));
try {
  await page.route(`${url}/**`,async route=>{
    const response = await fetch(route.request().url());
    await route.fulfill({status:response.status,contentType:response.headers.get("content-type")??"application/octet-stream",body:Buffer.from(await response.arrayBuffer())});
  });
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = {projectUrl:"/output/evidence/stone-hearth/qa-project.json",qaInstrumentation:true,saveNamespace:"stone-hearth-qa"};
    // Capture the real game instance, without replacing its renderer or animation manager.
    let phaser;
    Object.defineProperty(window,"Phaser",{
      configurable:true,
      get(){return phaser;},
      set(value){
        phaser=value;
        const Game=value.Game;
        value.Game=class extends Game {
          constructor(config){super(config);window.__hearthGame=this;}
        };
      },
    });
  });
  await page.goto(`${url}/player.html`,{waitUntil:"domcontentloaded"});
  await page.getByTestId("title-new-game").waitFor({state:"visible",timeout:120000});
  await page.keyboard.press("Enter");
  await page.getByTestId("runtime-state-json").waitFor({state:"attached",timeout:120000});
  const initial = await page.evaluate(() => {
    const scene=window.__hearthGame.scene.getScenes(true)[0];
    const all=[];
    const collect=object=>{
      all.push(object);
      for(const child of object.list??[])collect(child);
    };
    for(const object of scene.children.list)collect(object);
    const key="tex_easyrpg_chipset_interior:chipset_waterfall_124_4fps";
    const fire=all.find(object=>object.anims?.currentAnim?.key===key);
    const cold=all.find(object=>object.frame?.name==="tile_463");
    if(!fire||!cold)throw new Error("Real animated fire or cold hearth missing");
    window.__hearthFire=fire;
    window.__hearthCold=cold;
    fire.anims.pause();
    return {key,texture:fire.texture.key,coldFrame:cold.frame.name,coldAnimating:Boolean(cold.anims?.isPlaying)};
  });
  assert.equal(initial.coldAnimating,false);
  const frames=[];
  for(const target of [124,154,184,214]){
    const observed=await page.evaluate(target=>new Promise((resolve,reject)=>{
      const sprite=window.__hearthFire;
      const finish=()=>{
        if(sprite.frame.name!==`tile_${target}`)return;
        sprite.anims.pause();
        sprite.off("animationupdate",finish);
        clearTimeout(timer);
        resolve({frame:sprite.frame.name,coldFrame:window.__hearthCold.frame.name});
      };
      const timer=setTimeout(()=>{sprite.off("animationupdate",finish);reject(new Error(`Frame ${target} missing`));},5000);
      sprite.on("animationupdate",finish);
      sprite.anims.resume();
      finish();
    }),target);
    assert.equal(observed.frame,`tile_${target}`);
    assert.equal(observed.coldFrame,"tile_463");
    await page.screenshot({path:`${out}/fire-${target}.png`});
    frames.push(observed.frame);
  }
  await page.evaluate(()=>window.__hearthFire.anims.resume());
  assert.deepEqual(errors,[]);
  const proof={passed:true,surface:"player.html",...initial,frames,frameRate:4,mapMutation:false,errors};
  fs.writeFileSync(`${out}/animation-proof.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify(proof));
} catch(error){
  console.error(JSON.stringify({errors,body:(await page.locator("body").innerText()).slice(0,1200)}));
  await page.screenshot({path:`${out}/qa-failure.png`});
  throw error;
} finally {
  await page.unrouteAll({behavior:"wait"});
  await browser.close();
  await vite.close();
}
