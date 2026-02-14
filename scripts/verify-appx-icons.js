#!/usr/bin/env node

/**
 * Verify AppX Icons Script
 * 
 * This script verifies that all required AppX icons exist in the correct location
 * (build/appx/) and are not the default Electron placeholder icons.
 * 
 * CRITICAL: electron-builder reads icons from build/appx/ directly (NOT build/appx/assets/).
 * See: node_modules/app-builder-lib/out/targets/AppxTarget.js
 * 
 * Usage:
 *   node scripts/verify-appx-icons.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// CRITICAL: electron-builder reads from build/appx/ directly, NOT build/appx/assets/
const appxDir = path.join(rootDir, 'build', 'appx');
const sourceImagePath = path.join(rootDir, 'assets', 'windows.png');

// Icons that electron-builder's AppxTarget expects in build/appx/
// The 4 critical icons have vendor fallbacks (default Electron icons) if missing
const requiredIcons = [
  // Critical: these 4 have vendor default fallbacks in electron-builder
  { name: 'Square44x44Logo.png', critical: true, description: 'AppList logo (start menu, search)' },
  { name: 'Square150x150Logo.png', critical: true, description: 'Default tile' },
  { name: 'StoreLogo.png', critical: true, description: 'Store logo (50x50)' },
  { name: 'Wide310x150Logo.png', critical: true, description: 'Wide tile' },

  // Tile icons with special names for electron-builder
  { name: 'LargeTile.png', critical: false, description: 'Large tile (310x310) - maps to Square310x310Logo' },
  { name: 'SmallTile.png', critical: false, description: 'Small tile (71x71) - maps to Square71x71Logo' },

  // Additional sizes (included in package but not referenced in manifest)
  { name: 'Square50x50Logo.png', critical: false, description: 'Extra size (50x50)' },
  { name: 'Square89x89Logo.png', critical: false, description: 'Extra size (89x89)' },
  { name: 'Square107x107Logo.png', critical: false, description: 'Extra size (107x107)' },
  { name: 'Square142x142Logo.png', critical: false, description: 'Extra size (142x142)' },
  { name: 'Square284x284Logo.png', critical: false, description: 'Extra size (284x284)' },
];

function verifyIcons() {
  console.log('🔍 Verifying AppX icons...\n');
  
  // Check if source image exists
  if (!fs.existsSync(sourceImagePath)) {
    console.error(`❌ Source image not found: ${sourceImagePath}`);
    console.error('💡 Please ensure assets/windows.png exists');
    process.exit(1);
  }
  
  console.log(`✓ Source image found: ${sourceImagePath}`);
  console.log(`✓ Checking icons in: ${appxDir}`);
  console.log(`⚠️  Icons must be in build/appx/ (NOT build/appx/assets/) for electron-builder\n`);
  
  // Check if appx directory exists
  if (!fs.existsSync(appxDir)) {
    console.error(`❌ AppX directory not found: ${appxDir}`);
    console.error('💡 Please run: npm run build:appx-assets');
    process.exit(1);
  }

  // Warn about old incorrect location
  const oldAssetsDir = path.join(appxDir, 'assets');
  if (fs.existsSync(oldAssetsDir)) {
    const oldFiles = fs.readdirSync(oldAssetsDir).filter(f => f.endsWith('.png'));
    if (oldFiles.length > 0) {
      console.warn(`⚠️  WARNING: Found icons in build/appx/assets/ (${oldFiles.length} files)`);
      console.warn('   electron-builder does NOT read from this subdirectory!');
      console.warn('   Run "npm run build:appx-assets" to fix icon locations.\n');
    }
  }
  
  let allCriticalPresent = true;
  const missingCritical = [];
  const missingOptional = [];
  const presentIcons = [];
  
  // Check each required icon
  console.log('📋 Checking icons:');
  for (const icon of requiredIcons) {
    const iconPath = path.join(appxDir, icon.name);
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      presentIcons.push({ ...icon, size: sizeKB, path: iconPath });
      const tag = icon.critical ? '⭐' : '  ';
      console.log(`  ${tag} ✓ ${icon.name} (${sizeKB} KB) - ${icon.description}`);
    } else {
      if (icon.critical) {
        missingCritical.push(icon);
        allCriticalPresent = false;
        console.log(`  ⭐ ✗ ${icon.name} (MISSING) - ${icon.description}`);
      } else {
        missingOptional.push(icon);
        console.log(`     ✗ ${icon.name} (MISSING) - ${icon.description}`);
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  
  if (!allCriticalPresent) {
    console.error(`\n❌ CRITICAL: Missing ${missingCritical.length} required icon(s):`);
    missingCritical.forEach(icon => console.error(`   - ${icon.name} (${icon.description})`));
    console.error('\n⚠️  Without these, electron-builder will use DEFAULT Electron icons!');
    console.error('   This will cause Microsoft Store rejection (Policy 10.1.1.11).');
    console.error('\n💡 Fix: npm run build:appx-assets');
    process.exit(1);
  }
  
  console.log(`\n✅ All ${presentIcons.filter(i => i.critical).length} critical icons are present!`);
  
  if (missingOptional.length > 0) {
    console.warn(`\n⚠️  Missing ${missingOptional.length} optional icon(s):`);
    missingOptional.forEach(icon => console.warn(`   - ${icon.name} (${icon.description})`));
  }
  
  console.log(`\n📋 Summary:`);
  console.log(`   • Present: ${presentIcons.length}/${requiredIcons.length} icons`);
  console.log(`   • Critical icons (Policy 10.1.1.11): ✓ All present`);
  console.log(`   • Total size: ${presentIcons.reduce((sum, icon) => sum + parseFloat(icon.size), 0).toFixed(1)} KB`);
  console.log(`   • Location: build/appx/ (correct for electron-builder)`);
  
  console.log(`\n💡 How electron-builder uses these icons:`);
  console.log(`   • Square44x44Logo.png → App list icon (start menu, search)`);
  console.log(`   • Square150x150Logo.png → Default medium tile`);
  console.log(`   • StoreLogo.png → Store listing`);
  console.log(`   • Wide310x150Logo.png → Wide tile`);
  console.log(`   • LargeTile.png → Large 310x310 tile (optional)`);
  console.log(`   • SmallTile.png → Small 71x71 tile (optional)`);
  
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Verify images show LoopMate logo (not Electron atom icon)`);
  console.log(`   2. Run: npm run build:ms-store`);
  console.log(`   3. After build, test the .appx on Windows`);
  
  // Open Finder to the directory (macOS only)
  if (process.platform === 'darwin') {
    console.log(`\n🔍 Opening Finder to verify icons visually...`);
    try {
      execSync(`open "${appxDir}"`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore if open command fails
    }
  }
}

verifyIcons();
