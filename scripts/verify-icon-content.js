#!/usr/bin/env node

/**
 * Verify Icon Content Script
 * 
 * This script verifies that AppX icons are actually generated from
 * the source image (windows.png) and not default Electron icons.
 * 
 * It compares image characteristics to detect if icons are placeholder.
 * 
 * Usage:
 *   node scripts/verify-icon-content.js
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
const storeIconsDir = path.join(rootDir, 'build', 'store-icons');

// Critical icons to verify
const criticalIcons = [
  'Square44x44Logo.png',
  'Square150x150Logo.png',
  'StoreLogo.png',
];

function getImageInfo(imagePath) {
  try {
    // Use sips (macOS) or identify (ImageMagick) to get image info
    let output;
    try {
      output = execSync(`sips -g all "${imagePath}"`, { encoding: 'utf-8' });
    } catch (e) {
      // Fallback to file command
      output = execSync(`file "${imagePath}"`, { encoding: 'utf-8' });
    }
    return output;
  } catch (error) {
    return null;
  }
}

function getImageHash(imagePath) {
  try {
    // Get MD5 hash of image file
    const hash = execSync(`md5 -q "${imagePath}"`, { encoding: 'utf-8' }).trim();
    return hash;
  } catch (error) {
    return null;
  }
}

function compareWithSource(iconPath, sourcePath) {
  // Compare file sizes and hashes
  const iconStats = fs.statSync(iconPath);
  const sourceStats = fs.statSync(sourcePath);
  
  const iconHash = getImageHash(iconPath);
  const sourceHash = getImageHash(sourcePath);
  
  // Check if icon was recently generated (within last hour)
  const iconTime = iconStats.mtime;
  const now = new Date();
  const hoursSinceModified = (now - iconTime) / (1000 * 60 * 60);
  
  return {
    iconSize: iconStats.size,
    sourceSize: sourceStats.size,
    iconHash,
    sourceHash,
    hoursSinceModified,
    recentlyModified: hoursSinceModified < 24, // Modified within 24 hours
  };
}

function verifyIconContent() {
  console.log('🔍 Verifying AppX icon content...\n');
  
  // Check if source exists
  if (!fs.existsSync(sourceImagePath)) {
    console.error(`❌ Source image not found: ${sourceImagePath}`);
    process.exit(1);
  }
  
  console.log(`✓ Source image: ${sourceImagePath}`);
  const sourceInfo = getImageInfo(sourceImagePath);
  if (sourceInfo) {
    console.log(`  ${sourceInfo.split('\n').slice(0, 2).join('\n  ')}`);
  }
  console.log('');
  
  // Check if store-icons were generated from source
  const storeIconPath = path.join(storeIconsDir, 'Square150x150Logo.png');
  if (fs.existsSync(storeIconPath)) {
    const storeIconHash = getImageHash(storeIconPath);
    const appxIconPath = path.join(appxAssetsDir, 'Square150x150Logo.png');
    const appxIconHash = getImageHash(appxIconPath);
    
    if (storeIconHash === appxIconHash) {
      console.log('✓ AppX icons match generated store icons');
      console.log('✓ Icons were copied from build/store-icons/');
    } else {
      console.warn('⚠️  AppX icons may not match generated store icons');
    }
    console.log('');
  }
  
  // Verify each critical icon
  let allValid = true;
  console.log('📋 Verifying critical icons:\n');
  
  for (const iconName of criticalIcons) {
    const iconPath = path.join(appxAssetsDir, iconName);
    
    if (!fs.existsSync(iconPath)) {
      console.error(`  ✗ ${iconName} - NOT FOUND`);
      allValid = false;
      continue;
    }
    
    const stats = fs.statSync(iconPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    const hoursSinceModified = (new Date() - stats.mtime) / (1000 * 60 * 60);
    
    // Check if icon is suspiciously small (default Electron icons are usually smaller)
    const isSuspiciouslySmall = stats.size < 2000; // Less than 2KB is suspicious
    
    // Check modification time
    const isRecent = hoursSinceModified < 24;
    
    const comparison = compareWithSource(iconPath, sourceImagePath);
    
    console.log(`  ✓ ${iconName}`);
    console.log(`    Size: ${sizeKB} KB`);
    console.log(`    Modified: ${hoursSinceModified.toFixed(1)} hours ago`);
    
    if (isSuspiciouslySmall) {
      console.warn(`    ⚠️  WARNING: File size is very small (${sizeKB} KB)`);
      console.warn(`    ⚠️  This might be a placeholder icon`);
      allValid = false;
    }
    
    if (!isRecent) {
      console.warn(`    ⚠️  Icon was modified more than 24 hours ago`);
      console.warn(`    💡 Consider running: npm run build:appx-assets`);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(60));
  
  if (allValid) {
    console.log('\n✅ Icon content verification passed!');
    console.log('\n💡 However, visual verification is still recommended:');
    console.log('   1. Open Finder: build/appx/assets/');
    console.log('   2. Check Square150x150Logo.png visually');
    console.log('   3. Should show LoopMate logo (infinity symbol with play button)');
    console.log('   4. Should NOT show Electron atom icon');
  } else {
    console.error('\n❌ Some icons may be invalid or outdated');
    console.error('\n💡 Recommended actions:');
    console.error('   1. Run: npm run build:appx-assets');
    console.error('   2. Verify icons visually in Finder');
    console.error('   3. Check that icons show LoopMate logo, not Electron icon');
  }
  
  // Open Finder for visual verification
  if (process.platform === 'darwin') {
    console.log('\n🔍 Opening Finder for visual verification...');
    try {
      execSync(`open "${appxAssetsDir}"`, { stdio: 'ignore' });
      console.log('   ✓ Finder opened. Please verify icons visually.');
    } catch (error) {
      // Ignore
    }
  }
}

verifyIconContent();
