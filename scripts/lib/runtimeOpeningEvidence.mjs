// Read-only shipping-player observations and native audio recording. Never authors content.
export async function installOpeningEvidence(page, captureAudio) {
  await page.addInitScript(({ captureAudio }) => {
    const record = window.__oprnOpeningEvidence = { layers: [], audio: [], media: [], errors: [], startedAt: null };
    let context, destination, analyser, recorder;
    const chunks = [], connected = new WeakSet();
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
        record.media.push({ at: Date.now(), testid: this.dataset.testid ?? null });
      } catch (error) { record.errors.push(error.message); }
      return originalPlay.apply(this, args);
    };
    const resume = () => { if (context?.state === 'suspended') void context.resume(); };
    window.addEventListener('keydown', resume, true); window.addEventListener('pointerdown', resume, true);
    const timer = setInterval(() => {
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
