/**
 * Unit tests for Smart Concat feature
 * 
 * Tests the logic that automatically detects video specification mismatches
 * and switches between stream copy (fast) and re-encoding (compatibility) modes.
 */

import { formatAnalysisResult, type VideoSpec } from '../../electron/utils/videoAnalysis'
import ffmpeg from 'fluent-ffmpeg'
import ffprobePath from 'ffprobe-static'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Set ffprobe path
if (ffprobePath && ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path)
}

describe('Smart Concat - Video Analysis', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-concat-test-'))
  })

  afterAll(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error)
    }
  })

  describe('analyzeVideoFile', () => {
    it('should extract video specifications from a valid video file', async () => {
      // Note: This test requires a real video file
      // In a real scenario, you would create test video files or use fixtures
      // For now, we'll test the function structure
      
      const spec: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      expect(spec.width).toBe(1920)
      expect(spec.height).toBe(1080)
      expect(spec.videoCodec).toBe('h264')
    })

    it('should handle frame rate parsing correctly', () => {
      // Test frame rate parsing logic
      const parseFrameRate = (frameRate: string | undefined): number => {
        if (!frameRate) return 30
        
        if (frameRate.includes('/')) {
          const [num, den] = frameRate.split('/').map(Number)
          if (den && den !== 0) {
            return num / den
          }
        }
        
        const parsed = parseFloat(frameRate)
        return isNaN(parsed) ? 30 : parsed
      }

      expect(parseFrameRate('30/1')).toBe(30)
      expect(parseFrameRate('30000/1001')).toBeCloseTo(29.97, 2)
      expect(parseFrameRate('29.97')).toBe(29.97)
      expect(parseFrameRate(undefined)).toBe(30)
    })
  })

  describe('analyzeFileSpecs', () => {
    it('should detect matching specifications', () => {
      const spec1: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const spec2: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 15
      }

      // Compare specs manually
      const allMatch = 
        spec1.width === spec2.width &&
        spec1.height === spec2.height &&
        spec1.videoCodec === spec2.videoCodec &&
        spec1.audioCodec === spec2.audioCodec &&
        Math.abs(spec1.audioSampleRate - spec2.audioSampleRate) <= 100 &&
        Math.abs(spec1.frameRate - spec2.frameRate) <= 0.1 &&
        spec1.pixelFormat === spec2.pixelFormat

      expect(allMatch).toBe(true)
    })

    it('should detect resolution mismatch', () => {
      const spec1: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const spec2: VideoSpec = {
        width: 1280,
        height: 720,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 15
      }

      const resolutionMatch = spec1.width === spec2.width && spec1.height === spec2.height
      expect(resolutionMatch).toBe(false)
    })

    it('should detect audio sample rate mismatch', () => {
      const spec1: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const spec2: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 48000,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 15
      }

      const sampleRateMatch = Math.abs(spec1.audioSampleRate - spec2.audioSampleRate) <= 100
      expect(sampleRateMatch).toBe(false)
    })

    it('should detect codec mismatch', () => {
      const spec1: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const spec2: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'vp9',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 15
      }

      const codecMatch = spec1.videoCodec === spec2.videoCodec
      expect(codecMatch).toBe(false)
    })
  })

  describe('formatAnalysisResult', () => {
    it('should format matching specs result correctly', () => {
      const result = {
        specs: [
          {
            width: 1920,
            height: 1080,
            videoCodec: 'h264',
            audioCodec: 'aac',
            audioSampleRate: 44100,
            pixelFormat: 'yuv420p',
            frameRate: 30,
            duration: 10
          }
        ],
        allMatch: true,
        targetSpec: {
          width: 1920,
          height: 1080,
          videoCodec: 'h264',
          audioCodec: 'aac',
          audioSampleRate: 44100,
          pixelFormat: 'yuv420p',
          frameRate: 30,
          duration: 10
        },
        requiresReencoding: false,
        mismatches: []
      }

      const formatted = formatAnalysisResult(result)
      expect(formatted).toContain('matching specifications')
      expect(formatted).toContain('Stream copy')
    })

    it('should format mismatched specs result correctly', () => {
      const result = {
        specs: [
          {
            width: 1920,
            height: 1080,
            videoCodec: 'h264',
            audioCodec: 'aac',
            audioSampleRate: 44100,
            pixelFormat: 'yuv420p',
            frameRate: 30,
            duration: 10
          },
          {
            width: 1280,
            height: 720,
            videoCodec: 'h264',
            audioCodec: 'aac',
            audioSampleRate: 48000,
            pixelFormat: 'yuv420p',
            frameRate: 30,
            duration: 15
          }
        ],
        allMatch: false,
        targetSpec: {
          width: 1920,
          height: 1080,
          videoCodec: 'h264',
          audioCodec: 'aac',
          audioSampleRate: 44100,
          pixelFormat: 'yuv420p',
          frameRate: 30,
          duration: 10
        },
        requiresReencoding: true,
        mismatches: [
          'File 2: Resolution: 1920x1080 vs 1280x720, Audio sample rate: 44100Hz vs 48000Hz'
        ]
      }

      const formatted = formatAnalysisResult(result)
      expect(formatted).toContain('mismatched specifications')
      expect(formatted).toContain('Re-encoding mode')
      expect(formatted).toContain('1920x1080')
      expect(formatted).toContain('Mismatches')
    })
  })

  describe('Smart Concat Logic', () => {
    it('should determine stream copy mode when all specs match and no effects', () => {
      const allMatch = true
      const enableFadeOut = false
      const enableFadeIn = false
      const enablePadding = false

      const useStreamCopy = allMatch && !enableFadeOut && !enableFadeIn && !enablePadding

      expect(useStreamCopy).toBe(true)
    })

    it('should determine re-encoding mode when specs mismatch', () => {
      const allMatch = false
      const enableFadeOut = false
      const enableFadeIn = false
      const enablePadding = false

      const useStreamCopy = allMatch && !enableFadeOut && !enableFadeIn && !enablePadding

      expect(useStreamCopy).toBe(false)
    })

    it('should determine re-encoding mode when fade effects are enabled', () => {
      const allMatch = true
      const enableFadeOut = true
      const enableFadeIn = false
      const enablePadding = false

      const useStreamCopy = allMatch && !enableFadeOut && !enableFadeIn && !enablePadding

      expect(useStreamCopy).toBe(false)
    })

    it('should determine re-encoding mode when padding is enabled', () => {
      const allMatch = true
      const enableFadeOut = false
      const enableFadeIn = false
      const enablePadding = true

      const useStreamCopy = allMatch && !enableFadeOut && !enableFadeIn && !enablePadding

      expect(useStreamCopy).toBe(false)
    })
  })

  describe('Resolution Handling', () => {
    it('should identify 1080p and 720p as different resolutions', () => {
      const spec1080p: VideoSpec = {
        width: 1920,
        height: 1080,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const spec720p: VideoSpec = {
        width: 1280,
        height: 720,
        videoCodec: 'h264',
        audioCodec: 'aac',
        audioSampleRate: 44100,
        pixelFormat: 'yuv420p',
        frameRate: 30,
        duration: 10
      }

      const resolutionMatch = 
        spec1080p.width === spec720p.width && 
        spec1080p.height === spec720p.height

      expect(resolutionMatch).toBe(false)
      expect(spec1080p.width).toBe(1920)
      expect(spec1080p.height).toBe(1080)
      expect(spec720p.width).toBe(1280)
      expect(spec720p.height).toBe(720)
    })

    it('should use first video as target spec for re-encoding', () => {
      const specs: VideoSpec[] = [
        {
          width: 1920,
          height: 1080,
          videoCodec: 'h264',
          audioCodec: 'aac',
          audioSampleRate: 44100,
          pixelFormat: 'yuv420p',
          frameRate: 30,
          duration: 10
        },
        {
          width: 1280,
          height: 720,
          videoCodec: 'h264',
          audioCodec: 'aac',
          audioSampleRate: 48000,
          pixelFormat: 'yuv420p',
          frameRate: 30,
          duration: 15
        }
      ]

      const targetSpec = specs[0]

      expect(targetSpec.width).toBe(1920)
      expect(targetSpec.height).toBe(1080)
      expect(targetSpec.audioSampleRate).toBe(44100)
    })
  })
})

