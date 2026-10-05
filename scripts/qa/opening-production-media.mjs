// Derivatives of the continuous native browser recording, preserving real playback speed.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const out = resolve(process.env.LIVE_GAME_OUT ?? 'verify-shots/opening-production');
const p = JSON.parse(readFileSync(out + '/gameplay.json', 'utf8'));
if (!p.passed) throw Error('Canonical shipping walkthrough must pass');
const start = Math.max(0, p.recordingTimeline.find(s => s.shot === '01-title.png').atSec - 3);
const end = p.recordingTimeline.find(s => s.shot === '08-field.png').atSec + 3;
const delay = Math.round(p.nativeAudioStartedAt - p.nativeVideoRecordingStartedAt);
const crop = `crop=${Math.round(p.stageBox.width)}:${Math.round(p.stageBox.height)}:${Math.round(p.stageBox.x)}:${Math.round(p.stageBox.y)}`;
const ffmpeg = args => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });
ffmpeg(['-i', p.videoPath, '-i', p.nativeAudioPath, '-filter_complex',
  `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,${crop},scale=960:720[v];[1:a]adelay=${delay}|${delay},atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a]`,
  '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out + '/opening-to-game.mp4']);
ffmpeg(['-i', out + '/opening-to-game.mp4', '-filter_complex',
  '[0:v]fps=8,scale=600:450,split[x][y];[x]palettegen=max_colors=96[p];[y][p]paletteuse=dither=bayer:bayer_scale=3[g]',
  '-map', '[g]', '-loop', '0', out + '/opening-to-game.gif']);
mkdirSync(out + '/frames', { recursive: true });
const timeline = p.presentationEvidence.find(s => s.branch === 'keep' && s.nativeOpeningTimeline).nativeOpeningTimeline;
for (const [i, scene] of timeline.entries()) ffmpeg(['-ss', String(scene.atSec + 3.5), '-i', p.videoPath,
  '-frames:v', '1', '-vf', crop + ',scale=600:450', out + `/frames/${i + 1}.png`]);
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync(out + '/media.json', JSON.stringify({ sourceVideo: p.videoPath, sourceVideoSha256: digest(p.videoPath),
  sourceAudio: p.nativeAudioPath, sourceAudioSha256: digest(p.nativeAudioPath), clipStartSeconds: start,
  clipEndSeconds: end, audioStartOffsetMs: delay, audioSync: 'native audio capture start aligned to browser recording clock; approximate screencast synchronization',
  changed: 'crop, scale, encode and native audio mux; no respeed, fabricated frames, narration or dubbed score',
  mp4Sha256: digest(out + '/opening-to-game.mp4'), gifSha256: digest(out + '/opening-to-game.gif') }, null, 2) + '\n');
writeFileSync(out + '/frames/SUMMARY.md', '# 실제 연속 녹화의 프레임\n\n출하 ZIP 원본 재생. 벽시계 scene 관찰 시점+3.5초의 native video를 그대로 추출했다.\n\n즉시 확인: 1.png, 3.png, 4.png, 6.png\n');
