const fs = require('fs');
const path = require('path');

// Simple 32x32 green circle PNG base64 representation
const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAnUlEQVRYR+2WwQrDIBDEn///R0899FCo4F5CcN1D173sZk8hW2ayBiN54GO87bqutsbYGBsj78aGmL7v5Nl/3k3fL5eB5F0SGBOIEhglMEpglMCYAALpD4QApgSipN7+zIDm5tqWfXG+3mXn462H156XyK71xH5t9Xk/vD7v9B/v9B/v9B/v9B/vdKcxJuFpQEhgSoA2MEpglMCoPzMrbWcO2l5NAAAAAElFTkSuQmCC';

const buffer = Buffer.from(base64Png, 'base64');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), buffer);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), buffer);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), buffer);

console.log('Icons generated successfully inside c:\\TokenMeter\\icons\\');
