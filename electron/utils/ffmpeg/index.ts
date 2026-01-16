/**
 * FFmpeg utilities - Main export file
 * 
 * This module provides abstracted FFmpeg operations for video and audio processing.
 * All FFmpeg-related code should be accessed through this module.
 */

// Configuration
export { initializeFfmpeg, getFfmpegPath, getFfprobePath } from './config.js'

// Metadata analysis
export {
  getVideoDuration,
  getVideoMetadata,
  validateAudioFile,
  getAudioDuration
} from './metadataAnalyzer.js'

// Audio processing
export {
  applyFadeOut,
  concatenateAudios
} from './audioProcessor.js'

// Video processing
export {
  loopVideo,
  createVideoFromImage,
  getSafeOutputPath,
  cleanupTempFiles,
  extractFirstFrameAsThumbnail
} from './videoProcessor.js'

// Types
export type {
  ProgressCallback,
  FfmpegCommand,
  VideoMetadata,
  AudioValidationResult,
  VideoProcessingOptions,
  ConcatOptions
} from './types.js'

