import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Music, FileVideo, Plus, Sparkles } from 'lucide-react'

interface OnboardingModalProps {
  onComplete: () => void
}

export function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if onboarding has been completed
    const checkOnboardingCompleted = async () => {
      if (window.electronAPI?.getOnboardingCompleted) {
        try {
          const result = await window.electronAPI.getOnboardingCompleted()
          if (!result.hasCompletedOnboarding) {
            setOpen(true)
          }
        } catch (error) {
          console.error('Failed to check onboarding status:', error)
          // If check fails, show modal to be safe
          setOpen(true)
        }
      } else {
        // If API not available, show modal
        setOpen(true)
      }
    }
    checkOnboardingCompleted()
  }, [])

  const handleComplete = async () => {
    try {
      if (window.electronAPI?.setOnboardingCompleted) {
        await window.electronAPI.setOnboardingCompleted({ completed: true })
      }
      setOpen(false)
      onComplete()
    } catch (error) {
      console.error('Failed to save onboarding completion:', error)
      // Still close modal even if save fails
      setOpen(false)
      onComplete()
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal={true}>
      <DialogContent 
        className="bg-slate-900 border-slate-800 text-slate-50 max-w-3xl max-h-[90vh] flex flex-col p-0"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('onboarding.welcome')}</DialogTitle>
          <DialogDescription>{t('onboarding.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="p-8 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl">
              <Sparkles className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {t('onboarding.welcome')}
              </h2>
              <p className="text-slate-400 mt-1">{t('onboarding.subtitle')}</p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4 mb-8">
            <p className="text-lg text-slate-300 mb-6">{t('onboarding.description')}</p>
            
            {/* Feature 1: Music + Image */}
            <div className="flex items-start gap-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/15 transition-colors">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <Music className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-emerald-400 mb-1">
                  {t('onboarding.feature1.title')}
                </h3>
                <p className="text-sm text-slate-400">
                  {t('onboarding.feature1.description')}
                </p>
              </div>
            </div>
            
            {/* Feature 2: Loop Video */}
            <div className="flex items-start gap-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/15 transition-colors">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileVideo className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-blue-400 mb-1">
                  {t('onboarding.feature2.title')}
                </h3>
                <p className="text-sm text-slate-400">
                  {t('onboarding.feature2.description')}
                </p>
              </div>
            </div>
            
            {/* Feature 3: Concat Videos */}
            <div className="flex items-start gap-4 p-5 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/15 transition-colors">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Plus className="w-6 h-6 text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-purple-400 mb-1">
                  {t('onboarding.feature3.title')}
                </h3>
                <p className="text-sm text-slate-400">
                  {t('onboarding.feature3.description')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-800 bg-slate-950/50">
          <Button
            onClick={handleComplete}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-6 text-lg shadow-lg shadow-emerald-900/30"
            size="lg"
          >
            {t('onboarding.getStarted')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

