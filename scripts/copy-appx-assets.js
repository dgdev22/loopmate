#!/usr/bin/env node

/**
 * Copy Microsoft Store AppX Assets
 * 
 * Copies required icon files from build/store-icons/ to build/appx/assets/
 * for electron-builder to use during AppX package creation.
 * 
 * This ensures all required icons (especially Square44x44Logo.png) are
 * available in the correct location for Microsoft Store submission.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourceDir = path.join(rootDir, 'build', 'store-icons');
const targetDir = path.join(rootDir, 'build', 'appx', 'assets');

// Required AppX icon files (must match exact names for electron-builder)
const requiredIcons = [
  'Square44x44Logo.png',      // Critical: AppList logo (Policy 10.1.1.11)
  'Square50x50Logo.png',
  'Square71x71Logo.png',
  'Square89x89Logo.png',
  'Square107x107Logo.png',
  'Square142x142Logo.png',
  'Square150x150Logo.png',    // Critical: Default tile
  'Square284x284Logo.png',
  'Square310x310Logo.png',    // Large tile
  'Wide310x150Logo.png',      // Wide tile
  'StoreLogo.png',             // Store logo (50x50)
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

    console.log(`📋 Copying AppX assets from: ${sourceDir}`);
    console.log(`📦 Target directory: ${targetDir}\n`);

    let copiedCount = 0;
    let missingCount = 0;
    const missingFiles = [];

    // Copy each required icon
    for (const icon of requiredIcons) {
      const sourcePath = path.join(sourceDir, icon);
      const targetPath = path.join(targetDir, icon);

      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  ✓ ${icon}`);
        copiedCount++;
      } else {
        console.log(`  ✗ ${icon} (NOT FOUND)`);
        missingFiles.push(icon);
        missingCount++;
      }
    }

    console.log(`\n✅ Copied ${copiedCount} icon(s)`);
    
    if (missingCount > 0) {
      console.error(`\n❌ Missing ${missingCount} required icon(s):`);
      missingFiles.forEach(file => console.error(`   - ${file}`));
      console.error('\n💡 Please run "npm run generate:store-icons" to generate missing icons');
      process.exit(1);
    }

    // Verify critical icons
    const criticalIcons = ['Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png'];
    const missingCritical = criticalIcons.filter(icon => !fs.existsSync(path.join(targetDir, icon)));
    
    if (missingCritical.length > 0) {
      console.error(`\n❌ CRITICAL: Missing required icons for Policy 10.1.1.11:`);
      missingCritical.forEach(icon => console.error(`   - ${icon}`));
      process.exit(1);
    }

    console.log(`\n✅ All AppX assets are ready in: ${targetDir}`);
    console.log('💡 These icons will be used by electron-builder when creating the AppX package');

  } catch (error) {
    console.error('❌ Error copying AppX assets:', error);
    process.exit(1);
  }
}

copyAppXAssets();
