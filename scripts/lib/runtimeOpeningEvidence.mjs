// Read-only shipping-player observations and native audio recording. Never authors content.
export async function installOpeningEvidence(page, captureAudio) {
  await page.addInitScript(({ captureAudio }) => {
    const record = window.__oprnOpeningEvidence = { layers: [], audio: [], media: [], fieldAudio: [], background: [], visibleLoadingSamples: 0, errors: [], startedAt: null };
    let context, destination, analyser, recorder;
    const chunks = [], connected = new WeakSet(), hashes = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    if (captureAudio) HTMLMediaElement.prototype.play = function (...args) {
      try {
        if (!context) {
          context = new AudioContext(); destination = context.createMediaStreamDestination();
          analyser = context.createAnalyser(); analyser.fftSize = 2048;
          analyser.connect(destination); analyser.connect(context.destination);
          recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 96000 });
          recorder.addEventListener('dataavailable', e => { if (e.data.size) chunks.push(e.data); });
          record.startedAt = Date.now(); recorder.start(1000);
        }
        if (!connected.has(this)) { context.createMediaElementSource(this).connect(analyser); connected.add(this); }
        const sample = { at: Date.now(), testid: this.dataset.testid ?? null, src: this.src, loop: this.loop, played: false };
        this.addEventListener('playing', () => { sample.played = true; }, { once: true });
        record.media.push(sample);
        hashes.push(fetch(this.src).then(r => r.arrayBuffer()).then(async bytes => {
          sample.sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
        }).catch(() => undefined));
      } catch (error) { record.errors.push(error.message); }
      return originalPlay.apply(this, args);
    };
    const resume = () => { if (context?.state === 'suspended') void context.resume(); };
    window.addEventListener('keydown', resume, true); window.addEventListener('pointerdown', resume, true);
    const timer = setInterval(() => {
      const loading = document.querySelector('[data-testid="play-loading-overlay"]');
      if (loading?.getBoundingClientRect().width && getComputedStyle(loading).display !== 'none') record.visibleLoadingSamples++;
      const scene = window.__oprnHooksScene;
      if (scene && record.background.length < 500) record.background.push({ at: Date.now(), pending: scene.game.registry.get('initialPresentationPending') === true, mapId: scene.session.currentMapId });
      if (scene && record.fieldAudio.length < 500) for (const media of document.querySelectorAll('audio[data-oprn-audio]')) {
        if (media.loop && !media.paused && media.currentTime > 0) record.fieldAudio.push({ at: Date.now(), mapId: scene.session.currentMapId, resourceId: scene.session.audio.bgm?.resourceId, currentTime: media.currentTime, volume: media.volume });
      }
      const root = document.querySelector('[data-testid="cinematic-sequence"]');
      const audio = document.querySelector('[data-testid="cinematic-music"]');
      if ((!root || root.dataset.transitionState !== 'playing') && !audio) return;
      const shot = root?.querySelector('.cinematic-frame:not([data-previous-frame]) .cinematic-shot');
      if (shot && record.layers.length < 500) {
        const layers = [...shot.querySelectorAll('.cinematic-layer')].map((image, index) => {
          const s = getComputedStyle(image);
          return { index, left: s.left, top: s.top, transform: s.transform, opacity: Number(s.opacity), width: s.width };
        });
        if (layers.length) record.layers.push({ at: Date.now(), sceneId: root.dataset.sceneId, layers });
      }
      if (audio && record.audio.length < 500) {
        let rms = null;
        if (analyser) {
          const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
          rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
        }
        record.audio.push({ at: Date.now(), sceneId: root?.dataset.sceneId ?? 'map-handoff', resourceId: root?.dataset.music ?? null,
          currentTime: audio.currentTime, paused: audio.paused, readyState: audio.readyState, volume: audio.volume,
          prepared: audio.dataset.prepared === 'true', rms, contextState: context?.state ?? null });
      }
    }, 150);
    window.__oprnStopOpeningRecording = async () => {
      clearInterval(timer);
      await Promise.all(hashes);
      if (recorder?.state === 'recording') {
        await new Promise(resolve => { recorder.addEventListener('stop', resolve, { once: true }); recorder.stop(); });
      }
      if (context) await context.close();
      if (!chunks.length) return { record, dataUrl: null };
      const dataUrl = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(new Blob(chunks, { type: 'audio/webm' })); });
      return { record, dataUrl };
    };
  }, { captureAudio });
}
