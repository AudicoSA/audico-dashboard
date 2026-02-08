'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, Clock, ArrowLeft, ArrowRight } from 'lucide-react'

export type TaskStatus = 'new' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface TaskCardProps {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo?: {
    name: string
    color?: string
    avatar?: string
  }
  mentions_kenny?: boolean
  deliverable_url?: string
  timeAgo?: string
  onMoveLeft?: (() => void) | null
  onMoveRight?: (() => void) | null
  onClick?: () => void
  className?: string
}

const PRIORITY_CONFIG = {
  urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export default function TaskCard({
  id,
  title,
  description,
  status,
  priority,
  assignedTo,
  mentions_kenny = false,
  deliverable_url,
  timeAgo,
  onMoveLeft,
  onMoveRight,
  onClick,
  className = ''
}: TaskCardProps) {
  const priorityColor = PRIORITY_CONFIG[priority]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={`
        bg-[#252525] border border-white/5 rounded-xl p-3 sm:p-4
        hover:border-lime-500/30 transition-all group relative
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-white leading-snug flex-1 min-w-0 line-clamp-2">
          {title}
        </h4>
        {mentions_kenny && (
          <AlertTriangle size={14} className="text-red-400 shrink-0 animate-pulse" />
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-3">{description}</p>
      )}

      {/* Assigned agent */}
      {assignedTo && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[10px]"
              style={{ backgroundColor: assignedTo.color || '#6366f1' }}
              title={assignedTo.name}
            >
              {assignedTo.avatar || assignedTo.name[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-400 truncate max-w-[100px]">
              {assignedTo.name}
            </span>
          </div>
          
          <span
            className={`text-[10px] px-2 py-0.5 rounded border ${priorityColor} shrink-0`}
          >
            {priority}
          </span>
        </div>
      )}

      {/* Deliverable link */}
      {deliverable_url && status === 'completed' && (
        <a
          href={deliverable_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-lime-400 hover:text-lime-300 underline block mb-3 truncate"
        >
          View deliverable
        </a>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500">
          {timeAgo && (
            <>
              <Clock size={10} className="sm:w-3 sm:h-3" />
              <span>{timeAgo}</span>
            </>
          )}
        </div>

        {/* Move buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onMoveLeft && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation()
                onMoveLeft()
              }}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
              title="Move left"
            >
              <ArrowLeft size={14} />
            </motion.button>
          )}
          {onMoveRight && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation()
                onMoveRight()
              }}
              className="p-1 hover:bg-lime-500/20 rounded text-gray-400 hover:text-lime-400 transition-colors"
              title="Move right"
            >
              <ArrowRight size={14} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
