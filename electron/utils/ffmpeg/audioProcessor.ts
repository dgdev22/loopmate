/**
 * Audio processing operations
 * 
 * Handles audio file operations: validation, fading, concatenation
 */

import ffmpeg from 'fluent-ffmpeg'
import path from 'node:path'
import fs from 'node:fs'
import { validateAudioFile } from './metadataAnalyzer.js'
import { log } from '../logger.js'
import { ProgressCallback } from './types.js'
import { safeRmSync } from '../fsSafe.js'

/**
 * Apply fade out to audio file
 */
export async function applyFadeOut(
  audioPath: string,
  fadeOutDuration: number,
  outputPath: string,
  audioBitrate: string = '192k',
  onProgress?: ProgressCallback
): Promise<void> {
  const validation = await validateAudioFile(audioPath)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid audio file')
  }

  const duration = validation.duration
  
  if (duration <= fadeOutDuration) {
    // Duration is too short for fade out, just copy the file
    fs.copyFileSync(audioPath, outputPath)
    return
  }

  const fadeOutStart = duration - fadeOutDuration

  return new Promise<void>((resolve, reject) => {
    ffmpeg(audioPath)
      .audioFilters([`afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}`])
      .outputOptions(['-c:a', 'libmp3lame', '-b:a', audioBitrate])
      .on('progress', (p) => {
        if (onProgress) {
          onProgress(p.percent || 0)
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => {
        log.error(`FFmpeg Error (Fade Audio):`, err)
        reject(new Error(`Fade processing failed: ${path.basename(audioPath)}`))
      })
      .save(outputPath)
  })
}

/**
 * Fast concatenation using concat demuxer with re-encoding
 * Re-encodes to ensure compatibility when audio files have different parameters
 */
async function concatenateAudiosStreamCopy(
  audioPaths: string[],
  outputPath: string,
  audioBitrate: string = '256k',
  onProgress?: ProgressCallback,
  tempDir?: string
): Promise<void> {
  const workDir = tempDir || path.dirname(path.resolve(audioPaths[0]))
  const concatListPath = path.join(workDir, `audio_concat_${Date.now()}.txt`)
  
  try {
    // Create concat list file
    const normalizedPaths = audioPaths.map(p => path.resolve(p))
    const concatList = normalizedPaths
      .map(p => {
        // Escape path for FFmpeg concat demuxer
        const escapedPath = p.replace(/\\/g, '/').replace(/'/g, "'\\''")
        return `file '${escapedPath}'`
      })
      .join('\n')
    
    fs.writeFileSync(concatListPath, concatList, 'utf-8')
    log.info('[AudioProcessor] Concat list created:', concatListPath)
    log.info('[AudioProcessor] Concatenating', audioPaths.length, 'audio files with fast concat')

    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions([
          '-c:a', 'libmp3lame',    // Use MP3 codec
          '-b:a', audioBitrate,    // Audio bitrate
          '-ar', '48000',          // Sample rate
          '-ac', '2'               // Stereo
        ])
        .on('progress', (p) => {
          if (onProgress) {
            onProgress(p.percent || 0)
          }
        })
        .on('end', () => {
          // Cleanup concat list
          if (fs.existsSync(concatListPath)) {
            try {
              safeRmSync(concatListPath)
            } catch (e) {
              log.error('Failed to delete concat list:', concatListPath, e)
            }
          }
          log.info('[AudioProcessor] Fast concat completed')
          resolve()
        })
        .on('error', (err, stdout, stderr) => {
          log.error('FFmpeg Error (Fast Concat Audio):', err)
          log.error('FFmpeg stderr:', stderr)
          
          // Cleanup concat list on error
          if (fs.existsSync(concatListPath)) {
            try {
              safeRmSync(concatListPath)
            } catch (e) {
              log.error('Failed to delete concat list:', concatListPath, e)
            }
          }
          
          reject(new Error(`Fast audio merge failed: ${err.message}\n${stderr || ''}`))
        })
        .save(outputPath)
    })
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(concatListPath)) {
      try {
        safeRmSync(concatListPath)
      } catch (e) {
        log.error('Failed to delete concat list:', concatListPath, e)
      }
    }
    throw error
  }
}

/**
 * Concatenate multiple audio files
 * Uses fast stream copy when no effects are applied, re-encodes only when necessary
 */
export async function concatenateAudios(
  audioPaths: string[],
  outputPath: string,
  options: {
    enablePadding?: boolean
    paddingDuration?: number
    enableFadeOut?: boolean
    fadeOutDuration?: number
    audioBitrate?: string  // e.g., '192k', '256k', '320k'
    tempDir?: string
    onProgress?: ProgressCallback
  } = {}
): Promise<void> {
  const { 
    enablePadding = false, 
    paddingDuration = 3, 
    enableFadeOut = false, 
    fadeOutDuration = 2,
    audioBitrate = '192k',
    tempDir,
    onProgress 
  } = options

  // Validate all audio files first
  const invalidFiles: string[] = []
  for (const audioPath of audioPaths) {
    const normalizedPath = path.resolve(audioPath)
    const validation = await validateAudioFile(normalizedPath)
    if (!validation.valid) {
      invalidFiles.push(path.basename(normalizedPath))
    }
  }

  if (invalidFiles.length > 0) {
    throw new Error(`Processing failed due to corrupted file.\nProblematic files: ${invalidFiles.join(', ')}`)
  }

  // FAST PATH: No effects - use concat demuxer with re-encoding
  if (!enablePadding && !enableFadeOut && audioPaths.length > 1) {
    log.info('[AudioProcessor] Using fast concat - no effects')
    return concatenateAudiosStreamCopy(audioPaths, outputPath, audioBitrate, onProgress, tempDir)
  }

  // EFFECTS PATH: filter_complex with re-encoding (fade / padding)
  log.info('[AudioProcessor] Using filter_complex concat with effects')
  log.info(`[AudioProcessor] Options: enablePadding=${enablePadding}, paddingDuration=${paddingDuration}, enableFadeOut=${enableFadeOut}, fadeOutDuration=${fadeOutDuration}`)

  const processedAudioPaths: string[] = audioPaths.map(p => path.resolve(p))

  // We need durations to:
  // - compute fade-out start times
  // - compute total duration for progress (timemark-based)
  log.info('[AudioProcessor] Getting audio durations (parallel)...')
  const startTime = Date.now()
  const validations = await Promise.all(processedAudioPaths.map(p => validateAudioFile(p)))
  const durations = validations.map(v => v.duration)
  const totalContentDuration = durations.reduce((sum, d) => sum + d, 0)
  const totalPaddingDuration = enablePadding ? Math.max(0, (processedAudioPaths.length - 1) * paddingDuration) : 0
  const totalDuration = totalContentDuration + totalPaddingDuration
  log.info(`[AudioProcessor] ✅ Got ${durations.length} durations in ${((Date.now() - startTime) / 1000).toFixed(1)}s. Total ~${totalDuration.toFixed(2)}s`)
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    throw new Error(`[AudioProcessor] Invalid total duration: ${totalDuration}`)
  }

  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg()

    // Add all audio inputs
    processedAudioPaths.forEach(audioPath => command.input(audioPath))

    // Build filter_complex (NO extra lavfi inputs).
    // Important: Generate finite-duration silence segments inside filtergraph to avoid "infinite audio" bugs.
    const filterParts: string[] = []
    const streamLabels: string[] = []

    // Normalize each input to stereo @ 44100Hz to keep concat stable
    for (let i = 0; i < processedAudioPaths.length; i++) {
      const baseLabel = `p${i}`
      filterParts.push(`[${i}:a]aresample=44100,aformat=channel_layouts=stereo[${baseLabel}]`)

      if (enableFadeOut && durations[i] > fadeOutDuration) {
        const fadeOutStart = Math.max(0, durations[i] - fadeOutDuration)
        filterParts.push(`[${baseLabel}]afade=t=out:st=${fadeOutStart}:d=${fadeOutDuration}[a${i}]`)
        streamLabels.push(`[a${i}]`)
      } else {
        streamLabels.push(`[${baseLabel}]`)
      }
    }

    const concatInputs: string[] = []
    for (let i = 0; i < streamLabels.length; i++) {
      concatInputs.push(streamLabels[i])

      if (enablePadding && paddingDuration > 0 && i < streamLabels.length - 1) {
        const sLabel = `s${i}`
        // Generate silence and trim to exact duration
        filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${paddingDuration},asetpts=PTS-STARTPTS[${sLabel}]`)
        concatInputs.push(`[${sLabel}]`)
      }
    }

    const concatN = concatInputs.length
    // Concatenate all segments
    filterParts.push(`${concatInputs.join('')}concat=n=${concatN}:v=0:a=1[outa_raw]`)
    // SAFETY: Force final duration to the expected total (prevents runaway hours-long output)
    filterParts.push(`[outa_raw]atrim=duration=${totalDuration},asetpts=PTS-STARTPTS[outa]`)

    const filterComplex = filterParts.join(';')
    log.info('[AudioProcessor] Filter complex:', filterComplex)

    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[outa]',
        '-c:a', 'libmp3lame',
        '-b:a', audioBitrate,
        '-ar', '44100',
        '-ac', '2'
      ])
      .on('progress', (p) => {
        if (!onProgress) return

        // Prefer timemark-based progress; percent is often missing for filter_complex audio.
        if (p.timemark && totalDuration > 0) {
          const timeParts = String(p.timemark).split(':')
          if (timeParts.length === 3) {
            const currentSeconds =
              parseInt(timeParts[0]) * 3600 +
              parseInt(timeParts[1]) * 60 +
              parseFloat(timeParts[2])
            const progressPercent = Math.round((currentSeconds / totalDuration) * 100)
            onProgress(Math.max(0, Math.min(progressPercent, 99)))
            return
          }
        }

        // Fallback: use reported percent if present
        onProgress(Math.max(0, Math.min(p.percent || 0, 99)))
      })
      .on('end', () => {
        log.info('[AudioProcessor] ✅ Audio concatenation completed')
        onProgress?.(100)
        resolve()
      })
      .on('error', (err, stdout, stderr) => {
        log.error('[AudioProcessor] FFmpeg Error (Concat Audio):', err)
        log.error('[AudioProcessor] FFmpeg stderr:', stderr)
        log.error('[AudioProcessor] Audio paths:', audioPaths)
        log.error('[AudioProcessor] Options:', { enablePadding, paddingDuration, enableFadeOut, fadeOutDuration })
        reject(new Error(`Audio concatenation failed: ${err.message}\n${stderr || ''}`))
      })
      .save(outputPath)
  })
}

