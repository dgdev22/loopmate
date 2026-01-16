/**
 * Playlist Optimizer - Fast Segmented Encoding for Multi-Track Videos
 * 
 * This module implements ultra-fast playlist video generation by:
 * 1. Segmenting each track into: Fade-In + Body (stream copy!) + Fade-Out + Padding
 * 2. Concatenating all segments using stream copy (no re-encoding!)
 * 
 * Result: 1-hour playlist in 1-2 minutes instead of 10-30 minutes!
 */

import ffmpeg from 'fluent-ffmpeg'
import path from 'node:path'
import fs from 'node:fs'
import { log } from '../logger.js'
import { ProgressCallback } from './types.js'
import { safeRmSync } from '../fsSafe.js'

function attachStartLog(command: ffmpeg.FfmpegCommand, label: string) {
  command.on('start', (cmdLine) => {
    log.info(`[FFmpeg:${label}] ${cmdLine}`)
  })
}

function escapePathForConcatDemuxer(p: string): string {
  // FFmpeg concat demuxer expects POSIX-style paths even on Windows.
  // Also escape single quotes to keep `file '...'` lines valid.
  return p.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

function addImageOrBlackBackground(command: ffmpeg.FfmpegCommand, imagePath: string) {
  if (imagePath && imagePath.trim() !== '') {
    command.input(imagePath).inputOptions(['-loop', '1'])
    return
  }
  // Fallback: no image selected -> use black background
  command.input('color=c=black:s=1920x1080:r=1').inputFormat('lavfi')
}

async function createBaseImageSegment1s(
  imagePath: string,
  outputPath: string
): Promise<void> {
  // Reuse if exists and looks sane
  if (fs.existsSync(outputPath)) {
    try {
      const stats = fs.statSync(outputPath)
      const sizeMb = stats.size / 1024 / 1024
      if (sizeMb > 0.1 && sizeMb < 50) {
        log.info(`♻️  Reusing base image segment: ${path.basename(outputPath)} (${sizeMb.toFixed(2)} MB)`)
        return
      }
      log.warn(`⚠️  Base image segment looks wrong, recreating: ${path.basename(outputPath)} (${sizeMb.toFixed(2)} MB)`)
      safeRmSync(outputPath)
    } catch {
      safeRmSync(outputPath)
    }
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    addImageOrBlackBackground(command, imagePath)
    command
      .outputOptions([
        '-t', '1',               // 1 second segment
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-b:v', '200k',          // keep tiny (will be stream-copied later)
        '-maxrate', '200k',
        '-bufsize', '400k',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-r', '1',
        '-g', '1',
        '-profile:v', 'main',
        '-level', '4.0',
        '-movflags', '+faststart'
      ])
      .on('end', () => {
        log.info(`✅ Base image segment created: ${path.basename(outputPath)}`)
        resolve()
      })
      .on('error', (err) => {
        log.error(`❌ Failed to create base image segment: ${err.message}`)
        reject(err)
      })

    attachStartLog(command, `playlist:base:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

interface TrackSegment {
  path: string
  type: 'fade-in' | 'body' | 'fade-out' | 'padding'
  duration: number
}

interface PlaylistOptions {
  imagePath: string          // Preprocessed image (already padded to 1920x1080)
  audioFiles: string[]       // Array of audio file paths
  outputPath: string
  enablePadding: boolean
  paddingDuration: number
  enableFadeOut: boolean
  fadeOutDuration: number
  tempDir?: string
  onProgress?: ProgressCallback
}

/**
 * Get audio duration in seconds
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }
      resolve(metadata.format.duration || 0)
    })
  })
}

/**
 * Create a fade-in segment (first N seconds with fade)
 */
async function createFadeInSegment(
  imagePath: string,
  audioPath: string,
  outputPath: string,
  fadeDuration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    addImageOrBlackBackground(command, imagePath)
    command
      .input(audioPath)
      .inputOptions(['-t', String(fadeDuration)])  // Only first N seconds
      .videoFilters([
        `fade=t=in:st=0:d=${fadeDuration}`
      ])
      .audioFilters([
        `afade=t=in:st=0:d=${fadeDuration}`
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-b:v', '500k',
        '-maxrate', '500k',
        '-bufsize', '1000k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-r', '1',           // 1 FPS for still image
        '-g', '1',           // Every frame is keyframe
        '-profile:v', 'main', // Consistent profile
        '-level', '4.0',
        '-ar', '44100',      // Consistent audio sample rate
        '-movflags', '+faststart'
      ])
      .on('end', () => {
        log.info(`✅ Fade-in segment created: ${path.basename(outputPath)}`)
        resolve()
      })
      .on('error', (err) => {
        log.error(`❌ Failed to create fade-in segment: ${err.message}`)
        reject(err)
      })
    attachStartLog(command, `playlist:fadein:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

/**
 * Create a body segment (middle part, NO filters - fast!)
 */
async function createBodySegment(
  baseVideoSegmentPath: string,
  audioPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(duration) || duration <= 0) {
      reject(new Error(`Invalid body duration: ${duration}`))
      return
    }

    // -stream_loop semantics: N means play (N+1) times
    // For 1-second base segment, we need at least ceil(duration) seconds total
    const loopCount = Math.max(1, Math.ceil(duration) - 1)

    const command = ffmpeg()
      .input(baseVideoSegmentPath)
      .inputOptions(['-stream_loop', String(loopCount)])
      .input(audioPath)
      .inputOptions([
        '-ss', String(startTime),
        '-t', String(duration)
      ])
      .outputOptions([
        // ⚡ FAST: stream copy video (no re-encoding)
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-ar', '44100',      // Consistent audio sample rate
        '-movflags', '+faststart'
      ])
      .on('end', () => {
        log.info(`✅ Body segment created: ${path.basename(outputPath)} (${duration}s)`)
        resolve()
      })
      .on('error', (err) => {
        log.error(`❌ Failed to create body segment: ${err.message}`)
        reject(err)
      })
    attachStartLog(command, `playlist:body:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

/**
 * Create a fade-out segment (last N seconds with audio fade only)
 * Note: Image is static, so we don't apply video fade - only audio fade
 * This prevents white borders and improves performance
 */
async function createFadeOutSegment(
  imagePath: string,
  audioPath: string,
  outputPath: string,
  startTime: number,
  fadeDuration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    addImageOrBlackBackground(command, imagePath)
    command
      .input(audioPath)
      .inputOptions([
        '-ss', String(startTime),
        '-t', String(fadeDuration)
      ])
      // NO video fade - image is static, video fade causes white borders
      .audioFilters([
        `afade=t=out:st=0:d=${fadeDuration}`
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-b:v', '500k',
        '-maxrate', '500k',
        '-bufsize', '1000k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-r', '1',           // 1 FPS for still image
        '-g', '1',           // Every frame is keyframe
        '-profile:v', 'main', // Consistent profile
        '-level', '4.0',
        '-ar', '44100',      // Consistent audio sample rate
        '-movflags', '+faststart'
      ])
      .on('end', () => {
        log.info(`✅ Fade-out segment created: ${path.basename(outputPath)} (audio fade only)`)
        resolve()
      })
      .on('error', (err) => {
        log.error(`❌ Failed to create fade-out segment: ${err.message}`)
        reject(err)
      })
    attachStartLog(command, `playlist:fadeout:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

/**
 * Create or reuse a padding segment (image continues + silence)
 * This can be reused for all tracks!
 * 
 * @param imagePath - Image path to use (if empty, uses black background)
 * @param outputPath - Output segment path
 * @param duration - Duration in seconds
 * @param reuseIfExists - Whether to reuse existing segment if it exists
 */
async function createPaddingSegment(
  imagePath: string,
  outputPath: string,
  duration: number,
  reuseIfExists: boolean = true
): Promise<void> {
  // Reuse if exists
  if (reuseIfExists && fs.existsSync(outputPath)) {
    try {
      const stats = fs.statSync(outputPath)
      const sizeMb = stats.size / 1024 / 1024
      // Safety: padding segment should be tiny (3s @ 1fps). If it's huge, don't reuse.
      if (sizeMb < 50) {
        log.info(`♻️  Reusing padding segment: ${path.basename(outputPath)} (${sizeMb.toFixed(2)} MB)`)
        return
      }
      log.warn(`⚠️  Padding segment too large, recreating: ${path.basename(outputPath)} (${sizeMb.toFixed(2)} MB)`)
      safeRmSync(outputPath)
    } catch (e) {
      log.warn(`⚠️  Failed to stat/delete existing padding segment, recreating anyway: ${path.basename(outputPath)}`)
      safeRmSync(outputPath)
    }
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
    // Use image if provided, otherwise black background
    addImageOrBlackBackground(command, imagePath)
    command
      .input('anullsrc=channel_layout=stereo:sample_rate=44100')
      .inputFormat('lavfi')
      .outputOptions([
        // CRITICAL: bound duration at OUTPUT level (lavfi sources are infinite by default)
        '-t', String(duration),
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-b:v', '200k',        // padding segment; keep tiny
        '-maxrate', '200k',
        '-bufsize', '400k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',
        '-r', '1',
        '-g', '1',
        '-profile:v', 'main',
        '-level', '4.0',
        '-ar', '44100',
        '-movflags', '+faststart'
      ])
      .on('end', () => {
        log.info(`✅ Padding segment created: ${path.basename(outputPath)} (image continues)`)
        resolve()
      })
      .on('error', (err) => {
        log.error(`❌ Failed to create padding segment: ${err.message}`)
        reject(err)
      })
    attachStartLog(command, `playlist:padding:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

/**
 * Concatenate all segments using stream copy (FAST!)
 */
async function concatenateSegments(
  segments: TrackSegment[],
  outputPath: string,
  onProgress?: ProgressCallback
): Promise<void> {
  const tempDir = path.dirname(segments[0].path)
  const concatListPath = path.join(tempDir, `playlist_concat_${Date.now()}.txt`)
  
  // Create concat list
  const concatList = segments
    .map(s => `file '${escapePathForConcatDemuxer(s.path)}'`)
    .join('\n')
  
  fs.writeFileSync(concatListPath, concatList, 'utf-8')
  
  log.info(`📝 Concat list created with ${segments.length} segments`)

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions([
        '-f', 'concat',
        '-safe', '0'
      ])
      .outputOptions([
        '-c', 'copy',  // ⚡⚡⚡ STREAM COPY - NO RE-ENCODING!
        '-movflags', '+faststart'
      ])
      .on('progress', (p) => {
        if (onProgress && p.percent) {
          onProgress(Math.min(Math.round(p.percent), 99))
        }
      })
      .on('end', () => {
        // Cleanup concat list
        try {
          safeRmSync(concatListPath)
        } catch (e) {
          log.warn('Failed to delete concat list:', e)
        }
        log.info(`✅ All segments concatenated: ${outputPath}`)
        resolve()
      })
      .on('error', (err) => {
        // Cleanup on error
        try {
          safeRmSync(concatListPath)
        } catch (e) {
          // Ignore
        }
        log.error(`❌ Failed to concatenate segments: ${err.message}`)
        reject(err)
      })
    attachStartLog(command, `playlist:concat:${path.basename(outputPath)}`)
    command.save(outputPath)
  })
}

/**
 * Create optimized playlist video with segmented encoding
 * 
 * This is the main entry point for fast playlist generation
 */
export async function createPlaylistWithSegments(
  options: PlaylistOptions
): Promise<string> {
  const {
    imagePath,
    audioFiles,
    outputPath,
    enablePadding,
    paddingDuration,
    enableFadeOut,
    fadeOutDuration,
    tempDir,
    onProgress
  } = options

  const workDir = tempDir || path.dirname(outputPath)
  const allSegments: TrackSegment[] = []
  const tempFiles: string[] = []

  try {
    log.info(`🎵 Starting optimized playlist generation for ${audioFiles.length} tracks`)
    log.info(`⚡ Segmented encoding strategy: Only fade segments will be re-encoded!`)

    const fadeDuration = fadeOutDuration || 2
    const totalTracks = audioFiles.length
    
    // Create reusable 1-second base video segment (for FAST body segments via stream copy)
    const baseSegmentPath = path.join(workDir, `image_1s_${Date.now()}.mp4`)
    tempFiles.push(baseSegmentPath)
    await createBaseImageSegment1s(imagePath, baseSegmentPath)
    
    // Create reusable padding segment once (with image if provided)
    let paddingSegmentPath: string | null = null
    if (enablePadding && paddingDuration > 0) {
      paddingSegmentPath = path.join(workDir, `padding_${paddingDuration}s.mp4`)
      tempFiles.push(paddingSegmentPath)
      await createPaddingSegment(imagePath, paddingSegmentPath, paddingDuration, true)
    }

    // Process each track
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i]
      const trackNum = i + 1
      const duration = await getAudioDuration(audioFile)
      
      log.info(`\n🎵 Processing Track ${trackNum}/${totalTracks}: ${path.basename(audioFile)} (${duration}s)`)

      // Determine segment durations
      const hasFadeIn = false  // Currently not implemented in UI, but easy to add
      const hasFadeOut = enableFadeOut && duration > fadeDuration * 2
      
      const fadeInDuration = hasFadeIn ? fadeDuration : 0
      const fadeOutStart = hasFadeOut ? duration - fadeDuration : duration
      const bodyStart = fadeInDuration
      const bodyDuration = fadeOutStart - bodyStart

      // Progress calculation
      const trackProgress = (i / totalTracks) * 90  // 0-90% for track processing
      const progressPerSegment = (90 / totalTracks) / 4  // Each track has up to 4 segments

      // 1. Fade-In segment (if enabled)
      if (hasFadeIn) {
        const fadeInPath = path.join(workDir, `track${trackNum}_fadein.mp4`)
        tempFiles.push(fadeInPath)
        
        log.info(`  🎬 Creating Fade-In segment (${fadeDuration}s)...`)
        await createFadeInSegment(imagePath, audioFile, fadeInPath, fadeDuration)
        
        allSegments.push({
          path: fadeInPath,
          type: 'fade-in',
          duration: fadeDuration
        })
        
        if (onProgress) onProgress(Math.round(trackProgress + progressPerSegment))
      }

      // 2. Body segment (FAST - no filters!)
      if (bodyDuration > 0) {
        const bodyPath = path.join(workDir, `track${trackNum}_body.mp4`)
        tempFiles.push(bodyPath)
        
        log.info(`  ⚡ Creating Body segment (${bodyDuration.toFixed(1)}s) - FAST MODE!`)
        await createBodySegment(baseSegmentPath, audioFile, bodyPath, bodyStart, bodyDuration)
        
        allSegments.push({
          path: bodyPath,
          type: 'body',
          duration: bodyDuration
        })
        
        if (onProgress) onProgress(Math.round(trackProgress + progressPerSegment * 2))
      }

      // 3. Fade-Out segment (if enabled)
      if (hasFadeOut) {
        const fadeOutPath = path.join(workDir, `track${trackNum}_fadeout.mp4`)
        tempFiles.push(fadeOutPath)
        
        log.info(`  🎬 Creating Fade-Out segment (${fadeDuration}s)...`)
        await createFadeOutSegment(imagePath, audioFile, fadeOutPath, fadeOutStart, fadeDuration)
        
        allSegments.push({
          path: fadeOutPath,
          type: 'fade-out',
          duration: fadeDuration
        })
        
        if (onProgress) onProgress(Math.round(trackProgress + progressPerSegment * 3))
      }

      // 4. Padding segment (if enabled and not last track)
      if (enablePadding && paddingSegmentPath && i < audioFiles.length - 1) {
        log.info(`  📏 Adding Padding segment (${paddingDuration}s)`)
        allSegments.push({
          path: paddingSegmentPath,
          type: 'padding',
          duration: paddingDuration
        })
      }

      if (onProgress) onProgress(Math.round(trackProgress + progressPerSegment * 4))
    }

    // Final concatenation using stream copy
    log.info(`\n🔗 Concatenating ${allSegments.length} segments using STREAM COPY...`)
    log.info(`⚡ This will be VERY fast (no re-encoding!)`)
    
    await concatenateSegments(allSegments, outputPath, (p) => {
      if (onProgress) {
        onProgress(90 + Math.round(p / 10))  // 90-100%
      }
    })

    // Cleanup temp files
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        try {
          safeRmSync(tempFile)
          log.info(`🗑️  Cleaned up: ${path.basename(tempFile)}`)
        } catch (e) {
          log.warn(`Failed to delete temp file: ${tempFile}`)
        }
      }
    }

    if (onProgress) onProgress(100)
    log.info(`\n✅ Playlist generation completed successfully!`)
    log.info(`📹 Output: ${outputPath}`)
    
    return outputPath

  } catch (error) {
    // Cleanup on error
    for (const tempFile of tempFiles) {
      if (fs.existsSync(tempFile)) {
        try {
          safeRmSync(tempFile)
        } catch (e) {
          // Ignore
        }
      }
    }
    throw error
  }
}

/**
 * Check if playlist should use segmented optimization
 * 
 * Conditions:
 * - Multiple audio files (>= 2)
 * - Fade or Padding enabled
 * - Total duration > 5 minutes (worth the optimization)
 */
export async function shouldUseSegmentedOptimization(
  audioFiles: string[],
  enableFadeOut: boolean,
  enablePadding: boolean
): Promise<boolean> {
  if (audioFiles.length < 2) {
    return false
  }

  if (!enableFadeOut && !enablePadding) {
    return false  // Already using stream copy
  }

  // Check total duration
  let totalDuration = 0
  for (const audioFile of audioFiles) {
    try {
      const duration = await getAudioDuration(audioFile)
      totalDuration += duration
    } catch (e) {
      log.warn(`Failed to get duration for ${audioFile}, assuming optimization is worth it`)
      return true
    }
  }

  // Use segmented optimization if total > 5 minutes
  return totalDuration > 300
}

