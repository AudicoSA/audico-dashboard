'use client'

import { motion } from 'framer-motion'
import { Check, X, ThumbsUp, ThumbsDown, CheckCircle2, XCircle, LucideIcon } from 'lucide-react'
import { useState } from 'react'

export interface ApprovalButtonProps {
  variant?: 'approve-reject' | 'thumbs' | 'check-cross'
  onApprove: () => void | Promise<void>
  onReject: () => void | Promise<void>
  approveLabel?: string
  rejectLabel?: string
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  layout?: 'horizontal' | 'vertical'
  className?: string
  showLabels?: boolean
}

const VARIANT_CONFIG = {
  'approve-reject': {
    approveIcon: CheckCircle2,
    rejectIcon: XCircle
  },
  'thumbs': {
    approveIcon: ThumbsUp,
    rejectIcon: ThumbsDown
  },
  'check-cross': {
    approveIcon: Check,
    rejectIcon: X
  }
}

const SIZE_CONFIG = {
  sm: {
    button: 'px-3 py-1.5 text-xs',
    icon: 12
  },
  md: {
    button: 'px-4 py-2 text-sm',
    icon: 16
  },
  lg: {
    button: 'px-5 py-3 text-base',
    icon: 18
  }
}

export default function ApprovalButton({
  variant = 'approve-reject',
  onApprove,
  onReject,
  approveLabel = 'Approve',
  rejectLabel = 'Reject',
  disabled = false,
  loading = false,
  size = 'md',
  layout = 'horizontal',
  className = '',
  showLabels = true
}: ApprovalButtonProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)

  const config = VARIANT_CONFIG[variant]
  const sizeConfig = SIZE_CONFIG[size]
  const ApproveIcon = config.approveIcon
  const RejectIcon = config.rejectIcon

  const handleApprove = async () => {
    if (disabled || loading || isApproving) return
    setIsApproving(true)
    try {
      await onApprove()
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (disabled || loading || isRejecting) return
    setIsRejecting(true)
    try {
      await onReject()
    } finally {
      setIsRejecting(false)
    }
  }

  const isProcessing = loading || isApproving || isRejecting
  const containerClass = layout === 'vertical' ? 'flex-col' : 'flex-row'

  return (
    <div className={`flex gap-2 ${containerClass} ${className}`}>
      {/* Approve Button */}
      <motion.button
        whileHover={!isProcessing && !disabled ? { scale: 1.05 } : {}}
        whileTap={!isProcessing && !disabled ? { scale: 0.95 } : {}}
        onClick={handleApprove}
        disabled={disabled || isProcessing}
        className={`
          ${layout === 'vertical' ? 'w-full' : 'flex-1'}
          ${sizeConfig.button}
          bg-lime-500/20 hover:bg-lime-500/30 text-lime-400 
          font-medium rounded-lg sm:rounded-xl transition-all 
          flex items-center justify-center gap-2 
          border border-lime-500/30
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isApproving ? 'animate-pulse' : ''}
        `}
      >
        <ApproveIcon 
          size={sizeConfig.icon} 
          className={isApproving ? 'animate-spin' : ''} 
        />
        {showLabels && <span className="hidden sm:inline">{approveLabel}</span>}
      </motion.button>

      {/* Reject Button */}
      <motion.button
        whileHover={!isProcessing && !disabled ? { scale: 1.05 } : {}}
        whileTap={!isProcessing && !disabled ? { scale: 0.95 } : {}}
        onClick={handleReject}
        disabled={disabled || isProcessing}
        className={`
          ${layout === 'vertical' ? 'w-full' : 'flex-1'}
          ${sizeConfig.button}
          bg-red-500/20 hover:bg-red-500/30 text-red-400 
          font-medium rounded-lg sm:rounded-xl transition-all 
          flex items-center justify-center gap-2 
          border border-red-500/30
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isRejecting ? 'animate-pulse' : ''}
        `}
      >
        <RejectIcon 
          size={sizeConfig.icon} 
          className={isRejecting ? 'animate-spin' : ''} 
        />
        {showLabels && <span className="hidden sm:inline">{rejectLabel}</span>}
      </motion.button>
    </div>
  )
}

export function SingleApprovalButton({
  action,
  type = 'approve',
  label,
  onAction,
  icon: CustomIcon,
  disabled = false,
  loading = false,
  size = 'md',
  className = ''
}: {
  action?: string
  type?: 'approve' | 'reject' | 'neutral'
  label: string
  onAction: () => void | Promise<void>
  icon?: LucideIcon
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const sizeConfig = SIZE_CONFIG[size]

  const typeConfig = {
    approve: {
      bg: 'bg-lime-500/20 hover:bg-lime-500/30',
      text: 'text-lime-400',
      border: 'border-lime-500/30',
      icon: CheckCircle2
    },
    reject: {
      bg: 'bg-red-500/20 hover:bg-red-500/30',
      text: 'text-red-400',
      border: 'border-red-500/30',
      icon: XCircle
    },
    neutral: {
      bg: 'bg-blue-500/20 hover:bg-blue-500/30',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: Check
    }
  }

  const config = typeConfig[type]
  const Icon = CustomIcon || config.icon

  const handleAction = async () => {
    if (disabled || loading || isProcessing) return
    setIsProcessing(true)
    try {
      await onAction()
    } finally {
      setIsProcessing(false)
    }
  }

  const isLoading = loading || isProcessing

  return (
    <motion.button
      whileHover={!isLoading && !disabled ? { scale: 1.05 } : {}}
      whileTap={!isLoading && !disabled ? { scale: 0.95 } : {}}
      onClick={handleAction}
      disabled={disabled || isLoading}
      className={`
        ${sizeConfig.button}
        ${config.bg} ${config.text} ${config.border}
        font-medium rounded-lg sm:rounded-xl transition-all 
        flex items-center justify-center gap-2 
        border disabled:opacity-50 disabled:cursor-not-allowed
        ${isLoading ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      <Icon size={sizeConfig.icon} className={isLoading ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  )
}
