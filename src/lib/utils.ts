import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get platform code for error IDs
 * Returns: MAC, WIN, LINUX, or UNK
 */
export function getPlatformCode(): string {
  if (typeof navigator === 'undefined') {
    return 'UNK'
  }
  
  const platform = navigator.platform.toLowerCase()
  const userAgent = navigator.userAgent.toLowerCase()
  
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'MAC'
  } else if (platform.includes('win') || userAgent.includes('win')) {
    return 'WIN'
  } else if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'LINUX'
  }
  
  return 'UNK'
}
