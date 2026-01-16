import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Copy, Check, AlertCircle } from "lucide-react"
import { calculateTimestamps } from "@/lib/timestampUtils"

interface YouTubeTimestampGeneratorProps {
  videoFiles: string[]
  enablePadding?: boolean
  paddingDuration?: number
}

export function YouTubeTimestampGenerator({ 
  videoFiles, 
  enablePadding = false, 
  paddingDuration = 0 
}: YouTubeTimestampGeneratorProps) {
  const { t } = useTranslation()
  const [timestampText, setTimestampText] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string>('')

  // Load video durations when videoFiles or padding settings change
  useEffect(() => {
    const loadDurations = async () => {
      if (videoFiles.length === 0) {
        setTimestampText('')
        setError('')
        return
      }

      setIsLoading(true)
      setError('')

      try {
        if (!window.electronAPI?.getVideoDuration) {
          throw new Error('Video duration API not available')
        }

        const text = await calculateTimestamps(
          videoFiles,
          (path) => window.electronAPI.getVideoDuration!(path),
          {
            enablePadding,
            paddingDuration
          }
        )
        setTimestampText(text)
      } catch (err) {
        console.error('Failed to load video durations:', err)
        setError(err instanceof Error ? err.message : 'Failed to calculate timestamps')
        setTimestampText('')
      } finally {
        setIsLoading(false)
      }
    }

    loadDurations()
  }, [videoFiles, enablePadding, paddingDuration])

  // Copy to clipboard
  const handleCopy = async () => {
    if (!timestampText) return

    try {
      await navigator.clipboard.writeText(timestampText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)

      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = timestampText
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        textArea.setAttribute('aria-hidden', 'true')
        document.body.appendChild(textArea)
        textArea.select()

        const success = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          setError('Failed to copy to clipboard')
        }
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr)
        setError('Failed to copy to clipboard')
      }
    }
  }

  // Don't show if no videos or only one video (timestamps not useful)
  if (videoFiles.length < 2) {
    return null
  }

  return (
    <div className="space-y-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">
          {t('timestamps.title')}
        </label>
        {isLoading && (
          <span className="text-xs text-slate-500">{t('timestamps.loading')}</span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t('timestamps.calculating')}
        </div>
      ) : timestampText ? (
        <>
          <div className="relative">
            <textarea
              readOnly
              value={timestampText}
              className="w-full h-48 p-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              style={{ fontFamily: 'monospace' }}
              aria-label={t('timestamps.title')}
              aria-describedby="timestamp-description"
            />
            <span id="timestamp-description" className="sr-only">
              Generated YouTube chapter timestamps for your videos
            </span>
          </div>
          <Button
            onClick={handleCopy}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!timestampText || copied}
            aria-label={copied ? t('timestamps.copied') : t('timestamps.copy')}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('timestamps.copied')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
                {t('timestamps.copy')}
              </>
            )}
          </Button>
        </>
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm">
          {t('timestamps.noVideos')}
        </div>
      )}
    </div>
  )
}