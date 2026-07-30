import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';

const dir = 'public/assets/cc0/jetrel/icons/';

async function processImages() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const image = await Jimp.read(filePath);
      const bgColor = image.getPixelColor(0, 0);
      const { r, g, b, a } = Jimp.intToRGBA(bgColor);
      
      if (a === 255) { // If background is opaque
        console.log(`Processing ${file}, bgColor: ${r},${g},${b},${a}`);
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
          const pr = this.bitmap.data[idx + 0];
          const pg = this.bitmap.data[idx + 1];
          const pb = this.bitmap.data[idx + 2];
          const pa = this.bitmap.data[idx + 3];
          
          if (pr === r && pg === g && pb === b && pa === a) {
            this.bitmap.data[idx + 3] = 0; // set alpha to 0
          }
        });
        await image.writeAsync(filePath);
      }
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }
}

processImages();
