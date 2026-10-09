/** Original symbolic composition -> deterministic PCM. No network, audio device or provider. */
export const MUSIC_VOICES = ['pulse','pulse25','triangle','saw','flute','pad','bell','kick','snare','hat'] as const;
export type MusicVoice = typeof MUSIC_VOICES[number];
export type MusicNote = { beat: number; length: number; midi: number; velocity?: number };
export type MusicScore = { version:1; bpm:number; meter:3|4; bars:number; key:string; loop:boolean; seed:number;
  tracks:{id:string;voice:MusicVoice;gain:number;pan?:number;notes:MusicNote[]}[] };
export const MUSIC_SCORE_LIMITS = { bars:32, seconds:90, tracks:8, events:2048, voices:24, rate:22050 } as const;
const record = (v:unknown): Record<string,unknown> => { if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Music score object required');return v as Record<string,unknown>; };
const fields = (v:Record<string,unknown>,keys:string[]) => { if(Object.keys(v).some(k=>!keys.includes(k)))throw Error('Unsupported music score field'); };
const range = (v:unknown,lo:number,hi:number) => { if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`Music value ${lo}..${hi} required`);return v; };
export function validateMusicScore(value:unknown): asserts value is MusicScore {
  const s=record(value);fields(s,['version','bpm','meter','bars','key','loop','seed','tracks']);
  if(s.version!==1 || ![3,4].includes(s.meter as number) || typeof s.loop!=='boolean')throw Error('Music version1, meter3/4 and explicit loop required');
  range(s.bpm,45,200);range(s.bars,1,MUSIC_SCORE_LIMITS.bars);if(!Number.isInteger(s.bars))throw Error('Integer bars required');
  range(s.seed,0,4294967295);if(!Number.isInteger(s.seed))throw Error('Integer seed required');
  if(typeof s.key!=='string'||!s.key.trim()||s.key.length>60)throw Error('Authored key label required');
  const beats=(s.bars as number)*(s.meter as number),seconds=beats*60/(s.bpm as number);
  if(seconds>MUSIC_SCORE_LIMITS.seconds)throw Error('Music exceeds90 seconds');
  if(!Array.isArray(s.tracks)||!s.tracks.length||s.tracks.length>MUSIC_SCORE_LIMITS.tracks)throw Error('Music1..8 tracks required');
  const ids=new Set<string>(),edges:{at:number;delta:number}[]=[];let count=0;
  if(s.tracks.reduce((n,t)=>n+(Array.isArray(t?.notes)?t.notes.length:0),0)>MUSIC_SCORE_LIMITS.events)throw Error('Music exceeds2048 notes');
  for(const raw of s.tracks){const t=record(raw);fields(t,['id','voice','gain','pan','notes']);
    if(typeof t.id!=='string'||!t.id.trim()||t.id.length>80||ids.has(t.id))throw Error('Unique music track ids required');ids.add(t.id);
    if(!MUSIC_VOICES.includes(t.voice as MusicVoice))throw Error('Unsupported music voice');range(t.gain,0,1);if(t.pan!==undefined)range(t.pan,-1,1);
    if(!Array.isArray(t.notes)||!t.notes.length)throw Error('Nonempty note tracks required');
    for(const raw of t.notes){const n=record(raw);fields(n,['beat','length','midi','velocity']);range(n.beat,0,beats);range(n.length,.0625,beats);range(n.midi,24,96);
      if(!Number.isInteger(n.midi)||(n.beat as number)+(n.length as number)>beats+1e-8)throw Error('Music note outside piece');
      if(n.velocity!==undefined)range(n.velocity,0,1);
      if((t.gain as number)*(n.velocity as number??.8)>0){const start=n.beat as number, drum=['kick','snare','hat'].includes(String(t.voice));
        const tail=drum?0:(t.voice==='pad'?.14:.07)*(s.bpm as number)/60;
        const end=start+(n.length as number)*(drum?1:.88)+tail;
        edges.push({at:start,delta:1},{at:Math.min(end,beats),delta:-1});
        if(s.loop&&end>beats)edges.push({at:0,delta:1},{at:end-beats,delta:-1});count++;}
    }
  }
  const events=(s.tracks as {notes:unknown[]}[]).reduce((n,t)=>n+t.notes.length,0);if(events>MUSIC_SCORE_LIMITS.events||!count)throw Error('Music requires audible events and at most2048 notes');
  let voices=0;for(const e of edges.sort((a,b)=>a.at-b.at||a.delta-b.delta)){voices+=e.delta;if(voices>MUSIC_SCORE_LIMITS.voices)throw Error('Music polyphony exceeds24 voices');}
}
function table(voice:MusicVoice,midi:number,rate:number):Float32Array {
  const out=new Float32Array(1024),freq=440*2**((midi-69)/12),harmonics=Math.min(15,Math.floor(rate*.43/freq));
  for(let i=0;i<out.length;i++){const phase=i/out.length*Math.PI*2;let v=0;
    for(let h=1;h<=harmonics;h++){
      if(voice==='triangle'){if(h%2)v+=((-1)**((h-1)/2))*Math.sin(h*phase)/(h*h);}
      else if(voice==='saw')v+=Math.sin(h*phase)/h;
      else if(voice==='pulse'||voice==='pulse25')v+=Math.sin(Math.PI*h*(voice==='pulse25'?.25:.5))*Math.cos(h*phase)/h;
      else if(h===1)v+=Math.sin(phase)*.83;
      else if(h===3)v+=Math.sin(3*phase)*(voice==='pad'?.12:.17);
    }out[i]=v;
  }return out;
}
export function renderMusicScore(score:MusicScore):{bytes:Uint8Array;measurements:{renderer:string;seconds:number;frames:number;channels:number;sampleRate:number;peak:number;rms:number;joinStep:number;loop:boolean;tracks:number;events:number}} {
  validateMusicScore(score);const rate=MUSIC_SCORE_LIMITS.rate,seconds=score.bars*score.meter*60/score.bpm,frames=Math.round(seconds*rate);
  const left=new Float32Array(frames),right=new Float32Array(frames),tables=new Map<string,Float32Array>();let rng=score.seed||1;
  const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296*2-1;};
  for(const track of score.tracks){if(track.gain===0)continue;const pan=track.pan??0,gainL=Math.sqrt((1-pan)/2)*track.gain,gainR=Math.sqrt((1+pan)/2)*track.gain;
    for(const note of track.notes){if(note.velocity===0)continue;const drum=['kick','snare','hat'].includes(track.voice),start=Math.round(note.beat*60/score.bpm*rate),held=note.length*60/score.bpm*(drum?1:.88),release=drum?0:track.voice==='pad'?.14:.07;
      const duration=drum?Math.min(held,track.voice==='kick'?.22:track.voice==='snare'?.14:.06):held+release;
      const length=Math.round(duration*rate),frequency=440*2**((note.midi-69)/12),velocity=note.velocity??.8;
      const key=track.voice+':'+note.midi;let wav=tables.get(key);if(!drum&&!wav){wav=table(track.voice,note.midi,rate);tables.set(key,wav);}
      let lastNoise=0;
      for(let j=0;j<length;j++){let index=start+j;if(index>=frames){if(score.loop)index%=frames;else break;}const time=j/rate;let v;
        if(track.voice==='kick')v=Math.sin(2*Math.PI*(48*time+85*.024*(1-Math.exp(-time/.024))))*Math.exp(-time*25);
        else if(drum){const noise=random();v=(noise-lastNoise*.65)*Math.exp(-time*(track.voice==='hat'?75:24));lastNoise=noise;}
        else {const phase=(time*frequency*1024)%1024,at=Math.floor(phase),f=phase-at;
          v=wav![at]*(1-f)+wav![(at+1)%1024]*f;
          if(track.voice==='bell')v=Math.sin(2*Math.PI*frequency*time+1.5*Math.sin(4*Math.PI*frequency*time)*Math.exp(-time*5))*Math.exp(-time*2.5);
          const attack=track.voice==='pad'?.06:track.voice==='flute'?.018:.007;
          const envelope=Math.min(1,time/attack)*Math.min(1,Math.max(0,(held+release-time)/release));v*=envelope;
        }
        if(drum)v*=Math.min(1,time/.003)*Math.min(1,(length-1-j)/(rate*.006));
        left[index]+=v*velocity*gainL;right[index]+=v*velocity*gainR;
      }
    }
  }
  // One-shot pieces end quietly; loops retain periodic release tails at their beginning.
  if(!score.loop){const fade=Math.min(frames,Math.round(.06*rate));for(let j=0;j<fade;j++){const gain=(fade-1-j)/fade;left[frames-fade+j]*=gain;right[frames-fade+j]*=gain;}}
  let peak=0;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const scale=peak>.001?.78/peak:1;
  const bytes=new Uint8Array(44+frames*4),view=new DataView(bytes.buffer);const ascii=(offset:number,s:string)=>{for(let i=0;i<s.length;i++)bytes[offset+i]=s.charCodeAt(i);};
  ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,frames*4,true);
  let sum=0;for(let i=0;i<frames;i++){const l=left[i]*scale,r=right[i]*scale;sum+=l*l+r*r;view.setInt16(44+i*4,Math.round(l*32767),true);view.setInt16(46+i*4,Math.round(r*32767),true);}
  return {bytes,measurements:{renderer:'oprn-symbolic-1',seconds:frames/rate,frames,channels:2,sampleRate:rate,peak:peak*scale,rms:Math.sqrt(sum/(frames*2)),joinStep:Math.max(Math.abs(left[0]-left[frames-1]),Math.abs(right[0]-right[frames-1]))*scale,loop:score.loop,tracks:score.tracks.length,events:score.tracks.reduce((n,t)=>n+t.notes.length,0)}};
}
export function musicDataUrl(bytes:Uint8Array):string { let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));return 'data:audio/wav;base64,'+btoa(binary); }
