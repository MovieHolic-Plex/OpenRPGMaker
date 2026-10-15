import { gen1CaptureProbability, attemptGen1Capture } from "../../../src/battle/gen1/capture";
const balls = ["poke","great","ultra","master"] as const;
const rows: string[] = [];
for (const catchRate of [45, 120, 255]) {
 for (const [label,cur] of [["full",100],["half",50],["1hp",1]] as const) {
  for (const st of [undefined,"poison","sleep"] as const) {
   const cells = balls.map(b => (gen1CaptureProbability({ballClass:b,maxHp:100,currentHp:cur,catchRate,majorStatus:st as any}).value*100).toFixed(1)+"%");
   rows.push(`cr=${catchRate} hp=${label} status=${st??"none"} | poke ${cells[0]} great ${cells[1]} ultra ${cells[2]} master ${cells[3]}`);
  }
 }
}
console.log(rows.join("\n"));
console.log("trainer:", gen1CaptureProbability({ballClass:"master",maxHp:100,currentHp:1,catchRate:255,trainerBattle:true}).value);
// Monte-carlo sanity against analytic
let seed=12345; const nb=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return (seed>>>8)&255;};
for (const [cr,cur,st] of [[45,100,undefined],[45,1,"sleep"],[255,50,undefined]] as const){
 let c=0;const N=200000;for(let i=0;i<N;i++){ if(attemptGen1Capture({ballClass:"poke",maxHp:100,currentHp:cur,catchRate:cr,majorStatus:st as any},nb).caught)c++; }
 console.log(`MC poke cr=${cr} cur=${cur} st=${st}: ${(c/N*100).toFixed(2)}% vs analytic ${(gen1CaptureProbability({ballClass:"poke",maxHp:100,currentHp:cur,catchRate:cr,majorStatus:st as any}).value*100).toFixed(2)}%`);
}
console.log(attemptGen1Capture({ballClass:"poke",maxHp:100,currentHp:1,catchRate:45},nb));
