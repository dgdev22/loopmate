/**
 * Common types for FFmpeg operations
 */

/**
 * Progress callback for FFmpeg operations
 */
export interface ProgressCallback {
  (progress: number): void
}

/**
 * FFmpeg progress event data
 */
export interface FfmpegProgress {
  percent?: number
  timemark?: string
  frames?: number
  currentKbps?: number
  targetSize?: number
}

/**
 * FFmpeg stream metadata
 */
export interface FfmpegStream {
  codec_type: string
  codec_name?: string
  width?: number
  height?: number
  r_frame_rate?: string
  sample_rate?: number
  pix_fmt?: string
  [key: string]: unknown
}

/**
 * FFmpeg format metadata
 */
export interface FfmpegFormat {
  duration?: number
  [key: string]: unknown
}

/**
 * FFmpeg metadata from ffprobe
 */
export interface FfmpegMetadata {
  format: FfmpegFormat
  streams: FfmpegStream[]
}

/**
 * FFmpeg command wrapper with progress tracking
 */
export interface FfmpegCommand {
  on(event: 'progress', callback: (progress: FfmpegProgress) => void): FfmpegCommand
  on(event: 'end', callback: () => void): FfmpegCommand
  on(event: 'error', callback: (err: Error, stdout?: string, stderr?: string) => void): FfmpegCommand
  save(outputPath: string): void
  kill(signal?: string): void
}

/**
 * Video metadata from ffprobe
 */
export interface VideoMetadata {
  format: FfmpegFormat
  streams: FfmpegStream[]
}

/**
 * Audio validation result
 */
export interface AudioValidationResult {
  valid: boolean
  duration: number
  error?: string
}

/**
 * Video processing options
 */
export interface VideoProcessingOptions {
  tempDir?: string
}

/**
 * Concat processing options
 */
export interface ConcatOptions {
  enablePadding?: boolean
  paddingDuration?: number
  enableFadeOut?: boolean
  fadeOutDuration?: number
  enableFadeIn?: boolean
}

