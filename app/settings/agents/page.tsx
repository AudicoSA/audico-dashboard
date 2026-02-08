'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Settings, 
  Key, 
  Mail, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin,
  Youtube,
  Globe,
  Bell,
  Clock,
  DollarSign,
  Power,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react'

type AgentConfig = {
  id: string
  name: string
  enabled: boolean
  schedule: {
    enabled: boolean
    intervals: string[]
    timezone: string
  }
  token_budget: {
    daily_limit: number
    per_request_max: number
    current_usage: number
  }
  behavior_settings: {
    auto_approve: boolean
    require_review: boolean
    max_retries: number
    timeout_seconds: number
  }
}

type APICredential = {
  id: string
  service: string
  key_name: string
  key_value: string
  expires_at: string | null
  created_at: string
}

type NotificationPreference = {
  id: string
  event_type: string
  enabled: boolean
  channels: string[]
  kenny_mentions_only: boolean
}

export default function AgentSettingsPage() {
  const [activeTab, setActiveTab] = useState<'agents' | 'credentials' | 'notifications'>('agents')
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [credentials, setCredentials] = useState<APICredential[]>([])
  const [notifications, setNotifications] = useState<NotificationPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showNewCredentialModal, setShowNewCredentialModal] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [agentsData, credsData, notifsData] = await Promise.all([
        supabase.from('agent_configs').select('*'),
        supabase.from('api_credentials').select('*'),
        supabase.from('notification_preferences').select('*')
      ])

      if (agentsData.data) setAgents(agentsData.data)
      if (credsData.data) setCredentials(credsData.data)
      if (notifsData.data) setNotifications(notifsData.data)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveAgentConfig = async (agentId: string, updates: Partial<AgentConfig>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('agent_configs')
        .update(updates)
        .eq('id', agentId)

      if (!error) {
        setAgents(agents.map(a => a.id === agentId ? { ...a, ...updates } : a))
      }
    } catch (error) {
      console.error('Failed to save agent config:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveCredential = async (cred: Partial<APICredential>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('api_credentials')
        .insert([cred])

      if (!error) {
        await loadData()
        setShowNewCredentialModal(false)
      }
    } catch (error) {
      console.error('Failed to save credential:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteCredential = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('api_credentials')
        .delete()
        .eq('id', id)

      if (!error) {
        setCredentials(credentials.filter(c => c.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete credential:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveNotificationPreference = async (notifId: string, updates: Partial<NotificationPreference>) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('id', notifId)

      if (!error) {
        setNotifications(notifications.map(n => n.id === notifId ? { ...n, ...updates } : n))
      }
    } catch (error) {
      console.error('Failed to save notification preference:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Agent Settings</h1>
          <p className="text-gray-400 mt-1">Configure AI agents, credentials, and notifications</p>
        </div>
        <Settings className="text-lime-400" size={32} />
      </div>

      <div className="flex gap-2 border-b border-white/5">
        <button
          onClick={() => setActiveTab('agents')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'agents'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          Agent Configuration
        </button>
        <button
          onClick={() => setActiveTab('credentials')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'credentials'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          API Credentials
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'notifications'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          Notifications
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'agents' && (
          <AgentsTab 
            agents={agents} 
            onSave={saveAgentConfig}
            saving={saving}
          />
        )}
        {activeTab === 'credentials' && (
          <CredentialsTab 
            credentials={credentials}
            onDelete={deleteCredential}
            onAdd={() => setShowNewCredentialModal(true)}
            saving={saving}
          />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab 
            notifications={notifications}
            onSave={saveNotificationPreference}
            saving={saving}
          />
        )}
      </div>

      {showNewCredentialModal && (
        <NewCredentialModal
          onClose={() => setShowNewCredentialModal(false)}
          onSave={saveCredential}
          saving={saving}
        />
      )}
    </div>
  )
}

function AgentsTab({ agents, onSave, saving }: { 
  agents: AgentConfig[]
  onSave: (id: string, updates: Partial<AgentConfig>) => void
  saving: boolean
}) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      {agents.map(agent => (
        <div key={agent.id} className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${agent.enabled ? 'bg-lime-400 animate-pulse' : 'bg-gray-500'}`} />
              <div>
                <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                <p className="text-sm text-gray-400">
                  Token Budget: ${agent.token_budget.current_usage.toFixed(2)} / ${agent.token_budget.daily_limit.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSave(agent.id, { enabled: !agent.enabled })}
                disabled={saving}
                className={`px-4 py-2 rounded-xl font-medium transition-colors flex items-center gap-2 ${
                  agent.enabled
                    ? 'bg-lime-400/10 text-lime-400 hover:bg-lime-400/20'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Power size={16} />
                {agent.enabled ? 'Enabled' : 'Disabled'}
              </button>
              <button
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <Settings size={18} className="text-gray-400" />
              </button>
            </div>
          </div>

          {expandedAgent === agent.id && (
            <AgentConfigForm 
              agent={agent} 
              onSave={(updates) => onSave(agent.id, updates)}
              saving={saving}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function AgentConfigForm({ agent, onSave, saving }: {
  agent: AgentConfig
  onSave: (updates: Partial<AgentConfig>) => void
  saving: boolean
}) {
  const [localAgent, setLocalAgent] = useState(agent)
  const [scheduleInterval, setScheduleInterval] = useState('')

  const handleSave = () => {
    onSave(localAgent)
  }

  const addScheduleInterval = () => {
    if (!scheduleInterval.trim()) return
    setLocalAgent({
      ...localAgent,
      schedule: {
        ...localAgent.schedule,
        intervals: [...localAgent.schedule.intervals, scheduleInterval]
      }
    })
    setScheduleInterval('')
  }

  const removeScheduleInterval = (index: number) => {
    setLocalAgent({
      ...localAgent,
      schedule: {
        ...localAgent.schedule,
        intervals: localAgent.schedule.intervals.filter((_, i) => i !== index)
      }
    })
  }

  return (
    <div className="mt-6 pt-6 border-t border-white/5 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={16} className="text-lime-400" />
            Schedule Configuration
          </h4>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id={`schedule-enabled-${agent.id}`}
                checked={localAgent.schedule.enabled}
                onChange={(e) => setLocalAgent({
                  ...localAgent,
                  schedule: { ...localAgent.schedule, enabled: e.target.checked }
                })}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-lime-400 focus:ring-lime-500"
              />
              <label htmlFor={`schedule-enabled-${agent.id}`} className="text-sm text-gray-300">
                Enable scheduled execution
              </label>
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">Timezone</label>
              <input
                type="text"
                value={localAgent.schedule.timezone}
                onChange={(e) => setLocalAgent({
                  ...localAgent,
                  schedule: { ...localAgent.schedule, timezone: e.target.value }
                })}
                className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
                placeholder="UTC, Africa/Johannesburg, etc."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Run Intervals (cron format)</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={scheduleInterval}
                  onChange={(e) => setScheduleInterval(e.target.value)}
                  className="flex-1 px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
                  placeholder="*/5 * * * * (every 5 minutes)"
                />
                <button
                  onClick={addScheduleInterval}
                  className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black rounded-xl transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {localAgent.schedule.intervals.map((interval, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-sm text-gray-300 font-mono">{interval}</span>
                    <button
                      onClick={() => removeScheduleInterval(index)}
                      className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign size={16} className="text-lime-400" />
            Token Budget
          </h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Daily Limit ($)</label>
              <input
                type="number"
                step="0.01"
                value={localAgent.token_budget.daily_limit}
                onChange={(e) => setLocalAgent({
                  ...localAgent,
                  token_budget: { ...localAgent.token_budget, daily_limit: parseFloat(e.target.value) }
                })}
                className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Per Request Max ($)</label>
              <input
                type="number"
                step="0.01"
                value={localAgent.token_budget.per_request_max}
                onChange={(e) => setLocalAgent({
                  ...localAgent,
                  token_budget: { ...localAgent.token_budget, per_request_max: parseFloat(e.target.value) }
                })}
                className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
              />
            </div>
            <div className="p-4 bg-lime-400/10 border border-lime-400/20 rounded-xl">
              <div className="text-sm text-gray-400 mb-1">Current Usage</div>
              <div className="text-2xl font-bold text-lime-400">
                ${localAgent.token_budget.current_usage.toFixed(2)}
              </div>
              <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-lime-400 to-emerald-400"
                  style={{ width: `${Math.min((localAgent.token_budget.current_usage / localAgent.token_budget.daily_limit) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Settings size={16} className="text-lime-400" />
          Behavior Settings
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`auto-approve-${agent.id}`}
              checked={localAgent.behavior_settings.auto_approve}
              onChange={(e) => setLocalAgent({
                ...localAgent,
                behavior_settings: { ...localAgent.behavior_settings, auto_approve: e.target.checked }
              })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-lime-400 focus:ring-lime-500"
            />
            <label htmlFor={`auto-approve-${agent.id}`} className="text-sm text-gray-300">
              Auto-approve actions
            </label>
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id={`require-review-${agent.id}`}
              checked={localAgent.behavior_settings.require_review}
              onChange={(e) => setLocalAgent({
                ...localAgent,
                behavior_settings: { ...localAgent.behavior_settings, require_review: e.target.checked }
              })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-lime-400 focus:ring-lime-500"
            />
            <label htmlFor={`require-review-${agent.id}`} className="text-sm text-gray-300">
              Require human review
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Max Retries</label>
            <input
              type="number"
              value={localAgent.behavior_settings.max_retries}
              onChange={(e) => setLocalAgent({
                ...localAgent,
                behavior_settings: { ...localAgent.behavior_settings, max_retries: parseInt(e.target.value) }
              })}
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Timeout (seconds)</label>
            <input
              type="number"
              value={localAgent.behavior_settings.timeout_seconds}
              onChange={(e) => setLocalAgent({
                ...localAgent,
                behavior_settings: { ...localAgent.behavior_settings, timeout_seconds: parseInt(e.target.value) }
              })}
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  )
}

function CredentialsTab({ credentials, onDelete, onAdd, saving }: {
  credentials: APICredential[]
  onDelete: (id: string) => void
  onAdd: () => void
  saving: boolean
}) {
  const [showValues, setShowValues] = useState<Record<string, boolean>>({})

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case 'gmail': return <Mail size={20} />
      case 'facebook': return <Facebook size={20} />
      case 'twitter': return <Twitter size={20} />
      case 'instagram': return <Instagram size={20} />
      case 'linkedin': return <Linkedin size={20} />
      case 'youtube': return <Youtube size={20} />
      case 'google_ads': return <Globe size={20} />
      default: return <Key size={20} />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white">API Credentials</h3>
          <p className="text-sm text-gray-400">Manage authentication keys for external services</p>
        </div>
        <button
          onClick={onAdd}
          className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors flex items-center gap-2"
        >
          <Plus size={16} />
          Add Credential
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {credentials.map(cred => (
          <div key={cred.id} className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-lime-400/10 text-lime-400">
                  {getServiceIcon(cred.service)}
                </div>
                <div>
                  <h4 className="font-semibold text-white">{cred.service}</h4>
                  <p className="text-sm text-gray-400">{cred.key_name}</p>
                </div>
              </div>
              <button
                onClick={() => onDelete(cred.id)}
                disabled={saving}
                className="p-2 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type={showValues[cred.id] ? 'text' : 'password'}
                  value={cred.key_value}
                  readOnly
                  className="flex-1 px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white text-sm font-mono"
                />
                <button
                  onClick={() => setShowValues({ ...showValues, [cred.id]: !showValues[cred.id] })}
                  className="p-2 hover:bg-white/10 rounded-xl text-gray-400 transition-colors"
                >
                  {showValues[cred.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {cred.expires_at && (
                <p className="text-xs text-gray-500">
                  Expires: {new Date(cred.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {credentials.length === 0 && (
        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
          <Key size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No credentials configured</h3>
          <p className="text-gray-400 mb-6">Add API keys and OAuth tokens to enable agent integrations</p>
          <button
            onClick={onAdd}
            className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors"
          >
            Add Your First Credential
          </button>
        </div>
      )}
    </div>
  )
}

function NotificationsTab({ notifications, onSave, saving }: {
  notifications: NotificationPreference[]
  onSave: (id: string, updates: Partial<NotificationPreference>) => void
  saving: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Notification Preferences</h3>
        <p className="text-sm text-gray-400">Configure when and how you receive notifications</p>
      </div>

      <div className="space-y-4">
        {notifications.map(notif => (
          <div key={notif.id} className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bell className="text-lime-400" size={20} />
                <div>
                  <h4 className="font-semibold text-white capitalize">
                    {notif.event_type.replace(/_/g, ' ')}
                  </h4>
                  <p className="text-sm text-gray-400">
                    Channels: {notif.channels.join(', ') || 'None'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSave(notif.id, { enabled: !notif.enabled })}
                disabled={saving}
                className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                  notif.enabled
                    ? 'bg-lime-400/10 text-lime-400'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {notif.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <input
                  type="checkbox"
                  id={`kenny-only-${notif.id}`}
                  checked={notif.kenny_mentions_only}
                  onChange={(e) => onSave(notif.id, { kenny_mentions_only: e.target.checked })}
                  disabled={saving}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-lime-400 focus:ring-lime-500"
                />
                <label htmlFor={`kenny-only-${notif.id}`} className="text-sm text-gray-300 flex items-center gap-2">
                  <AlertCircle size={16} className="text-lime-400" />
                  Only notify for Kenny mentions
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notification Channels</label>
                <div className="grid grid-cols-2 gap-2">
                  {['email', 'slack', 'sms', 'dashboard'].map(channel => (
                    <button
                      key={channel}
                      onClick={() => {
                        const newChannels = notif.channels.includes(channel)
                          ? notif.channels.filter(c => c !== channel)
                          : [...notif.channels, channel]
                        onSave(notif.id, { channels: newChannels })
                      }}
                      disabled={saving}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${
                        notif.channels.includes(channel)
                          ? 'bg-lime-400/10 text-lime-400 border border-lime-400/20'
                          : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {notif.channels.includes(channel) && <Check size={14} className="inline mr-1" />}
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {notifications.length === 0 && (
        <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
          <Bell size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No notification preferences</h3>
          <p className="text-gray-400">Notification settings will appear here once configured</p>
        </div>
      )}
    </div>
  )
}

function NewCredentialModal({ onClose, onSave, saving }: {
  onClose: () => void
  onSave: (cred: Partial<APICredential>) => void
  saving: boolean
}) {
  const [service, setService] = useState('')
  const [keyName, setKeyName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const services = [
    'Gmail OAuth',
    'Facebook',
    'Twitter',
    'Instagram',
    'LinkedIn',
    'YouTube',
    'TikTok',
    'Google Ads'
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      service,
      key_name: keyName,
      key_value: keyValue,
      expires_at: expiresAt || null
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1c1c1c] border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Add API Credential</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Service</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              required
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white focus:outline-none focus:border-lime-500/50"
            >
              <option value="">Select a service</option>
              {services.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Key Name</label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Client ID, API Key, OAuth Token"
              required
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Key Value</label>
            <textarea
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="Paste your API key, token, or credentials here"
              required
              rows={4}
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Expires At (Optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white focus:outline-none focus:border-lime-500/50"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Credential'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
