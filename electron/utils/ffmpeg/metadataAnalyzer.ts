/**
 * Video and audio metadata analysis using FFprobe
 * 
 * Provides functions to extract metadata from media files
 * for validation, duration calculation, and specification analysis.
 */

import ffmpeg from 'fluent-ffmpeg'
import { VideoMetadata, AudioValidationResult, FfmpegMetadata } from './types.js'
import { log } from '../logger.js'
import path from 'node:path'
import fs from 'node:fs'

/**
 * Get video duration in seconds
 */
export async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        log.error('FFprobe Error (Duration):', err)
        reject(new Error(`Failed to get video duration: ${err.message}`))
        return
      }
      const duration = metadata.format.duration || 0
      resolve(duration)
    })
  })
}

/**
 * Get full video metadata
 */
export async function getVideoMetadata(videoPath: string): Promise<VideoMetadata> {
  return new Promise<VideoMetadata>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        log.error('FFprobe Error (Metadata):', err)
        reject(new Error(`Failed to get video metadata: ${err.message}`))
        return
      }
      resolve(metadata as VideoMetadata)
    })
  })
}

/**
 * Validate audio file and get duration
 */
export async function validateAudioFile(audioPath: string): Promise<AudioValidationResult> {
  const normalizedPath = path.resolve(audioPath)
  
  if (!fs.existsSync(normalizedPath)) {
    return { valid: false, duration: 0, error: `File not found: ${normalizedPath}` }
  }

  return new Promise<AudioValidationResult>((resolve) => {
    ffmpeg.ffprobe(normalizedPath, (err, metadata) => {
      if (err) {
        // Retry with ffmpeg if ffprobe fails
        const tempCommand = ffmpeg(normalizedPath)
        tempCommand.ffprobe((probeErr: Error | null, probeMetadata: FfmpegMetadata | undefined) => {
          if (probeErr) {
            // If both methods fail, file may be corrupted or in unsupported format
            log.warn(`Audio file validation failed: ${normalizedPath}`, probeErr.message)
            resolve({ 
              valid: false, 
              duration: 0, 
              error: `Cannot read audio file: ${path.basename(normalizedPath)}. File may be corrupted or in an unsupported format.` 
            })
          } else {
            resolve({ valid: true, duration: probeMetadata.format.duration || 0 })
          }
        })
        return
      }
      resolve({ valid: true, duration: metadata.format.duration || 0 })
    })
  })
}

/**
 * Get audio duration in seconds
 */
export async function getAudioDuration(audioPath: string): Promise<number> {
  const validation = await validateAudioFile(audioPath)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid audio file')
  }
  return validation.duration
}

