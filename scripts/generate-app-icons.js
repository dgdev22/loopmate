#!/usr/bin/env node

/**
 * Generate App Icons (icon.ico, icon.png, icon.icns)
 * 
 * Regenerates build/icon.png and build/icon.ico from assets/windows.png
 * This is CRITICAL - if these files are outdated, electron-builder will
 * embed the old (default Electron) icon into the AppX package.
 * 
 * The ICO file contains multiple resolutions as required by Windows.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourceImage = path.join(rootDir, 'assets', 'windows.png');
const buildDir = path.join(rootDir, 'build');
const outputPng = path.join(buildDir, 'icon.png');
const outputIco = path.join(buildDir, 'icon.ico');

// ICO file format sizes (Windows standard)
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * Create an ICO file from multiple PNG buffers
 * ICO format: Header + Directory entries + Image data
 */
function createIcoBuffer(pngBuffers) {
  // ICO Header: 6 bytes
  // - Reserved: 2 bytes (0)
  // - Type: 2 bytes (1 = ICO)
  // - Count: 2 bytes (number of images)
  const headerSize = 6;
  const dirEntrySize = 16; // Each directory entry is 16 bytes
  const numImages = pngBuffers.length;
  
  // Calculate total size
  const dirSize = dirEntrySize * numImages;
  let totalDataSize = 0;
  for (const buf of pngBuffers) {
    totalDataSize += buf.data.length;
  }
  
  const totalSize = headerSize + dirSize + totalDataSize;
  const ico = Buffer.alloc(totalSize);
  
  // Write header
  ico.writeUInt16LE(0, 0);          // Reserved
  ico.writeUInt16LE(1, 2);          // Type: ICO
  ico.writeUInt16LE(numImages, 4);  // Number of images
  
  // Calculate offsets for image data
  let dataOffset = headerSize + dirSize;
  
  // Write directory entries and image data
  for (let i = 0; i < numImages; i++) {
    const { size, data } = pngBuffers[i];
    const entryOffset = headerSize + (i * dirEntrySize);
    
    // Directory entry: 16 bytes
    ico.writeUInt8(size >= 256 ? 0 : size, entryOffset);       // Width (0 = 256)
    ico.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1);   // Height (0 = 256)
    ico.writeUInt8(0, entryOffset + 2);                         // Color palette
    ico.writeUInt8(0, entryOffset + 3);                         // Reserved
    ico.writeUInt16LE(1, entryOffset + 4);                      // Color planes
    ico.writeUInt16LE(32, entryOffset + 6);                     // Bits per pixel
    ico.writeUInt32LE(data.length, entryOffset + 8);            // Image data size
    ico.writeUInt32LE(dataOffset, entryOffset + 12);            // Image data offset
    
    // Copy image data
    data.copy(ico, dataOffset);
    dataOffset += data.length;
  }
  
  return ico;
}

async function generateAppIcons() {
  console.log('🔄 Generating app icons from custom logo...');
  console.log(`📁 Source: ${sourceImage}`);
  
  // Verify source exists
  if (!fs.existsSync(sourceImage)) {
    console.error(`❌ Source image not found: ${sourceImage}`);
    process.exit(1);
  }
  
  // Ensure build directory exists
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }
  
  // Get source image info
  const sourceMetadata = await sharp(sourceImage).metadata();
  console.log(`   Source: ${sourceMetadata.width}x${sourceMetadata.height} ${sourceMetadata.format}`);
  
  // 1. Generate icon.png (1024x1024)
  console.log('\n📐 Generating icon.png (1024x1024)...');
  await sharp(sourceImage)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPng);
  
  const pngStats = fs.statSync(outputPng);
  console.log(`   ✓ icon.png (${(pngStats.size / 1024).toFixed(1)} KB)`);
  
  // 2. Generate icon.ico (multi-resolution)
  console.log('\n📐 Generating icon.ico (multi-resolution)...');
  const pngBuffers = [];
  
  for (const size of ICO_SIZES) {
    const data = await sharp(sourceImage)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    
    pngBuffers.push({ size, data });
    console.log(`   ✓ ${size}x${size}`);
  }
  
  const icoBuffer = createIcoBuffer(pngBuffers);
  fs.writeFileSync(outputIco, icoBuffer);
  
  const icoStats = fs.statSync(outputIco);
  console.log(`   ✓ icon.ico (${(icoStats.size / 1024).toFixed(1)} KB, ${ICO_SIZES.length} resolutions)`);
  
  // 3. Verify the files
  console.log('\n🔍 Verification:');
  
  const newPngMd5 = await getFileMd5(outputPng);
  const newIcoMd5 = await getFileMd5(outputIco);
  
  console.log(`   icon.png MD5: ${newPngMd5}`);
  console.log(`   icon.ico MD5: ${newIcoMd5}`);
  console.log(`   icon.png size: ${(pngStats.size / 1024).toFixed(1)} KB`);
  console.log(`   icon.ico size: ${(icoStats.size / 1024).toFixed(1)} KB`);
  
  console.log('\n✅ App icons generated successfully from custom LoopMate logo!');
  console.log('   These will be used by electron-builder for the AppX package.');
  console.log('\n💡 Next: run "npm run build:ms-store" to build with the new icons.');
}

function getFileMd5(filePath) {
  return new Promise((resolve) => {
    const crypto = import('crypto');
    crypto.then(mod => {
      const hash = mod.createHash('md5');
      const data = fs.readFileSync(filePath);
      hash.update(data);
      resolve(hash.digest('hex'));
    });
  });
}

generateAppIcons().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
