/**
 * Error Code System
 * 
 * Centralized error codes for the application.
 * Each error code is a numeric identifier that maps to user-friendly messages.
 * 
 * Error Code Ranges:
 * - 1000-1999: General/System Errors
 * - 2000-2999: File/Disk Errors
 * - 3000-3999: Video Processing Errors
 * - 4000-4999: Audio Processing Errors
 * - 5000-5999: Image Processing Errors
 * - 6000-6999: FFmpeg/FFprobe Errors
 * - 7000-7999: Validation Errors
 * - 8000-8999: IPC/Communication Errors
 */

export enum ErrorCode {
  // General/System Errors (1000-1999)
  UNKNOWN_ERROR = 1000,
  INTERNAL_ERROR = 1001,
  OPERATION_CANCELLED = 1002,
  
  // File/Disk Errors (2000-2999)
  FILE_NOT_FOUND = 2001,
  FILE_ACCESS_DENIED = 2002,
  FILE_READ_ERROR = 2003,
  FILE_WRITE_ERROR = 2004,
  INVALID_FILE_PATH = 2005,
  FILE_CORRUPTED = 2006,
  
  // Video Processing Errors (3000-3999)
  VIDEO_PROCESSING_FAILED = 3001,
  VIDEO_CONCAT_FAILED = 3002,
  VIDEO_LOOP_FAILED = 3003,
  VIDEO_METADATA_ERROR = 3004,
  VIDEO_ENCODING_ERROR = 3005,
  
  // Audio Processing Errors (4000-4999)
  AUDIO_NOT_FOUND = 4001,
  AUDIO_CORRUPTED = 4002,
  AUDIO_MERGE_FAILED = 4003,
  AUDIO_PROCESSING_FAILED = 4004,
  AUDIO_METADATA_ERROR = 4005,
  AUDIO_VALIDATION_FAILED = 4006,
  
  // Image Processing Errors (5000-5999)
  IMAGE_NOT_FOUND = 5001,
  IMAGE_INVALID_FORMAT = 5002,
  IMAGE_PROCESSING_FAILED = 5003,
  IMAGE_VALIDATION_FAILED = 5004,
  
  // FFmpeg/FFprobe Errors (6000-6999)
  FFMPEG_NOT_FOUND = 6001,
  FFPROBE_ERROR = 6002,
  FFMPEG_ENCODING_ERROR = 6003,
  FFMPEG_TIMEOUT = 6004,
  
  // Validation Errors (7000-7999)
  INVALID_PARAMETERS = 7001,
  INVALID_FILE_EXTENSION = 7002,
  INVALID_INPUT = 7003,
  
  // IPC/Communication Errors (8000-8999)
  IPC_ERROR = 8001,
  RENDERER_ERROR = 8002,
}

/**
 * Error Code Information
 */
export interface ErrorCodeInfo {
  code: ErrorCode
  messageKey: string
  defaultMessage: string
}

/**
 * Error Code Registry
 * Maps error codes to their information
 */
export const ERROR_CODE_REGISTRY: Record<ErrorCode, ErrorCodeInfo> = {
  [ErrorCode.UNKNOWN_ERROR]: {
    code: ErrorCode.UNKNOWN_ERROR,
    messageKey: 'errors.unknownError',
    defaultMessage: 'An unknown error occurred'
  },
  [ErrorCode.INTERNAL_ERROR]: {
    code: ErrorCode.INTERNAL_ERROR,
    messageKey: 'errors.internalError',
    defaultMessage: 'An internal error occurred'
  },
  [ErrorCode.OPERATION_CANCELLED]: {
    code: ErrorCode.OPERATION_CANCELLED,
    messageKey: 'errors.operationCancelled',
    defaultMessage: 'Operation was cancelled'
  },
  [ErrorCode.FILE_NOT_FOUND]: {
    code: ErrorCode.FILE_NOT_FOUND,
    messageKey: 'errors.fileNotFound',
    defaultMessage: 'File not found'
  },
  [ErrorCode.FILE_ACCESS_DENIED]: {
    code: ErrorCode.FILE_ACCESS_DENIED,
    messageKey: 'errors.fileAccessDenied',
    defaultMessage: 'Access to file denied'
  },
  [ErrorCode.FILE_READ_ERROR]: {
    code: ErrorCode.FILE_READ_ERROR,
    messageKey: 'errors.fileReadError',
    defaultMessage: 'Failed to read file'
  },
  [ErrorCode.FILE_WRITE_ERROR]: {
    code: ErrorCode.FILE_WRITE_ERROR,
    messageKey: 'errors.fileWriteError',
    defaultMessage: 'Failed to write file'
  },
  [ErrorCode.INVALID_FILE_PATH]: {
    code: ErrorCode.INVALID_FILE_PATH,
    messageKey: 'errors.invalidFilePath',
    defaultMessage: 'Invalid file path'
  },
  [ErrorCode.FILE_CORRUPTED]: {
    code: ErrorCode.FILE_CORRUPTED,
    messageKey: 'errors.fileCorrupted',
    defaultMessage: 'File is corrupted'
  },
  [ErrorCode.VIDEO_PROCESSING_FAILED]: {
    code: ErrorCode.VIDEO_PROCESSING_FAILED,
    messageKey: 'errors.videoProcessingFailed',
    defaultMessage: 'Video processing failed'
  },
  [ErrorCode.VIDEO_CONCAT_FAILED]: {
    code: ErrorCode.VIDEO_CONCAT_FAILED,
    messageKey: 'errors.videoConcatFailed',
    defaultMessage: 'Video concatenation failed'
  },
  [ErrorCode.VIDEO_LOOP_FAILED]: {
    code: ErrorCode.VIDEO_LOOP_FAILED,
    messageKey: 'errors.videoLoopFailed',
    defaultMessage: 'Video looping failed'
  },
  [ErrorCode.VIDEO_METADATA_ERROR]: {
    code: ErrorCode.VIDEO_METADATA_ERROR,
    messageKey: 'errors.videoMetadataError',
    defaultMessage: 'Failed to read video metadata'
  },
  [ErrorCode.VIDEO_ENCODING_ERROR]: {
    code: ErrorCode.VIDEO_ENCODING_ERROR,
    messageKey: 'errors.videoEncodingError',
    defaultMessage: 'Video encoding failed'
  },
  [ErrorCode.AUDIO_NOT_FOUND]: {
    code: ErrorCode.AUDIO_NOT_FOUND,
    messageKey: 'errors.audioNotFound',
    defaultMessage: 'Audio file not found'
  },
  [ErrorCode.AUDIO_CORRUPTED]: {
    code: ErrorCode.AUDIO_CORRUPTED,
    messageKey: 'errors.audioCorrupted',
    defaultMessage: 'Audio file is corrupted or in unsupported format'
  },
  [ErrorCode.AUDIO_MERGE_FAILED]: {
    code: ErrorCode.AUDIO_MERGE_FAILED,
    messageKey: 'errors.audioMergeFailed',
    defaultMessage: 'Failed to merge audio files'
  },
  [ErrorCode.AUDIO_PROCESSING_FAILED]: {
    code: ErrorCode.AUDIO_PROCESSING_FAILED,
    messageKey: 'errors.audioProcessingFailed',
    defaultMessage: 'Audio processing failed'
  },
  [ErrorCode.AUDIO_METADATA_ERROR]: {
    code: ErrorCode.AUDIO_METADATA_ERROR,
    messageKey: 'errors.audioMetadataError',
    defaultMessage: 'Failed to read audio metadata'
  },
  [ErrorCode.AUDIO_VALIDATION_FAILED]: {
    code: ErrorCode.AUDIO_VALIDATION_FAILED,
    messageKey: 'errors.audioValidationFailed',
    defaultMessage: 'Audio file validation failed'
  },
  [ErrorCode.IMAGE_NOT_FOUND]: {
    code: ErrorCode.IMAGE_NOT_FOUND,
    messageKey: 'errors.imageNotFound',
    defaultMessage: 'Image file not found'
  },
  [ErrorCode.IMAGE_INVALID_FORMAT]: {
    code: ErrorCode.IMAGE_INVALID_FORMAT,
    messageKey: 'errors.imageInvalidFormat',
    defaultMessage: 'Invalid image format'
  },
  [ErrorCode.IMAGE_PROCESSING_FAILED]: {
    code: ErrorCode.IMAGE_PROCESSING_FAILED,
    messageKey: 'errors.imageProcessingFailed',
    defaultMessage: 'Image processing failed'
  },
  [ErrorCode.IMAGE_VALIDATION_FAILED]: {
    code: ErrorCode.IMAGE_VALIDATION_FAILED,
    messageKey: 'errors.imageValidationFailed',
    defaultMessage: 'Image file validation failed'
  },
  [ErrorCode.FFMPEG_NOT_FOUND]: {
    code: ErrorCode.FFMPEG_NOT_FOUND,
    messageKey: 'errors.ffmpegNotFound',
    defaultMessage: 'FFmpeg not found'
  },
  [ErrorCode.FFPROBE_ERROR]: {
    code: ErrorCode.FFPROBE_ERROR,
    messageKey: 'errors.ffprobeError',
    defaultMessage: 'FFprobe error occurred'
  },
  [ErrorCode.FFMPEG_ENCODING_ERROR]: {
    code: ErrorCode.FFMPEG_ENCODING_ERROR,
    messageKey: 'errors.ffmpegEncodingError',
    defaultMessage: 'FFmpeg encoding error'
  },
  [ErrorCode.FFMPEG_TIMEOUT]: {
    code: ErrorCode.FFMPEG_TIMEOUT,
    messageKey: 'errors.ffmpegTimeout',
    defaultMessage: 'FFmpeg operation timed out'
  },
  [ErrorCode.INVALID_PARAMETERS]: {
    code: ErrorCode.INVALID_PARAMETERS,
    messageKey: 'errors.invalidParameters',
    defaultMessage: 'Invalid parameters provided'
  },
  [ErrorCode.INVALID_FILE_EXTENSION]: {
    code: ErrorCode.INVALID_FILE_EXTENSION,
    messageKey: 'errors.invalidFileExtension',
    defaultMessage: 'Invalid file extension'
  },
  [ErrorCode.INVALID_INPUT]: {
    code: ErrorCode.INVALID_INPUT,
    messageKey: 'errors.invalidInput',
    defaultMessage: 'Invalid input'
  },
  [ErrorCode.IPC_ERROR]: {
    code: ErrorCode.IPC_ERROR,
    messageKey: 'errors.ipcError',
    defaultMessage: 'IPC communication error'
  },
  [ErrorCode.RENDERER_ERROR]: {
    code: ErrorCode.RENDERER_ERROR,
    messageKey: 'errors.rendererError',
    defaultMessage: 'Renderer process error'
  },
}

/**
 * Application Error Class with Error Code
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly originalError?: Error

  constructor(code: ErrorCode, message?: string, originalError?: Error) {
    const errorInfo = ERROR_CODE_REGISTRY[code]
    const errorMessage = message || errorInfo.defaultMessage
    super(errorMessage)
    this.name = 'AppError'
    this.code = code
    this.originalError = originalError
  }

  /**
   * Get error code as string (e.g., "2001")
   */
  getCodeString(): string {
    return String(this.code)
  }

  /**
   * Get translation key for this error
   */
  getTranslationKey(): string {
    return ERROR_CODE_REGISTRY[this.code].messageKey
  }
}

/**
 * Create an AppError from a code
 */
export function createError(code: ErrorCode, message?: string, originalError?: Error): AppError {
  return new AppError(code, message, originalError)
}

/**
 * Extract error code from error object
 */
export function extractErrorCode(error: unknown): ErrorCode {
  if (error instanceof AppError) {
    return error.code
  }
  return ErrorCode.UNKNOWN_ERROR
}

/**
 * Serialize error for IPC communication
 * Formats error with code prefix that can be parsed by renderer
 */
export function serializeErrorForIPC(error: unknown, code?: ErrorCode): string {
  const errorCode = code || extractErrorCode(error)
  const message = error instanceof Error ? error.message : String(error)
  return `[ERROR_CODE:${errorCode}] ${message}`
}

/**
 * Parse error code from serialized error message
 * Returns {code, message} or null if no code found
 */
export function parseErrorFromIPC(errorMessage: string): { code: number | null; message: string } {
  const match = errorMessage.match(/^\[ERROR_CODE:(\d+)\]\s*(.*)$/)
  if (match) {
    return {
      code: parseInt(match[1], 10),
      message: match[2]
    }
  }
  return {
    code: null,
    message: errorMessage
  }
}

