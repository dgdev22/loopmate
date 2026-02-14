#!/usr/bin/env node

/**
 * Copy Microsoft Store AppX Assets
 * 
 * Copies required icon files from build/store-icons/ to build/appx/
 * for electron-builder to use during AppX package creation.
 * 
 * CRITICAL: electron-builder reads icons from build/appx/ directly (NOT build/appx/assets/).
 * The AppxTarget.js does readdir(build/appx/) and filters for files containing "."
 * Icons placed in build/appx/assets/ will NOT be found by electron-builder!
 * 
 * electron-builder also uses specific filenames for tile sizes:
 * - LargeTile.png for Square310x310Logo (310x310)
 * - SmallTile.png for Square71x71Logo (71x71)
 * 
 * See: node_modules/app-builder-lib/out/targets/AppxTarget.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourceDir = path.join(rootDir, 'build', 'store-icons');
// CRITICAL: electron-builder reads from build/appx/ directly, NOT build/appx/assets/
const targetDir = path.join(rootDir, 'build', 'appx');

// Icon files that electron-builder requires in build/appx/ folder.
// electron-builder's AppxTarget.computeUserAssets() reads this folder and maps files to assets\ in the package.
// The vendorAssetsForDefaultAssets fallback provides default Electron icons for:
//   StoreLogo.png, Square150x150Logo.png, Square44x44Logo.png, Wide310x150Logo.png
// We MUST provide these to avoid default Electron icons (Policy 10.1.1.11 violation).
//
// Additionally, the defaultTileTag() function looks for:
//   LargeTile.png → Square310x310Logo in manifest
//   SmallTile.png → Square71x71Logo in manifest
const requiredIcons = [
  // Core icons (prevents default Electron icon fallback)
  { source: 'Square44x44Logo.png', target: 'Square44x44Logo.png' },      // AppList logo (Policy 10.1.1.11)
  { source: 'Square150x150Logo.png', target: 'Square150x150Logo.png' },  // Default tile
  { source: 'StoreLogo.png', target: 'StoreLogo.png' },                   // Store logo (50x50)
  { source: 'Wide310x150Logo.png', target: 'Wide310x150Logo.png' },      // Wide tile

  // Additional tile sizes (electron-builder uses specific names!)
  { source: 'Square310x310Logo.png', target: 'LargeTile.png' },          // Large tile (310x310)
  { source: 'Square71x71Logo.png', target: 'SmallTile.png' },            // Small tile (71x71)

  // Extra sizes (included as-is in package assets)
  { source: 'Square50x50Logo.png', target: 'Square50x50Logo.png' },
  { source: 'Square89x89Logo.png', target: 'Square89x89Logo.png' },
  { source: 'Square107x107Logo.png', target: 'Square107x107Logo.png' },
  { source: 'Square142x142Logo.png', target: 'Square142x142Logo.png' },
  { source: 'Square284x284Logo.png', target: 'Square284x284Logo.png' },
];

function copyAppXAssets() {
  try {
    // Check if source directory exists
    if (!fs.existsSync(sourceDir)) {
      console.error(`❌ Source directory not found: ${sourceDir}`);
      console.error('Please run "npm run generate:store-icons" first');
      process.exit(1);
    }

    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      console.log(`📁 Created target directory: ${targetDir}`);
    }

    // Clean up old assets subdirectory if it exists (was incorrect location)
    const oldAssetsDir = path.join(targetDir, 'assets');
    if (fs.existsSync(oldAssetsDir)) {
      console.log(`🧹 Removing old build/appx/assets/ directory (icons must be in build/appx/ directly)`);
      fs.rmSync(oldAssetsDir, { recursive: true, force: true });
    }

    console.log(`📋 Copying AppX assets from: ${sourceDir}`);
    console.log(`📦 Target directory: ${targetDir}`);
    console.log(`⚠️  Icons must be in build/appx/ (NOT build/appx/assets/) for electron-builder\n`);

    let copiedCount = 0;
    let missingCount = 0;
    const missingFiles = [];

    // Copy each required icon
    for (const icon of requiredIcons) {
      const sourcePath = path.join(sourceDir, icon.source);
      const targetPath = path.join(targetDir, icon.target);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        const renamed = icon.source !== icon.target ? ` (renamed from ${icon.source})` : '';
        console.log(`  ✓ ${icon.target}${renamed}`);
        copiedCount++;
      } else {
        console.log(`  ✗ ${icon.source} → ${icon.target} (SOURCE NOT FOUND)`);
        missingFiles.push(icon.source);
        missingCount++;
      }
    }

    console.log(`\n✅ Copied ${copiedCount} icon(s) to build/appx/`);
    
    if (missingCount > 0) {
      console.error(`\n❌ Missing ${missingCount} source icon(s):`);
      missingFiles.forEach(file => console.error(`   - ${file}`));
      console.error('\n💡 Please run "npm run generate:store-icons" to generate missing icons');
      process.exit(1);
    }

    // Verify critical icons (the 4 that electron-builder has vendor defaults for)
    const criticalIcons = ['Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png', 'Wide310x150Logo.png'];
    const missingCritical = criticalIcons.filter(icon => !fs.existsSync(path.join(targetDir, icon)));
    
    if (missingCritical.length > 0) {
      console.error(`\n❌ CRITICAL: Missing required icons for Policy 10.1.1.11:`);
      missingCritical.forEach(icon => console.error(`   - ${icon}`));
      console.error('\nWithout these, electron-builder will use DEFAULT Electron icons (atom logo)!');
      process.exit(1);
    }

    // Verify tile icons
    const tileIcons = ['LargeTile.png', 'SmallTile.png'];
    const missingTiles = tileIcons.filter(icon => !fs.existsSync(path.join(targetDir, icon)));
    if (missingTiles.length > 0) {
      console.warn(`\n⚠️  Missing optional tile icons (recommended for full tile support):`);
      missingTiles.forEach(icon => console.warn(`   - ${icon}`));
    }

    console.log(`\n✅ All AppX assets are ready in: ${targetDir}`);
    console.log('📋 electron-builder will map these files to assets\\ in the AppX package');
    console.log('💡 The 4 critical icons prevent default Electron icon fallback');
    console.log('💡 LargeTile.png and SmallTile.png enable extra tile sizes in the manifest');

  } catch (error) {
    console.error('❌ Error copying AppX assets:', error);
    process.exit(1);
  }
}

copyAppXAssets();
