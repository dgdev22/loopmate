#!/usr/bin/env node

/**
 * Sync version from Git tag to package.json
 * 
 * This script reads the latest Git tag (e.g., v1.0.3) and updates package.json
 * version accordingly. If no tag is found, it uses the current package.json version.
 * 
 * Usage:
 *   node scripts/sync-version-from-tag.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');

function getVersionFromGitTag() {
  try {
    // Get the latest tag (sorted by version)
    const tags = execSync('git tag --sort=-version:refname', { 
      encoding: 'utf-8',
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim().split('\n').filter(tag => tag);
    
    if (tags.length === 0) {
      return null;
    }
    
    // Get the latest tag
    const latestTag = tags[0];
    
    // Remove 'v' prefix if present (e.g., v1.0.3 -> 1.0.3)
    const version = latestTag.startsWith('v') ? latestTag.slice(1) : latestTag;
    
    // Validate version format (semver: x.y.z)
    if (!/^\d+\.\d+\.\d+/.test(version)) {
      console.warn(`⚠️  Warning: Tag "${latestTag}" does not match semver format. Using current package.json version.`);
      return null;
    }
    
    return version;
  } catch (error) {
    // Git command failed (e.g., not a git repo, no tags)
    return null;
  }
}

function updatePackageJsonVersion(newVersion) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const oldVersion = packageJson.version;
    
    if (oldVersion === newVersion) {
      console.log(`✓ Version is already ${newVersion}`);
      return false;
    }
    
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(`✓ Updated version from ${oldVersion} to ${newVersion}`);
    return true;
  } catch (error) {
    console.error('❌ Error updating package.json:', error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🔄 Syncing version from Git tag...\n');
  
  // Read current package.json version
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = packageJson.version;
  console.log(`📦 Current package.json version: ${currentVersion}`);
  
  // Try to get version from Git tag
  const tagVersion = getVersionFromGitTag();
  
  if (tagVersion) {
    console.log(`🏷️  Latest Git tag version: ${tagVersion}`);
    
    if (tagVersion !== currentVersion) {
      updatePackageJsonVersion(tagVersion);
      console.log(`\n✅ Version synced successfully!`);
    } else {
      console.log(`\n✅ Version is already in sync.`);
    }
  } else {
    console.log(`⚠️  No valid Git tag found. Using current package.json version: ${currentVersion}`);
    console.log(`💡 Tip: Create a tag with 'git tag v1.0.3' to sync version automatically.`);
  }
}

main();
