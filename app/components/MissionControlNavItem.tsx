'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function MissionControlNavItem() {
  const [urgentCount, setUrgentCount] = useState(0)

  useEffect(() => {
    fetchUrgentCount()

    // Real-time subscription for squad_tasks
    const tasksChannel = supabase
      .channel('mission_control_tasks_count')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'squad_tasks' },
        () => {
          fetchUrgentCount()
        }
      )
      .subscribe()

    // Real-time subscription for email_logs
    const emailsChannel = supabase
      .channel('mission_control_emails_count')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'email_logs' },
        () => {
          fetchUrgentCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(tasksChannel)
      supabase.removeChannel(emailsChannel)
    }
  }, [])

  const fetchUrgentCount = async () => {
    try {
      // Count Kenny mentions in squad_tasks (not completed)
      const { data: tasks, error: tasksError } = await supabase
        .from('squad_tasks')
        .select('id')
        .eq('mentions_kenny', true)
        .neq('status', 'completed')

      // Count Kenny mentions in email_logs (not sent or archived)
      const { data: emails, error: emailsError } = await supabase
        .from('email_logs')
        .select('id, payload')
        .not('status', 'in', '("sent","archived")')

      let emailKennyCount = 0
      if (emails) {
        emailKennyCount = emails.filter(e => e.payload?.mentions_kenny === true).length
      }

      const taskKennyCount = tasks?.length || 0
      const total = taskKennyCount + emailKennyCount

      setUrgentCount(total)
    } catch (err) {
      console.error('Error fetching urgent count:', err)
    }
  }

  return (
    <Link
      href="/squad"
      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all group relative"
    >
      <span className="group-hover:text-lime-400 transition-colors">
        <Users size={22} />
      </span>
      <span className="hidden lg:block font-medium">AI Agent Command</span>
      
      {urgentCount > 0 && (
        <span className="absolute top-2 right-2 lg:relative lg:top-0 lg:right-0 lg:ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse">
          {urgentCount}
        </span>
      )}
    </Link>
  )
}
