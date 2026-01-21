#!/usr/bin/env node

/**
 * Microsoft Store Icon Generator
 * 
 * Generates all required icon sizes and images for Microsoft Store (AppX) submission
 * from a source PNG image.
 * 
 * Includes:
 * - App package icons (Square logos, Wide logo, Store logo)
 * - 9:16 Poster Art (Xbox, highly recommended)
 * - 1:1 Box Art (Store display, recommended)
 * - 1:1 App Tile Icons (Store display, recommended)
 * - 16:9 Super Hero Art (Windows/Xbox)
 * - Xbox Images (Brand Key Art, Title Hero Art, Promotional Square Art)
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Input and output paths
// Use favicon.png as source for Microsoft Store icons (Policy 10.1.1.11 compliance)
// Check both public/ and assets/ directories for favicon.png
const faviconPaths = [
  path.join(rootDir, 'public', 'favicon.png'),
  path.join(rootDir, 'assets', 'favicon.png'),
  path.join(rootDir, 'assets', 'windows.png') // Fallback to windows.png if favicon.png not found
];
const inputImage = faviconPaths.find(p => fs.existsSync(p)) || faviconPaths[0];
const outputDir = path.join(rootDir, 'build', 'store-icons');

// Microsoft Store required icon sizes
const squareIcons = [
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square50x50Logo.png', size: 50 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
];

const wideIcons = [
  { name: 'Wide310x150Logo.png', width: 310, height: 150 },
];

const storeLogo = [
  { name: 'StoreLogo.png', size: 50 },
];

// 9:16 Poster Art (Xbox, highly recommended)
// Windows 10/11 customers use as default logo, required for Xbox display
const posterArt = [
  { name: 'PosterArt_720x1080.png', width: 720, height: 1080 },
  { name: 'PosterArt_1440x2160.png', width: 1440, height: 2160 },
];

// 1:1 Box Art (Store display, recommended)
// Used as default logo if 9:16 poster art is not provided
const boxArt = [
  { name: 'BoxArt_1080x1080.png', size: 1080 },
  { name: 'BoxArt_2160x2160.png', size: 2160 },
];

// 1:1 App Tile Icons (Store display, recommended)
// Microsoft Store uses these in preference over package icons
const appTileIcons = [
  { name: 'AppTileIcon_300x300.png', size: 300 },
  { name: 'AppTileIcon_150x150.png', size: 150 },
  { name: 'AppTileIcon_71x71.png', size: 71 },
];

// 16:9 Super Hero Art (Windows/Xbox)
// Displayed at top of Microsoft Store listing (or after trailer)
// Note: Should NOT include product title
const heroArt = [
  { name: 'HeroArt_1920x1080.png', width: 1920, height: 1080 },
  { name: 'HeroArt_3840x2160.png', width: 3840, height: 2160 },
];

// Xbox Images
const xboxImages = [
  { name: 'Xbox_BrandKeyArt_584x800.png', width: 584, height: 800 },
  { name: 'Xbox_TitleHeroArt_1920x1080.png', width: 1920, height: 1080 },
  { name: 'Xbox_PromotionalSquareArt_1080x1080.png', size: 1080 },
];

async function generateIcons() {
  try {
    // Check if input image exists
    if (!fs.existsSync(inputImage)) {
      console.error(`❌ Input image not found: ${inputImage}`);
      console.error('Please ensure public/favicon.png or assets/favicon.png exists');
      process.exit(1);
    }

    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }

    console.log(`🖼️  Generating Microsoft Store icons from: ${inputImage}`);
    console.log(`📦 Output directory: ${outputDir}\n`);

    // Load the source image
    const image = sharp(inputImage);

    // Generate square icons
    console.log('Generating square icons...');
    for (const icon of squareIcons) {
      const outputPath = path.join(outputDir, icon.name);
      await image
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
    }

    // Generate wide icon
    console.log('\nGenerating wide icon...');
    for (const icon of wideIcons) {
      const outputPath = path.join(outputDir, icon.name);
      await image
        .resize(icon.width, icon.height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${icon.name} (${icon.width}x${icon.height})`);
    }

    // Generate store logo
    console.log('\nGenerating store logo...');
    for (const icon of storeLogo) {
      const outputPath = path.join(outputDir, icon.name);
      await image
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
    }

    // Generate 9:16 Poster Art (Xbox, highly recommended)
    console.log('\nGenerating 9:16 Poster Art (Xbox)...');
    for (const art of posterArt) {
      const outputPath = path.join(outputDir, art.name);
      await image
        .resize(art.width, art.height, {
          fit: 'contain',
          background: { r: 2, g: 6, b: 23, alpha: 1 }, // Dark background (#020617)
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${art.name} (${art.width}x${art.height})`);
    }

    // Generate 1:1 Box Art (Store display, recommended)
    console.log('\nGenerating 1:1 Box Art...');
    for (const art of boxArt) {
      const outputPath = path.join(outputDir, art.name);
      await image
        .resize(art.size, art.size, {
          fit: 'contain',
          background: { r: 2, g: 6, b: 23, alpha: 1 }, // Dark background (#020617)
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${art.name} (${art.size}x${art.size})`);
    }

    // Generate 1:1 App Tile Icons (Store display, recommended)
    console.log('\nGenerating 1:1 App Tile Icons...');
    for (const icon of appTileIcons) {
      const outputPath = path.join(outputDir, icon.name);
      await image
        .resize(icon.size, icon.size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${icon.name} (${icon.size}x${icon.size})`);
    }

    // Generate 16:9 Super Hero Art (Windows/Xbox)
    console.log('\nGenerating 16:9 Super Hero Art...');
    for (const art of heroArt) {
      const outputPath = path.join(outputDir, art.name);
      await image
        .resize(art.width, art.height, {
          fit: 'contain',
          background: { r: 2, g: 6, b: 23, alpha: 1 }, // Dark background (#020617)
        })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${art.name} (${art.width}x${art.height})`);
    }

    // Generate Xbox Images
    console.log('\nGenerating Xbox Images...');
    for (const img of xboxImages) {
      const outputPath = path.join(outputDir, img.name);
      if (img.size) {
        // Square image
        await image
          .resize(img.size, img.size, {
            fit: 'contain',
            background: { r: 2, g: 6, b: 23, alpha: 1 }, // Dark background (#020617)
          })
          .png()
          .toFile(outputPath);
        console.log(`  ✓ ${img.name} (${img.size}x${img.size})`);
      } else {
        // Rectangular image
        await image
          .resize(img.width, img.height, {
            fit: 'contain',
            background: { r: 2, g: 6, b: 23, alpha: 1 }, // Dark background (#020617)
          })
          .png()
          .toFile(outputPath);
        console.log(`  ✓ ${img.name} (${img.width}x${img.height})`);
      }
    }

    const totalCount = squareIcons.length + wideIcons.length + storeLogo.length + 
                       posterArt.length + boxArt.length + appTileIcons.length + 
                       heroArt.length + xboxImages.length;

    console.log(`\n✅ Successfully generated ${totalCount} images!`);
    console.log(`📂 Images saved to: ${outputDir}`);
    console.log('\n📋 Generated files:');
    console.log('   • App Package Icons (11 files)');
    console.log('   • 9:16 Poster Art - Xbox (2 files) ⭐ Highly Recommended');
    console.log('   • 1:1 Box Art (2 files) ⭐ Recommended');
    console.log('   • 1:1 App Tile Icons (3 files) ⭐ Recommended');
    console.log('   • 16:9 Super Hero Art (2 files)');
    console.log('   • Xbox Images (3 files)');
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated images in build/store-icons/');
    console.log('   2. Upload these images to Microsoft Partner Center when submitting your app');
    console.log('   3. Note: Hero Art should NOT include product title');
    console.log('   4. Poster Art is required for proper Xbox display');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
