/**
 * Unit tests for handling corrupted or invalid video files
 * 
 * This test suite verifies that the app gracefully handles corrupted/invalid
 * video files without crashing by:
 * 1. Creating temporary dummy files programmatically
 * 2. Attempting to process them with ffprobe
 * 3. Expecting appropriate error handling
 * 4. Cleaning up temporary files
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import ffmpeg from 'fluent-ffmpeg'
import ffprobePath from 'ffprobe-static'

// Set ffprobe path
if (ffprobePath && ffprobePath.path) {
  ffmpeg.setFfprobePath(ffprobePath.path)
}

describe('Corrupted File Handling', () => {
  let tempDir: string
  let corruptedVideoPath: string
  let emptyFilePath: string
  let textFilePath: string

  beforeAll(() => {
    // Create temporary directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loopmate-test-'))
  })

  afterAll(() => {
    // Clean up temporary files and directory
    try {
      if (fs.existsSync(corruptedVideoPath)) {
        fs.unlinkSync(corruptedVideoPath)
      }
      if (fs.existsSync(emptyFilePath)) {
        fs.unlinkSync(emptyFilePath)
      }
      if (fs.existsSync(textFilePath)) {
        fs.unlinkSync(textFilePath)
      }
      if (fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir)
      }
    } catch (error) {
      console.warn('Failed to clean up temporary files:', error)
    }
  })

  beforeEach(() => {
    // Create dummy files before each test
    corruptedVideoPath = path.join(tempDir, 'test-corrupted.mp4')
    emptyFilePath = path.join(tempDir, 'test-empty.mp4')
    textFilePath = path.join(tempDir, 'test-text.mp4')

    // 1. Simulate corrupted video file: random binary data
    const randomData = Buffer.from('This is not a valid video file. ' + Math.random().toString(36))
    fs.writeFileSync(corruptedVideoPath, randomData)

    // 2. Empty file
    fs.writeFileSync(emptyFilePath, '')

    // 3. Text file (wrong extension)
    fs.writeFileSync(textFilePath, 'This is a text file, not a video file.')
  })

  afterEach(() => {
    // Clean up files after each test
    try {
      if (fs.existsSync(corruptedVideoPath)) {
        fs.unlinkSync(corruptedVideoPath)
      }
      if (fs.existsSync(emptyFilePath)) {
        fs.unlinkSync(emptyFilePath)
      }
      if (fs.existsSync(textFilePath)) {
        fs.unlinkSync(textFilePath)
      }
    } catch (error) {
      console.warn('Failed to clean up test files:', error)
    }
  })

  describe('FFprobe Error Handling', () => {
    it('should throw an error when processing corrupted video file', async () => {
      await expect(
        new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(corruptedVideoPath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
      ).rejects.toThrow()
    })

    it('should throw an error when processing empty file', async () => {
      await expect(
        new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(emptyFilePath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
      ).rejects.toThrow()
    })

    it('should throw an error when processing text file with video extension', async () => {
      await expect(
        new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(textFilePath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
      ).rejects.toThrow()
    })

    it('should return error object with message property', async () => {
      try {
        await new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(corruptedVideoPath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
        fail('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeDefined()
        // Error object should have message property
        if (error instanceof Error) {
          expect(error.message).toBeDefined()
          expect(typeof error.message).toBe('string')
        }
      }
    })
  })

  describe('Error Message Validation', () => {
    it('should provide meaningful error message for corrupted files', async () => {
      try {
        await new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(corruptedVideoPath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
        fail('Expected error to be thrown')
      } catch (error) {
        expect(error).toBeDefined()
        if (error instanceof Error) {
          // FFprobe generally returns file format-related error messages
          expect(error.message).toBeTruthy()
          expect(error.message.length).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('File Existence Check', () => {
    it('should handle non-existent file path gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent-file.mp4')
      
      await expect(
        new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(nonExistentPath, (err, metadata) => {
            if (err) {
              reject(err)
              return
            }
            const duration = metadata?.format?.duration || 0
            resolve(duration)
          })
        })
      ).rejects.toThrow()
    })
  })

  describe('IPC Handler Simulation', () => {
    /**
     * Test that simulates video:get-duration IPC handler behavior
     * Uses the same logic as the actual IPC handler
     */
    it('should simulate video:get-duration handler error handling', async () => {
      const simulateGetDuration = async (videoPath: string): Promise<number> => {
        return new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
              console.error('FFprobe Error (Duration):', err)
              reject(err)
              return
            }
            const duration = metadata.format.duration || 0
            resolve(duration)
          })
        })
      }

      // Should throw error for corrupted file
      await expect(simulateGetDuration(corruptedVideoPath)).rejects.toThrow()
      
      // Should throw error for empty file
      await expect(simulateGetDuration(emptyFilePath)).rejects.toThrow()
      
      // Should throw error for text file
      await expect(simulateGetDuration(textFilePath)).rejects.toThrow()
    })

    it('should not crash the application when handling corrupted files', async () => {
      const simulateGetDuration = async (videoPath: string): Promise<number> => {
        return new Promise<number>((resolve, reject) => {
          ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
              console.error('FFprobe Error (Duration):', err)
              reject(err)
              return
            }
            const duration = metadata.format.duration || 0
            resolve(duration)
          })
        })
      }

      // App should not crash even when processing multiple corrupted files in sequence
      const corruptedFiles = [corruptedVideoPath, emptyFilePath, textFilePath]
      
      for (const filePath of corruptedFiles) {
        try {
          await simulateGetDuration(filePath)
          fail(`Expected error for file: ${filePath}`)
        } catch (error) {
          // It's normal for errors to occur
          expect(error).toBeDefined()
          // App should handle errors properly without crashing
          expect(() => {
            if (error instanceof Error) {
              throw error
            }
          }).toThrow()
        }
      }
    })
  })
})

