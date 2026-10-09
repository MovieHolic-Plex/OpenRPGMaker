// Original note-level composition. The renderer is a portable snapshot from OPRN.
import {renderMusicScore} from './lib/musicScore.ts';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=new URL('./site/assets/',import.meta.url);await mkdir(out,{recursive:true});
// Authored 16-bar phrases: [quarter-note onset within bar, MIDI, length].
const townLead=[
 [[0,74,.75],[1,78,.5],[2,81,1.5]], [[.5,79,.5],[1.5,78,.5],[2.5,76,1]],
 [[0,74,.5],[1,78,.75],[2.5,81,.5],[3.25,83,.5]], [[0,81,1],[1.5,76,.5],[2.5,73,1]],
 [[0,74,.75],[1,78,.5],[2,81,.75],[3,86,.5]], [[0,85,1],[1.5,81,.5],[2.5,78,1]],
 [[0,79,.75],[1,78,.5],[2,76,.75],[3,74,.5]], [[0,73,1],[2,76,.5],[3,81,.5]],
 [[0,83,.75],[1,81,.5],[2,78,1]], [[0,79,.75],[1,83,.5],[2,86,1]],
 [[0,85,.75],[1,81,.5],[2,78,.75],[3,76,.5]], [[0,76,1.5],[2.5,73,.75]],
 [[0,74,.5],[.75,78,.5],[1.5,79,1],[3,83,.5]], [[0,81,.75],[1,79,.5],[2,76,1]],
 [[0,74,1],[1.5,76,.5],[2.5,73,.5]], [[0,73,1.25],[2.5,69,.5],[3.25,73,.5]],
];
const routeLead=[
 [[0,74,.5],[.75,78,.25],[1,81,.5],[2,78,.5],[3,76,.5]], [[0,74,.5],[1,79,.5],[2,83,.75],[3,81,.5]],
 [[0,78,.5],[.75,81,.25],[1,86,.75],[2.5,85,.5],[3.25,81,.5]], [[0,83,.5],[1,81,.5],[2,76,1]],
 [[0,74,.5],[.75,78,.25],[1,81,.5],[2,86,.5],[3,85,.5]], [[0,83,.75],[1,79,.5],[2,78,.5],[3,74,.5]],
 [[0,76,.5],[1,79,.5],[2,83,.75],[3,81,.5]], [[0,80,.5],[1,81,.5],[2,85,.5],[3,81,.5]],
 [[0,83,.5],[.75,86,.25],[1,90,.75],[2.5,88,.5],[3.25,86,.5]], [[0,83,.5],[1,79,.5],[2,83,.5],[3,86,.5]],
 [[0,85,.75],[1,81,.5],[2,78,.5],[3,81,.5]], [[0,83,.5],[1,81,.5],[2,76,1]],
 [[0,79,.5],[.75,81,.25],[1,83,.75],[2.5,79,.5]], [[0,78,.5],[1,76,.5],[2,74,.75],[3,71,.5]],
 [[0,76,.5],[1,79,.5],[2,81,.75],[3,85,.5]], [[0,81,1],[1.5,76,.5],[2.5,73,.5],[3.25,69,.5]],
];
const chords=[[50,62,66,69],[43,59,62,67],[47,59,62,66],[45,61,64,69],
 [50,62,66,69],[42,57,61,66],[40,59,64,67],[45,61,64,69],
 [47,59,62,66],[43,59,62,67],[50,62,66,69],[45,61,64,69],
 [43,59,62,67],[40,59,64,67],[45,62,64,69],[45,61,64,69]];
const n=(beat,midi,length,velocity=.7)=>({beat,midi,length,velocity});
function score(id){
 const route=id==='route';const tracks=[
  {id:'melody',voice:'flute',gain:.30,pan:-.1,notes:[]},
  {id:'answer',voice:'bell',gain:.14,pan:.2,notes:[]},
  {id:'bass',voice:'triangle',gain:.27,pan:0,notes:[]},
  {id:'chord',voice:'pulse25',gain:.075,pan:-.24,notes:[]},
  {id:'arp',voice:'bell',gain:.10,pan:.25,notes:[]},
  {id:'kick',voice:'kick',gain:route?.15:.075,notes:[]},
  {id:'snare',voice:'snare',gain:route?.085:.025,notes:[]},
  {id:'hat',voice:'hat',gain:route?.038:.016,pan:.15,notes:[]},
 ];
 for(let bar=0;bar<16;bar++){
  const t=bar*4,c=chords[bar];for(const [at,midi,len] of (route?routeLead:townLead)[bar])tracks[0].notes.push(n(t+at,midi,len));
  for(const at of [0,2])tracks[2].notes.push(n(t+at,at===0?c[0]:c[0]+7,route?.65:1.3,at===0?.8:.65));
  for(const at of [1,3])for(const m of c.slice(1))tracks[3].notes.push(n(t+at,m,.45,.55));
  // The answer only fills the main phrase's rests; it is not continuous doubling.
  if(bar%4===3){tracks[1].notes.push(n(t+1.25,c[2]+12,.25,.4),n(t+1.75,c[3]+12,.25,.45));}
  for(const [j,at] of [.5,1.5,2.5,3.5].entries())tracks[4].notes.push(n(t+at,c[1+j%3]+12,.25,.35));
  for(const at of [0,2])tracks[5].notes.push(n(t+at,36,.125,.7));
  for(const at of [1,3])tracks[6].notes.push(n(t+at,48,.125,.5));
  for(const at of [.5,1.5,2.5,3.5])tracks[7].notes.push(n(t+at,84,.125,.45));
 }
 return {version:1,bpm:route?124:88,meter:4,bars:16,key:'D major — original snow-path motif',loop:true,seed:route?105124:105088,tracks};
}
const manifest={version:1,modelHeardAudio:false,tracks:[],cues:[]};
for(const id of ['town','route']){
 const s=score(id),r=renderMusicScore(s);if(r.measurements.peak>.8||r.measurements.joinStep>.02)throw Error('Unsafe PCM or discontinuous loop');
 await writeFile(new URL(id+'.wav',out),r.bytes);await writeFile(new URL(id+'-score.json',out),JSON.stringify(s,null,2)+'\n');
 manifest.tracks.push({id,name:id==='town'?'눈길의 작은 약속':'숲 너머로 한 걸음',...r.measurements,sha256:createHash('sha256').update(r.bytes).digest('hex')});
}
// Short original SE: same timbre, separate rising/falling contours, quiet fixed peaks.
for(const [id,notes] of Object.entries({cursor:[[0,81,.125]],confirm:[[0,74,.125],[.2,81,.25]],cancel:[[0,76,.125],[.2,69,.25]]})){
 const s={version:1,bpm:200,meter:4,bars:1,key:'D major',loop:false,seed:1,tracks:[{id,voice:'pulse25',gain:.2,notes:notes.map(([b,m,l])=>n(b,m,l))}]};
 const rendered=renderMusicScore(s);const samples=Math.round((id==='cursor'?.13:.24)*22050),bytes=rendered.bytes.slice(0,44+samples*4),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 v.setUint32(4,bytes.length-8,true);v.setUint32(40,bytes.length-44,true);
 // Render normalization is for music. Menu cues use an intentionally quieter fixed mix.
 let peak=0;for(let i=44;i<bytes.length;i+=2){const f=Math.round(v.getInt16(i,true)*.3);v.setInt16(i,f,true);peak=Math.max(peak,Math.abs(f)/32768);}
 await writeFile(new URL(id+'.wav',out),bytes);await writeFile(new URL(id+'-score.json',out),JSON.stringify(s,null,2)+'\n');
 manifest.cues.push({id,seconds:samples/22050,peak,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(new URL('audio.json',out),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
