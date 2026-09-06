/** Read-only instrumentation: call the original Phaser method, retain its real scene.
 * Installed before the Phaser script loads; no texture, frame or session is fabricated.
 */
export function installPlayerObservation() {
  const onLoad = () => {
    const Phaser = window.Phaser;
    if (!Phaser) return;
    document.removeEventListener("load", onLoad, true);
    const loads = [];
    const loader = Phaser.Loader.LoaderPlugin.prototype;
    const originalAddFile = loader.addFile;
    loader.addFile = function (files) {
      for (const file of Array.isArray(files) ? files : [files]) {
        if (file.type === "image") loads.push({ key: file.key, url: file.url });
      }
      return originalAddFile.call(this, files);
    };
    const prototype = Phaser.GameObjects.Sprite.prototype;
    const original = prototype.setTexture;
    prototype.setTexture = function (...args) {
      const result = original.apply(this, args);
      if (this.scene?.player === this) {
        const scene = this.scene;
        prototype.setTexture = original;
        loader.addFile = originalAddFile;
        window.__u07ArmFrame = moving => {
          const sprite = scene.player; const setFrame = sprite.setFrame;
          let complete;
          window.__u07FrameResult = new Promise(resolve => { complete = resolve; });
          const timeout = setTimeout(() => { sprite.setFrame = setFrame; complete({ status: "timeout" }); }, 15_000);
          sprite.setFrame = function (...args) {
            const result = setFrame.apply(this, args);
            if (scene.moving === moving) {
              clearTimeout(timeout); sprite.setFrame = setFrame;
              complete({ status: "success", moving: scene.moving, textureKey: this.texture.key,
                frame: { name: this.frame.name, x: this.frame.cutX, y: this.frame.cutY, width: this.frame.cutWidth, height: this.frame.cutHeight } });
            }
            return result;
          };
        };
        window.__u07RegisterAgain = (registerBundledFrames, project) => {
          const texture = scene.textures.get("u07-charset-new"); const frame = texture.frames[25];
          registerBundledFrames(scene, project);
          return { sameTexture: scene.textures.get("u07-charset-new") === texture, sameFrame: texture.frames[25] === frame };
        };
        window.__u07ReadPlayer = () => {
          const sprite = scene.player;
          const texture = scene.textures.get("u07-charset-new");
          const source = texture.getSourceImage();
          const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
          const context = canvas.getContext("2d"); context.drawImage(source, 0, 0);
          return {
            loads,
            pixel: [...context.getImageData(0, 0, 1, 1).data],
            resourceId: scene.playerSprite.resourceId, textureKey: sprite.texture.key,
            textureExists: scene.textures.exists("u07-charset-new"),
            frame: { name: sprite.frame.name, x: sprite.frame.cutX, y: sprite.frame.cutY, width: sprite.frame.cutWidth, height: sprite.frame.cutHeight },
            source: { width: source.width, height: source.height },
            frames: [24, 25, 26].map(id => { const frame = texture.frames[id];
              return frame ? { id, x: frame.cutX, y: frame.cutY, width: frame.cutWidth, height: frame.cutHeight } : { id, missing: true }; }),
            other: { graphic: scene.session.actorCharacterResourceIds?.u07_other,
              face: scene.session.actorFaceResourceIds?.u07_other,
              record: scene.session.m2Runtime?.actors?.u07_other },
          };
        };
      }
      return result;
    };
  };
  document.addEventListener("load", onLoad, true);
}
