const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const dir = 'public/assets/cc0/jetrel/icons/';

async function processImages() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const image = await Jimp.read(filePath);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      const bgColor = image.getPixelColor(0, 0);
      const bgRgba = Jimp.intToRGBA(bgColor);

      // We only consider it a background if it's an edge pixel, but to be simple, 
      // let's do a flood fill from (0,0) to set alpha to 0.
      // A simple flood fill:
      const stack = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
      const visited = new Set();
      let changed = false;

      while (stack.length > 0) {
        const [x, y] = stack.pop();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const c = Jimp.intToRGBA(image.getPixelColor(x, y));
        
        // If it matches the background color (ignoring alpha, or just exact match)
        if (c.r === bgRgba.r && c.g === bgRgba.g && c.b === bgRgba.b) {
          if (c.a !== 0) {
            image.setPixelColor(Jimp.rgbaToInt(c.r, c.g, c.b, 0), x, y);
            changed = true;
          }
          // even if alpha is already 0, we continue flood fill to reach other pixels
          stack.push([x + 1, y]);
          stack.push([x - 1, y]);
          stack.push([x, y + 1]);
          stack.push([x, y - 1]);
        }
      }

      // Force save as true RGBA (Jimp does this by default)
      await image.writeAsync(filePath);
      console.log(`Processed ${file}`);
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }
}

processImages();
