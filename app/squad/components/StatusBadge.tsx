'use client'

import { motion } from 'framer-motion'
import { 
  CheckCircle2, 
  Clock, 
  Zap, 
  AlertTriangle, 
  XCircle, 
  Archive,
  Send,
  FileText,
  Tag,
  Activity,
  LucideIcon
} from 'lucide-react'

export type StatusType = 
  | 'success' 
  | 'pending' 
  | 'active' 
  | 'warning' 
  | 'error' 
  | 'neutral'
  | 'info'
  | 'archived'
  | 'sent'
  | 'draft'
  | 'classified'

export interface StatusBadgeProps {
  status: StatusType | string
  label?: string
  icon?: LucideIcon
  size?: 'xs' | 'sm' | 'md' | 'lg'
  animated?: boolean
  pulse?: boolean
  glow?: boolean
  className?: string
}

const STATUS_CONFIG: Record<StatusType, {
  color: string
  bgColor: string
  borderColor: string
  icon: LucideIcon
  defaultLabel: string
}> = {
  success: {
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/20',
    borderColor: 'border-lime-500/30',
    icon: CheckCircle2,
    defaultLabel: 'Success'
  },
  pending: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: Clock,
    defaultLabel: 'Pending'
  },
  active: {
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/20',
    borderColor: 'border-lime-500/30',
    icon: Zap,
    defaultLabel: 'Active'
  },
  warning: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    icon: AlertTriangle,
    defaultLabel: 'Warning'
  },
  error: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    icon: XCircle,
    defaultLabel: 'Error'
  },
  neutral: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: Tag,
    defaultLabel: 'Neutral'
  },
  info: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: Activity,
    defaultLabel: 'Info'
  },
  archived: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: Archive,
    defaultLabel: 'Archived'
  },
  sent: {
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/20',
    borderColor: 'border-lime-500/30',
    icon: Send,
    defaultLabel: 'Sent'
  },
  draft: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    icon: FileText,
    defaultLabel: 'Draft'
  },
  classified: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
    icon: Tag,
    defaultLabel: 'Classified'
  }
}

const SIZE_CONFIG = {
  xs: {
    text: 'text-[10px]',
    padding: 'px-1.5 py-0.5',
    icon: 10,
    gap: 'gap-1'
  },
  sm: {
    text: 'text-xs',
    padding: 'px-2 py-1',
    icon: 12,
    gap: 'gap-1'
  },
  md: {
    text: 'text-sm',
    padding: 'px-3 py-1.5',
    icon: 14,
    gap: 'gap-1.5'
  },
  lg: {
    text: 'text-base',
    padding: 'px-4 py-2',
    icon: 16,
    gap: 'gap-2'
  }
}

export default function StatusBadge({
  status,
  label,
  icon: CustomIcon,
  size = 'sm',
  animated = false,
  pulse = false,
  glow = false,
  className = ''
}: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as StatusType
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.neutral
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = CustomIcon || config.icon
  const displayLabel = label || config.defaultLabel

  return (
    <motion.span
      initial={animated ? { opacity: 0, scale: 0.8 } : false}
      animate={animated ? { opacity: 1, scale: 1 } : false}
      transition={{ duration: 0.2 }}
      className={`
        inline-flex items-center ${sizeConfig.gap}
        ${sizeConfig.text} ${sizeConfig.padding}
        ${config.color} ${config.bgColor} ${config.borderColor}
        border rounded-md font-medium
        ${pulse ? 'animate-pulse' : ''}
        ${glow ? `shadow-[0_0_8px_${config.color}]` : ''}
        ${className}
      `}
    >
      <Icon size={sizeConfig.icon} className={pulse ? 'animate-pulse' : ''} />
      <span className="whitespace-nowrap">{displayLabel}</span>
    </motion.span>
  )
}

export function StatusDot({
  status,
  size = 'sm',
  pulse = false,
  label,
  showLabel = false,
  className = ''
}: {
  status: StatusType | string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  pulse?: boolean
  label?: string
  showLabel?: boolean
  className?: string
}) {
  const normalizedStatus = status.toLowerCase() as StatusType
  const config = STATUS_CONFIG[normalizedStatus] || STATUS_CONFIG.neutral
  
  const sizeMap = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  }

  const dotSize = sizeMap[size]
  const displayLabel = label || config.defaultLabel

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`
          ${dotSize} rounded-full ${config.bgColor.replace('/20', '')} 
          ${pulse ? 'animate-pulse' : ''}
          relative
        `}
      >
        {pulse && (
          <span className={`
            absolute inset-0 rounded-full ${config.bgColor.replace('/20', '')} 
            animate-ping
          `} />
        )}
      </motion.span>
      {showLabel && (
        <span className={`text-xs sm:text-sm ${config.color}`}>
          {displayLabel}
        </span>
      )}
    </div>
  )
}

export function StatusPill({
  count,
  label,
  status = 'neutral',
  icon: CustomIcon,
  size = 'md',
  className = ''
}: {
  count?: number
  label: string
  status?: StatusType
  icon?: LucideIcon
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = STATUS_CONFIG[status]
  const Icon = CustomIcon || config.icon
  
  const sizeConfig = {
    sm: { text: 'text-xs', padding: 'px-2 py-1', icon: 12 },
    md: { text: 'text-sm', padding: 'px-3 py-1.5', icon: 14 },
    lg: { text: 'text-base', padding: 'px-4 py-2', icon: 16 }
  }

  const sc = sizeConfig[size]

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`
        inline-flex items-center gap-2
        ${sc.text} ${sc.padding}
        ${config.bgColor} ${config.borderColor} ${config.color}
        border rounded-full font-medium
        ${className}
      `}
    >
      <Icon size={sc.icon} />
      <span>{label}</span>
      {count !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 bg-white/10 rounded-full text-xs font-bold">
          {count}
        </span>
      )}
    </motion.div>
  )
}
