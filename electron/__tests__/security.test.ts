import { describe, it, expect } from '@jest/globals'
import { validateUrl, sanitizeErrorMessage } from '../utils/security'

describe('Security Utilities', () => {
  describe('validateUrl', () => {
    it('should accept valid https URLs', () => {
      expect(() => validateUrl('https://buymeacoffee.com/loopmateapp')).not.toThrow()
      expect(() => validateUrl('https://example.com')).not.toThrow()
    })

    it('should accept valid http URLs', () => {
      expect(() => validateUrl('http://example.com')).not.toThrow()
    })

    it('should accept valid mailto URLs', () => {
      expect(() => validateUrl('mailto:test@example.com')).not.toThrow()
    })

    it('should reject javascript: URLs', () => {
      expect(() => validateUrl('javascript:alert(1)')).toThrow()
    })

    it('should reject data: URLs', () => {
      expect(() => validateUrl('data:text/html,<script>alert(1)</script>')).toThrow()
    })

    it('should reject file: URLs', () => {
      expect(() => validateUrl('file:///etc/passwd')).toThrow()
    })

    it('should reject vbscript: URLs', () => {
      expect(() => validateUrl('vbscript:msgbox(1)')).toThrow()
    })

    it('should reject invalid URL format', () => {
      expect(() => validateUrl('not-a-url')).toThrow()
    })

    it('should reject empty string', () => {
      expect(() => validateUrl('')).toThrow()
    })

    it('should reject null bytes', () => {
      expect(() => validateUrl('https://example.com\0')).toThrow()
    })
  })

  describe('sanitizeErrorMessage', () => {
    it('should return user message when provided', () => {
      const error = new Error('Internal error with path: /secret/path')
      const result = sanitizeErrorMessage(error, 'User-friendly message')
      expect(result).toBe('User-friendly message')
    })

    it('should sanitize file paths from error messages', () => {
      const error = new Error('Error in /Users/secret/path/file.mp4')
      const result = sanitizeErrorMessage(error)
      expect(result).not.toContain('/Users/secret/path/file.mp4')
    })

    it('should handle non-Error objects', () => {
      const result = sanitizeErrorMessage('string error')
      expect(result).toBe('An error occurred')
    })

    it('should handle Error objects without user message', () => {
      const error = new Error('Test error')
      const result = sanitizeErrorMessage(error)
      expect(result).toContain('Test error')
    })
  })
})


