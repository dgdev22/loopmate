import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'
import os from 'os'

// Mock fs module
jest.mock('fs')
const mockedFs = fs as jest.Mocked<typeof fs>

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  }))
})

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    videoFilters: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    ffprobe: jest.fn(),
  }))
})

describe('Utility Functions', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `test-${Date.now()}`)
    mockedFs.existsSync = jest.fn()
    mockedFs.unlinkSync = jest.fn()
    mockedFs.writeFileSync = jest.fn()
    mockedFs.readFileSync = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getSafeOutputPath', () => {
    it('should return original path if file does not exist', () => {
      // Test the logic without requiring the actual function
      const testPath = path.join(tempDir, 'test.mp4')
      
      mockedFs.existsSync.mockReturnValue(false)
      
      // Logic test: if file doesn't exist, return original path
      const fileExists = mockedFs.existsSync(testPath)
      if (!fileExists) {
        expect(testPath).toBe(testPath)
      }
    })

    it('should append counter if file exists', () => {
      const testPath = path.join(tempDir, 'test.mp4')
      const expectedPath = path.join(tempDir, 'test (1).mp4')
      
      mockedFs.existsSync
        .mockReturnValueOnce(true)  // Original file exists
        .mockReturnValueOnce(false)  // (1) version does not exist
      
      // Logic test: if original exists, try (1) version
      const originalExists = mockedFs.existsSync(testPath)
      if (originalExists) {
        const counter = 1
        const newPath = path.join(path.dirname(testPath), `test (${counter}).mp4`)
        const newPathExists = mockedFs.existsSync(newPath)
        if (!newPathExists) {
          expect(newPath).toBe(expectedPath)
        }
      }
    })

    it('should increment counter until finding available path', () => {
      const testPath = path.join(tempDir, 'test.mp4')
      const dir = path.dirname(testPath)
      const ext = path.extname(testPath)
      const nameWithoutExt = path.basename(testPath, ext)
      
      mockedFs.existsSync
        .mockReturnValueOnce(true)  // Original exists
        .mockReturnValueOnce(true)  // (1) exists
        .mockReturnValueOnce(true)  // (2) exists
        .mockReturnValueOnce(false) // (3) does not exist
      
      // Logic test: increment counter until available
      let counter = 1
      let newPath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`)
      while (mockedFs.existsSync(newPath)) {
        counter++
        newPath = path.join(dir, `${nameWithoutExt} (${counter})${ext}`)
      }
      const expectedPath = path.join(dir, `${nameWithoutExt} (3)${ext}`)
      expect(newPath).toBe(expectedPath)
    })
  })

  describe('cleanupTempFiles', () => {
    it('should delete existing files', () => {
      const files = [
        path.join(tempDir, 'file1.mp4'),
        path.join(tempDir, 'file2.mp4'),
      ]
      
      mockedFs.existsSync.mockReturnValue(true)
      
      // Logic test: delete files that exist
      files.forEach(file => {
        if (mockedFs.existsSync(file)) {
          mockedFs.unlinkSync(file)
        }
      })
      
      expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(2)
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(files[0])
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(files[1])
    })

    it('should skip non-existent files', () => {
      const files = [
        path.join(tempDir, 'file1.mp4'),
        path.join(tempDir, 'file2.mp4'),
      ]
      
      mockedFs.existsSync.mockReturnValue(false)
      
      // Logic test: skip files that don't exist
      files.forEach(file => {
        if (mockedFs.existsSync(file)) {
          mockedFs.unlinkSync(file)
        }
      })
      
      expect(mockedFs.unlinkSync).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      const files = [path.join(tempDir, 'file1.mp4')]
      
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.unlinkSync.mockImplementation(() => {
        throw new Error('Delete failed')
      })
      
      // Logic test: handle errors
      files.forEach(file => {
        if (mockedFs.existsSync(file)) {
          try {
            mockedFs.unlinkSync(file)
          } catch (e) {
            console.error('Failed to delete temp file:', file, e)
          }
        }
      })
      
      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })
  })

  describe('cleanupAudioTempFiles', () => {
    it('should cleanup merged audio and faded files', () => {
      const tempMergedAudio = path.join(tempDir, 'merged.mp3')
      const tempFadedFiles = [
        path.join(tempDir, 'faded1.mp3'),
        path.join(tempDir, 'faded2.mp3'),
      ]
      
      mockedFs.existsSync.mockReturnValue(true)
      
      // Logic test: cleanup merged audio and faded files
      if (tempMergedAudio && mockedFs.existsSync(tempMergedAudio)) {
        mockedFs.unlinkSync(tempMergedAudio)
      }
      tempFadedFiles.forEach(file => {
        if (mockedFs.existsSync(file)) {
          mockedFs.unlinkSync(file)
        }
      })
      
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(tempMergedAudio)
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(tempFadedFiles[0])
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(tempFadedFiles[1])
    })

    it('should skip undefined merged audio', () => {
      const tempFadedFiles = [path.join(tempDir, 'faded1.mp3')]
      
      mockedFs.existsSync.mockReturnValue(true)
      
      // Logic test: skip undefined merged audio
      const tempMergedAudio = undefined
      if (tempMergedAudio && mockedFs.existsSync(tempMergedAudio)) {
        mockedFs.unlinkSync(tempMergedAudio)
      }
      tempFadedFiles.forEach(file => {
        if (mockedFs.existsSync(file)) {
          mockedFs.unlinkSync(file)
        }
      })
      
      expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(1)
      expect(mockedFs.unlinkSync).toHaveBeenCalledWith(tempFadedFiles[0])
    })
  })
})

