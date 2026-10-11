import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = process.argv[2] ? createRequire(path.join(process.argv[2], 'package.json')) : createRequire(import.meta.url);
const sharp = require('sharp');
const directory = fileURLToPath(new URL('../extension/icons/', import.meta.url));
for (const size of [16, 32, 48, 128]) await sharp(path.join(directory, 'icon.svg')).resize(size, size).png().toFile(path.join(directory, `icon${size}.png`));
