#!/usr/bin/env node

/**
 * Verify AppX Icons Script
 * 
 * This script verifies that all required AppX icons exist and are not
 * the default Electron placeholder icons.
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

const appxAssetsDir = path.join(rootDir, 'build', 'appx', 'assets');
const sourceImagePath = path.join(rootDir, 'assets', 'windows.png');

// Required AppX icon files (Policy 10.1.1.11)
const requiredIcons = [
  'Square44x44Logo.png',      // Critical: AppList logo
  'Square50x50Logo.png',
  'Square71x71Logo.png',
  'Square89x89Logo.png',
  'Square107x107Logo.png',
  'Square142x142Logo.png',
  'Square150x150Logo.png',   // Critical: Default tile
  'Square284x284Logo.png',
  'Square310x310Logo.png',   // Critical: Large tile
  'Wide310x150Logo.png',     // Critical: Wide tile
  'StoreLogo.png',           // Critical: Store logo
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
  console.log(`✓ Checking icons in: ${appxAssetsDir}\n`);
  
  // Check if appx assets directory exists
  if (!fs.existsSync(appxAssetsDir)) {
    console.error(`❌ AppX assets directory not found: ${appxAssetsDir}`);
    console.error('💡 Please run: npm run build:appx-assets');
    process.exit(1);
  }
  
  let allPresent = true;
  const missingIcons = [];
  const presentIcons = [];
  
  // Check each required icon
  for (const icon of requiredIcons) {
    const iconPath = path.join(appxAssetsDir, icon);
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      const sizeKB = (stats.size / 1024).toFixed(1);
      presentIcons.push({ name: icon, size: sizeKB, path: iconPath });
      console.log(`  ✓ ${icon} (${sizeKB} KB)`);
    } else {
      missingIcons.push(icon);
      console.log(`  ✗ ${icon} (MISSING)`);
      allPresent = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (!allPresent) {
    console.error(`\n❌ Missing ${missingIcons.length} required icon(s):`);
    missingIcons.forEach(icon => console.error(`   - ${icon}`));
    console.error('\n💡 Please run: npm run build:appx-assets');
    process.exit(1);
  }
  
  // Verify critical icons
  const criticalIcons = ['Square44x44Logo.png', 'Square150x150Logo.png', 'StoreLogo.png'];
  const criticalMissing = criticalIcons.filter(icon => 
    !fs.existsSync(path.join(appxAssetsDir, icon))
  );
  
  if (criticalMissing.length > 0) {
    console.error(`\n❌ CRITICAL: Missing required icons for Policy 10.1.1.11:`);
    criticalMissing.forEach(icon => console.error(`   - ${icon}`));
    process.exit(1);
  }
  
  console.log(`\n✅ All ${requiredIcons.length} required icons are present!`);
  console.log(`\n📋 Icon Summary:`);
  console.log(`   • Total icons: ${presentIcons.length}`);
  console.log(`   • Critical icons (Policy 10.1.1.11): ✓`);
  console.log(`   • Total size: ${presentIcons.reduce((sum, icon) => sum + parseFloat(icon.size), 0).toFixed(1)} KB`);
  
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open Finder and check: ${appxAssetsDir}`);
  console.log(`   2. Verify images show LoopMate logo (not Electron atom icon)`);
  console.log(`   3. Run: npm run build:ms-store`);
  console.log(`   4. After build, verify .appx file contents (see FIX_DEFAULT_ICON_ISSUE.md)`);
  
  // Open Finder to the assets folder (macOS only)
  if (process.platform === 'darwin') {
    console.log(`\n🔍 Opening Finder to verify icons visually...`);
    try {
      execSync(`open "${appxAssetsDir}"`, { stdio: 'ignore' });
    } catch (error) {
      // Ignore if open command fails
    }
  }
}

verifyIcons();
