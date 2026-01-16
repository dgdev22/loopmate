import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Copy, Check, FolderOpen, X, ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { parseErrorFromIPC } from "@/lib/errorCodes"
import { getPlatformCode } from "@/lib/utils"

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  error?: {
    type?: string
    message: string
    stack?: string
    errorId?: string
  }
  errorId?: string
  title?: string
  description?: string
}

export function ErrorModal({ 
  open, 
  onOpenChange, 
  error,
  errorId: propErrorId,
  title,
  description
}: ErrorModalProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [troubleshootingOpen, setTroubleshootingOpen] = useState(false)

  // Parse error message for error code
  const rawErrorMessage = error?.message || description || t('errors.unknownError')
  const { code: errorCode, message: cleanMessage } = parseErrorFromIPC(rawErrorMessage)
  
  // Generate or use provided error ID
  const errorId = propErrorId || error?.errorId || generateErrorId()
  // Display numeric error code if available, otherwise use generated ID
  const displayErrorId = errorCode !== null ? String(errorCode) : errorId
  const errorMessage = cleanMessage
  const errorTitle = title || t('errors.somethingWentWrong')

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const handleCopyErrorId = async () => {
    try {
      await navigator.clipboard.writeText(errorId)
      setCopied(true)
    } catch (err) {
      console.error('Failed to copy error ID:', err)
    }
  }

  const handleOpenLogFolder = async () => {
    if (window.electronAPI?.openLogFolder) {
      try {
        await window.electronAPI.openLogFolder()
      } catch (err) {
        console.error('Failed to open log folder:', err)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-50 max-w-2xl">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4 text-slate-400 hover:text-slate-200" />
          <span className="sr-only">{t('common.close')}</span>
        </button>
        
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {errorTitle}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {errorMessage}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Code/ID */}
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">{t('errors.errorId')}</p>
                <p className="text-sm font-mono text-slate-200">{displayErrorId}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyErrorId}
                className="text-slate-400 hover:text-slate-200"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    {t('common.copied')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    {t('errors.copyErrorId')}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Troubleshooting Tips */}
          <Collapsible open={troubleshootingOpen} onOpenChange={setTroubleshootingOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between text-slate-300 hover:text-slate-100 hover:bg-slate-800"
              >
                <span>{t('errors.troubleshootingTips')}</span>
                {troubleshootingOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg space-y-3">
                <div className="text-sm text-slate-300 space-y-2">
                  <p className="flex items-start gap-2">
                    <span className="text-orange-400 font-semibold">1.</span>
                    <span>{t('errors.tip1')}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-orange-400 font-semibold">2.</span>
                    <span>{t('errors.tip2')}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <span className="text-orange-400 font-semibold">3.</span>
                    <span>{t('errors.tip3')}</span>
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleOpenLogFolder}
            className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            {t('errors.openLogFolder')}
          </Button>
          <Button
            onClick={() => onOpenChange(false)}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Generate unique error ID with platform info
function generateErrorId(): string {
  const platform = getPlatformCode()
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ERR_${platform}_${timestamp}_${random}`
}

