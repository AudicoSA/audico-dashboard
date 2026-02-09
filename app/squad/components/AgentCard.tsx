'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

export interface AgentCardProps {
  name: string
  role: string
  status?: 'active' | 'idle' | 'busy' | 'error'
  color?: string
  icon?: LucideIcon
  description?: string
  lastActive?: string
  onClick?: () => void
  className?: string
}

const STATUS_CONFIG = {
  active: {
    color: 'bg-lime-400',
    label: 'Active',
    glow: 'shadow-[0_0_10px_rgba(163,230,53,0.4)]'
  },
  idle: {
    color: 'bg-gray-400',
    label: 'Idle',
    glow: ''
  },
  busy: {
    color: 'bg-yellow-400',
    label: 'Busy',
    glow: 'shadow-[0_0_10px_rgba(250,204,21,0.4)]'
  },
  error: {
    color: 'bg-red-400',
    label: 'Error',
    glow: 'shadow-[0_0_10px_rgba(248,113,113,0.4)]'
  }
}

export default function AgentCard({
  name,
  role,
  status = 'idle',
  color = '#6366f1',
  icon: Icon,
  description,
  lastActive,
  onClick,
  className = ''
}: AgentCardProps) {
  const statusConfig = STATUS_CONFIG[status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: onClick ? 1.02 : 1 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`
        bg-[#1c1c1c] border border-white/5 rounded-xl p-4 
        hover:border-white/10 transition-all group relative overflow-hidden
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
        style={{
          background: `radial-gradient(circle at top right, ${color}, transparent 70%)`
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shrink-0 relative"
              style={{ backgroundColor: color }}
            >
              {Icon ? (
                <Icon size={20} className="sm:w-6 sm:h-6" />
              ) : (
                name[0]?.toUpperCase()
              )}
              
              {/* Status indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border-2 border-[#1c1c1c] ${statusConfig.color} ${statusConfig.glow} ${
                  status === 'active' ? 'animate-pulse' : ''
                }`}
              />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white truncate">
                {name}
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 truncate">{role}</p>
            </div>
          </div>

          {/* Status badge */}
          <span
            className={`text-[10px] px-2 py-1 rounded-md border shrink-0 ml-2 ${
              status === 'active'
                ? 'bg-lime-500/20 text-lime-400 border-lime-500/30'
                : status === 'busy'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : status === 'error'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            }`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs sm:text-sm text-gray-400 line-clamp-2 mb-3">
            {description}
          </p>
        )}

        {/* Footer */}
        {lastActive && (
          <div className="pt-3 border-t border-white/5">
            <p className="text-[10px] sm:text-xs text-gray-500">
              Last active: {lastActive}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
