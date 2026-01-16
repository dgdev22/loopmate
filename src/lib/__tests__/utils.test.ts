import { describe, it, expect } from '@jest/globals'
import { cn } from '../utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('should handle conditional classes', () => {
    const result = cn('foo', true && 'bar', false && 'baz')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
    expect(result).not.toContain('baz')
  })

  it('should merge Tailwind classes correctly', () => {
    const result = cn('p-4', 'p-2')
    // Tailwind merge should keep only the last one
    expect(result).toBe('p-2')
  })

  it('should handle empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle undefined and null', () => {
    const result = cn('foo', undefined, null, 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })
})

