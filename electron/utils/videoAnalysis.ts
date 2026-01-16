/**
 * Video file analysis utilities for Smart Concat
 * 
 * This module provides functions to analyze video file specifications
 * (resolution, codec, sample rate) to determine if files are compatible
 * for stream copy or require re-encoding.
 */

import ffmpeg from 'fluent-ffmpeg'
import ffprobePath from 'ffprobe-static'

// Set ffprobe path
if (ffprobePath && ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path)
}

/**
 * Video file specification interface
 */
export interface VideoSpec {
  width: number
  height: number
  videoCodec: string
  audioCodec: string
  audioSampleRate: number
  pixelFormat: string
  frameRate: number
  duration: number
}

/**
 * Analysis result interface
 */
export interface AnalysisResult {
  specs: VideoSpec[]
  allMatch: boolean
  targetSpec: VideoSpec | null
  requiresReencoding: boolean
  mismatches: string[]
}

/**
 * Parse frame rate string (e.g., "30/1" or "29.97") to number
 */
function parseFrameRate(frameRate: string | undefined): number {
  if (!frameRate) return 30 // Default
  
  // Handle fraction format (e.g., "30/1", "30000/1001")
  if (frameRate.includes('/')) {
    const [num, den] = frameRate.split('/').map(Number)
    if (den && den !== 0) {
      return num / den
    }
  }
  
  // Handle decimal format
  const parsed = parseFloat(frameRate)
  return isNaN(parsed) ? 30 : parsed
}

/**
 * Analyze a single video file to extract its specifications
 * 
 * @param videoPath - Path to the video file
 * @returns Promise resolving to VideoSpec
 */
export async function analyzeVideoFile(videoPath: string): Promise<VideoSpec> {
  return new Promise<VideoSpec>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to analyze video file: ${err.message}`))
        return
      }

      const videoStream = metadata.streams?.find((s) => s.codec_type === 'video')
      const audioStream = metadata.streams?.find((s) => s.codec_type === 'audio')

      if (!videoStream) {
        reject(new Error('No video stream found in file'))
        return
      }

      const spec: VideoSpec = {
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        videoCodec: videoStream.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'none',
        audioSampleRate: audioStream?.sample_rate ? parseInt(String(audioStream.sample_rate)) : 0,
        pixelFormat: videoStream.pix_fmt || 'unknown',
        frameRate: parseFrameRate(videoStream.r_frame_rate),
        duration: metadata.format?.duration || 0
      }

      resolve(spec)
    })
  })
}

/**
 * Compare two video specifications
 * 
 * @param spec1 - First video spec
 * @param spec2 - Second video spec
 * @returns Array of mismatch descriptions (empty if all match)
 */
function compareSpecs(spec1: VideoSpec, spec2: VideoSpec): string[] {
  const mismatches: string[] = []

  if (spec1.width !== spec2.width || spec1.height !== spec2.height) {
    mismatches.push(`Resolution: ${spec1.width}x${spec1.height} vs ${spec2.width}x${spec2.height}`)
  }

  if (spec1.videoCodec !== spec2.videoCodec) {
    mismatches.push(`Video codec: ${spec1.videoCodec} vs ${spec2.videoCodec}`)
  }

  if (spec1.audioCodec !== spec2.audioCodec) {
    mismatches.push(`Audio codec: ${spec1.audioCodec} vs ${spec2.audioCodec}`)
  }

  // Allow small differences in sample rate (within 100 Hz)
  if (Math.abs(spec1.audioSampleRate - spec2.audioSampleRate) > 100) {
    mismatches.push(`Audio sample rate: ${spec1.audioSampleRate}Hz vs ${spec2.audioSampleRate}Hz`)
  }

  // Allow small differences in frame rate (within 0.1 fps)
  if (Math.abs(spec1.frameRate - spec2.frameRate) > 0.1) {
    mismatches.push(`Frame rate: ${spec1.frameRate.toFixed(2)}fps vs ${spec2.frameRate.toFixed(2)}fps`)
  }

  if (spec1.pixelFormat !== spec2.pixelFormat) {
    mismatches.push(`Pixel format: ${spec1.pixelFormat} vs ${spec2.pixelFormat}`)
  }

  return mismatches
}

/**
 * Analyze multiple video files and determine if they are compatible for stream copy
 * 
 * @param videoPaths - Array of video file paths
 * @returns Promise resolving to AnalysisResult
 */
export async function analyzeFileSpecs(videoPaths: string[]): Promise<AnalysisResult> {
  if (videoPaths.length === 0) {
    throw new Error('No video files provided')
  }

  // Analyze all files
  const specs: VideoSpec[] = []
  for (const videoPath of videoPaths) {
    try {
      const spec = await analyzeVideoFile(videoPath)
      specs.push(spec)
    } catch (error) {
      throw new Error(`Failed to analyze ${videoPath}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Use first video as target spec
  const targetSpec = specs[0]

  // Compare all specs against the first one
  const allMismatches: string[] = []
  let allMatch = true

  for (let i = 1; i < specs.length; i++) {
    const mismatches = compareSpecs(targetSpec, specs[i])
    if (mismatches.length > 0) {
      allMatch = false
      allMismatches.push(`File ${i + 1}: ${mismatches.join(', ')}`)
    }
  }

  return {
    specs,
    allMatch,
    targetSpec,
    requiresReencoding: !allMatch,
    mismatches: allMismatches
  }
}

/**
 * Format analysis result for logging
 */
export function formatAnalysisResult(result: AnalysisResult): string {
  if (result.allMatch) {
    return 'All video files have matching specifications. Stream copy mode can be used.'
  }

  let message = 'Video files have mismatched specifications. Re-encoding mode will be used.\n'
  message += `Target specification (from first file):\n`
  message += `  Resolution: ${result.targetSpec?.width}x${result.targetSpec?.height}\n`
  message += `  Video codec: ${result.targetSpec?.videoCodec}\n`
  message += `  Audio codec: ${result.targetSpec?.audioCodec}\n`
  message += `  Audio sample rate: ${result.targetSpec?.audioSampleRate}Hz\n`
  message += `  Frame rate: ${result.targetSpec?.frameRate.toFixed(2)}fps\n\n`
  message += `Mismatches:\n${result.mismatches.map(m => `  - ${m}`).join('\n')}`

  return message
}

