/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CopyTimestampsButton } from '@/components/CopyTimestampsButton'

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'timestamps.copyTooltip': 'Copy YouTube Chapters',
        'timestamps.copied': 'Copied!',
        'timestamps.copyHistory': 'Copy Timestamps'
      }
      return translations[key] || key
    }
  })
}))

// Mock clipboard API
const mockWriteText = jest.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText
  }
})

describe('CopyTimestampsButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render button with copy icon', () => {
    render(<CopyTimestampsButton timestampText="00:00 - Video 1" />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('title', 'Copy YouTube Chapters')
  })

  it('should copy text to clipboard on click', async () => {
    const timestampText = '00:00 - Video 1\n05:30 - Video 2'
    render(<CopyTimestampsButton timestampText={timestampText} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(timestampText)
    })
  })

  it('should show "Copied!" state after successful copy', async () => {
    const timestampText = '00:00 - Video 1'
    render(<CopyTimestampsButton timestampText={timestampText} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('should revert to original state after 2 seconds', async () => {
    const timestampText = '00:00 - Video 1'
    render(<CopyTimestampsButton timestampText={timestampText} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })

    // Fast-forward 2 seconds
    jest.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(screen.getByText('Copy Timestamps')).toBeInTheDocument()
    })
  })

  it('should use fallback copy method if clipboard API fails', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard API not available'))
    
    // Mock document.execCommand
    const mockExecCommand = jest.fn().mockReturnValue(true)
    document.execCommand = mockExecCommand

    const timestampText = '00:00 - Video 1'
    render(<CopyTimestampsButton timestampText={timestampText} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled()
      expect(mockExecCommand).toHaveBeenCalledWith('copy')
    })
  })

  it('should handle empty timestamp text', () => {
    render(<CopyTimestampsButton timestampText="" />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    fireEvent.click(button)
    expect(mockWriteText).toHaveBeenCalledWith('')
  })
})

