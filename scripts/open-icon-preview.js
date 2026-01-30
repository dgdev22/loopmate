#!/usr/bin/env node

/**
 * Open Icon Preview Script
 * 
 * Opens a web-based preview of all AppX icons for visual verification.
 * This is especially useful on Mac where .appx files can't be easily inspected.
 * 
 * Usage:
 *   node scripts/open-icon-preview.js
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const previewHtmlPath = path.join(__dirname, 'preview-appx-icons.html');
const assetsDir = path.join(rootDir, 'build', 'appx', 'assets');

function openPreview() {
  console.log('🔍 Opening AppX icons preview...\n');
  
  // Check if assets directory exists
  if (!fs.existsSync(assetsDir)) {
    console.error(`❌ AppX assets directory not found: ${assetsDir}`);
    console.error('💡 Please run: npm run build:appx-assets');
    process.exit(1);
  }
  
  // Check if preview HTML exists
  if (!fs.existsSync(previewHtmlPath)) {
    console.error(`❌ Preview HTML not found: ${previewHtmlPath}`);
    process.exit(1);
  }
  
  // Open in browser
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${previewHtmlPath}"`, { stdio: 'ignore' });
      console.log('✅ Preview opened in browser');
    } else if (process.platform === 'win32') {
      execSync(`start "${previewHtmlPath}"`, { stdio: 'ignore' });
      console.log('✅ Preview opened in browser');
    } else {
      console.log(`💡 Please open this file in your browser:`);
      console.log(`   ${previewHtmlPath}`);
    }
    
    console.log('\n📋 Instructions:');
    console.log('   1. Check each icon in the preview');
    console.log('   2. Verify icons show LoopMate logo (infinity + play button)');
    console.log('   3. Icons should NOT show Electron atom icon');
    console.log('   4. Yellow-bordered icons are Policy 10.1.1.11 required');
    
  } catch (error) {
    console.error('❌ Failed to open preview:', error.message);
    console.log(`\n💡 Please open this file manually in your browser:`);
    console.log(`   ${previewHtmlPath}`);
  }
}

openPreview();
