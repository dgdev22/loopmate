import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Github, MessageSquare, Heart } from "lucide-react"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appVersion?: string
}

export function AboutDialog({ open, onOpenChange, appVersion = '1.0.0' }: AboutDialogProps) {
  const { t } = useTranslation()

  const handleOpenExternal = async (url: string) => {
    if (window.electronAPI?.openExternal) {
      try {
        const result = await window.electronAPI.openExternal(url)
        if (result && 'success' in result && !result.success) {
          console.error('Failed to open external link:', result.error || 'Unknown error')
        }
      } catch (error) {
        console.error('Failed to open external link:', error)
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-3xl font-bold text-white">L</span>
            </div>

            <div className="text-center">
              <DialogTitle className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                LoopMate
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                {t('about.version')} {appVersion}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              {t('about.missionTitle')}
            </h3>

            <div className="space-y-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
              <p className="text-slate-300 leading-relaxed italic text-sm">
                {t('about.mission')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-200">
              {t('about.connect')}
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white h-12"
                onClick={() => handleOpenExternal('https://github.com/dgdev22/loopmate')}
              >
                <Github className="w-5 h-5 mr-3 text-slate-300" />
                <div className="flex-1 text-left">
                  <div className="font-medium">GitHub</div>
                  <div className="text-xs text-slate-400">github.com/dgdev22/loopmate</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 hover:text-white h-12"
                onClick={() => handleOpenExternal('https://github.com/dgdev22/loopmate/issues')}
              >
                <MessageSquare className="w-5 h-5 mr-3 text-slate-300" />
                <div className="flex-1 text-left">
                  <div className="font-medium">{t('about.support')}</div>
                  <div className="text-xs text-slate-400">github.com/dgdev22/loopmate/issues</div>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800">
          <Button
            variant="default"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => onOpenChange(false)}
          >
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}