import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"

interface CopyTimestampsButtonProps {
  timestampText: string
}

export function CopyTimestampsButton({ timestampText }: CopyTimestampsButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(timestampText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = timestampText
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Fallback copy failed:', err)
      }
      document.body.removeChild(textArea)
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="w-full text-purple-400 hover:text-purple-300 hover:bg-purple-950 h-8 text-xs"
      onClick={handleCopy}
      title={t('timestamps.copyTooltip')}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 mr-1" />
          {t('timestamps.copied')}
        </>
      ) : (
        <>
          <Copy className="w-3 h-3 mr-1" />
          {t('timestamps.copyHistory')}
        </>
      )}
    </Button>
  )
}

