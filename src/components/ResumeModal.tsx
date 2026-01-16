import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"
import { useTranslation } from 'react-i18next'

interface ResumeModalProps {
  open: boolean
  onResume: () => void
  onCancel: () => void
  taskCount: number
}

export function ResumeModal({ open, onResume, onCancel, taskCount }: ResumeModalProps) {
  const { t } = useTranslation()

  // Handle ESC or outside click through AlertDialog's onOpenChange
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onCancel()
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-slate-800 text-slate-50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl font-bold text-orange-400">
            {t('resume.title')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-400">
            {t('resume.description', { count: taskCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={onCancel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            {t('resume.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onResume}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {t('resume.resume')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

