import { nextSessionRandom } from "@/project/session";
const rollRandomEncounter = (s: any, acc: number) => acc >= 1000 || nextSessionRandom(s, "encounter") * 1000 < acc; // copy of playSceneMovement.ts:1050 (module imports Phaser)
import { scaledEncounterRate } from "@/project/terrainStep";
const session: any = { switches: {}, variables: {} };
function trial(rate: number) { let acc = 0, n = 0; while (true) { n++; acc += rate; if (rollRandomEncounter(session, acc)) return n; } }
for (const rate of [14, 20, 30, 100]) {
  const N = 20000; const xs: number[] = []; for (let i = 0; i < N; i++) xs.push(trial(rate));
  xs.sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / N;
  console.log(`rate ${rate}: mean steps/encounter ${mean.toFixed(1)} min ${xs[0]} p10 ${xs[N*0.1|0]} median ${xs[N>>1]} p90 ${xs[N*0.9|0]} max ${xs[N-1]}`);
}
console.log("scaledEncounterRate(20, 50%)=", scaledEncounterRate(20, 50));
