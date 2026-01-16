import { useEffect } from 'react'
import { CheckCircle2, XCircle, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: number
  type: ToastType
  title: string
  description?: string
  duration?: number
}

interface ToastProps {
  toast: Toast
  onClose: (id: number) => void
}

export function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id)
      }, toast.duration)
      
      return () => clearTimeout(timer)
    }
  }, [toast.id, toast.duration, onClose])
  
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />
  }
  
  const colors = {
    success: 'from-green-900/90 to-emerald-900/90 border-green-500/50 shadow-green-500/20',
    error: 'from-red-900/90 to-rose-900/90 border-red-500/50 shadow-red-500/20',
    info: 'from-blue-900/90 to-indigo-900/90 border-blue-500/50 shadow-blue-500/20',
    warning: 'from-yellow-900/90 to-orange-900/90 border-yellow-500/50 shadow-yellow-500/20'
  }
  
  return (
    <div className="animate-slide-in-right">
      <div
        className={cn(
          "relative overflow-hidden p-4 pr-12 bg-gradient-to-br border rounded-xl shadow-2xl max-w-md mb-3 backdrop-blur-lg group",
          colors[toast.type]
        )}
      >
        {/* Progress bar */}
        {toast.duration && toast.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div 
              className="h-full bg-white/40 animate-shrink"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          </div>
        )}
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            {icons[toast.type]}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white mb-0.5">{toast.title}</h4>
            {toast.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => onClose(toast.id)}
            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: number) => void
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null
  
  return (
    <div className="fixed top-6 right-6 z-[100] pointer-events-none">
      <div className="pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </div>
    </div>
  )
}

