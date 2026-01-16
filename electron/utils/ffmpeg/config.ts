/**
 * FFmpeg configuration and path setup
 * 
 * Handles FFmpeg and FFprobe binary path resolution for both
 * development and production environments (including ASAR unpacking).
 */

import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
// @ts-expect-error - ffprobe-static has no type definitions
import ffprobePath from 'ffprobe-static'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { app } from 'electron'
import { log } from '../logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isPackaged = app.isPackaged

/**
 * Get FFmpeg binary path
 * Handles both development and production environments
 */
export function getFfmpegPath(): string {
  if (!ffmpegPath) {
    throw new Error('ffmpeg-static binary not found')
  }

  // In development, use directly
  if (!isPackaged) {
    return ffmpegPath
  }

  // Production: find in app.asar.unpacked
  let binaryPath = ffmpegPath
  
  // If app.asar is in path, replace with app.asar.unpacked
  if (binaryPath.includes('app.asar')) {
    binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked')
  } else {
    // If app.asar not found, use process.resourcesPath
    const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..')
    binaryPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', path.basename(ffmpegPath))
  }

  // Check .exe extension on Windows
  if (process.platform === 'win32' && !binaryPath.endsWith('.exe')) {
    const dir = path.dirname(binaryPath)
    const name = path.basename(binaryPath, path.extname(binaryPath))
    binaryPath = path.join(dir, name + '.exe')
  }

  // Check file existence
  if (!fs.existsSync(binaryPath)) {
    // Try alternative path
    const altPath = path.join(process.resourcesPath || __dirname, '..', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', path.basename(ffmpegPath))
    if (fs.existsSync(altPath)) {
      return altPath
    }
    log.warn(`FFmpeg binary not found at ${binaryPath}, using original path: ${ffmpegPath}`)
    return ffmpegPath
  }

  return binaryPath
}

/**
 * Get FFprobe binary path
 * Handles both development and production environments
 */
export function getFfprobePath(): string {
  if (!ffprobePath || !ffprobePath.path) {
    throw new Error('ffprobe-static binary not found')
  }

  // In development, use directly
  if (!isPackaged) {
    return ffprobePath.path
  }

  // Production: find in app.asar.unpacked
  let binaryPath = ffprobePath.path
  
  // If app.asar is in path, replace with app.asar.unpacked
  if (binaryPath.includes('app.asar')) {
    binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked')
  } else {
    // If app.asar not found, use process.resourcesPath
    const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', '..')
    binaryPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static', path.basename(ffprobePath.path))
  }

  // Check .exe extension on Windows
  if (process.platform === 'win32' && !binaryPath.endsWith('.exe')) {
    const dir = path.dirname(binaryPath)
    const name = path.basename(binaryPath, path.extname(binaryPath))
    binaryPath = path.join(dir, name + '.exe')
  }

  // Check file existence
  if (!fs.existsSync(binaryPath)) {
    // Try alternative path
    const altPath = path.join(process.resourcesPath || __dirname, '..', 'app.asar.unpacked', 'node_modules', 'ffprobe-static', path.basename(ffprobePath.path))
    if (fs.existsSync(altPath)) {
      return altPath
    }
    log.warn(`FFprobe binary not found at ${binaryPath}, using original path: ${ffprobePath.path}`)
    return ffprobePath.path
  }

  return binaryPath
}

/**
 * Initialize FFmpeg and FFprobe paths
 * Should be called once at application startup
 */
export function initializeFfmpeg(): void {
  try {
    const resolvedFfmpegPath = getFfmpegPath()
    ffmpeg.setFfmpegPath(resolvedFfmpegPath)
    log.info(`FFmpeg path set to: ${resolvedFfmpegPath}`)
    
    const resolvedFfprobePath = getFfprobePath()
    ffmpeg.setFfprobePath(resolvedFfprobePath)
    log.info(`FFprobe path set to: ${resolvedFfprobePath}`)
  } catch (error) {
    log.error('Failed to set FFmpeg/FFprobe paths:', error)
    throw error
  }
}

