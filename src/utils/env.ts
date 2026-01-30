/**
 * Environment Detection Utilities
 * 
 * Utility functions for detecting runtime environment and platform-specific conditions.
 */

/**
 * Check if running in Microsoft Store build
 * Uses process.windowsStore property (Electron property available in Store builds)
 * 
 * This function checks environment variables set during build time.
 * For runtime checks, use isStoreBuild() from src/lib/storeDetection.ts
 * 
 * @returns boolean - true if running in Microsoft Store, false otherwise
 */
export function isWindowsStore(): boolean {
  // Check Vite environment variables (set during build)
  if (import.meta.env.VITE_IS_STORE === 'true' || import.meta.env.VITE_IS_STORE_BUILD === 'true') {
    return true
  }

  // In Electron renderer, we can check via window.electronAPI if available
  // However, for synchronous checks, we rely on environment variables
  // The async check is handled in src/lib/storeDetection.ts
  
  return false
}
