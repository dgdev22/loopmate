import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

interface TermsModalProps {
  onAccept: () => void
}

export function TermsModal({ onAccept }: TermsModalProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if ToS has been accepted
    const checkTosAccepted = async () => {
      if (window.electronAPI?.getTosAccepted) {
        try {
          const result = await window.electronAPI.getTosAccepted()
          if (!result.hasAcceptedTerms) {
            setOpen(true)
          }
        } catch (error) {
          console.error('Failed to check ToS status:', error)
          // If check fails, show modal to be safe
          setOpen(true)
        }
      } else {
        // If API not available, show modal
        setOpen(true)
      }
    }
    checkTosAccepted()
  }, [])

  const handleAccept = async () => {
    try {
      if (window.electronAPI?.setTosAccepted) {
        await window.electronAPI.setTosAccepted({ accepted: true })
      }
      setOpen(false)
      onAccept()
    } catch (error) {
      console.error('Failed to save ToS acceptance:', error)
      // Still close modal even if save fails
      setOpen(false)
      onAccept()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent 
        className="bg-slate-900 border-slate-800 text-slate-50 max-w-2xl max-h-[80vh] flex flex-col"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            <AlertCircle className="w-5 h-5" />
            {t('tos.title')}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {t('tos.notice')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div 
            className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {t('tos.content')}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-800">
          <Button
            onClick={handleAccept}
            className="bg-orange-600 hover:bg-orange-500 text-white font-medium px-8"
            size="lg"
          >
            {t('tos.button_agree')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

