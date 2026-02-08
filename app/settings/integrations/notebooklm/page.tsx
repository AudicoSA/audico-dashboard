'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BookOpen,
  Upload,
  Check,
  X,
  AlertCircle,
  FileJson,
  Terminal,
  Database,
  BarChart3,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  HardDrive,
  TrendingUp,
  ExternalLink,
  Play,
  Loader2,
  Download,
  FileText,
  Package
} from 'lucide-react'

type NotebookLMConfig = {
  id: string
  google_cloud_project_id: string | null
  service_account_json: any | null
  python_path: string | null
  notebooklm_py_installed: boolean
  connection_tested: boolean
  last_test_date: string | null
  created_at: string
  updated_at: string
}

type PersistentNotebook = {
  id: string
  purpose: string
  notebook_id: string
  sources: string[]
  created_at: string
  last_updated: string
  source_count: number
  statistics: {
    queries_count: number
    artifacts_generated: number
    last_activity: string | null
  }
}

type UsageMetrics = {
  api_calls_count: number
  storage_used_mb: number
  artifact_history: {
    date: string
    count: number
  }[]
}

export default function NotebookLMSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<NotebookLMConfig | null>(null)
  const [notebooks, setNotebooks] = useState<PersistentNotebook[]>([])
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null)
  const [activeTab, setActiveTab] = useState<'setup' | 'notebooks' | 'usage'>('setup')
  
  const [projectId, setProjectId] = useState('')
  const [pythonPath, setPythonPath] = useState('')
  const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null)
  const [serviceAccountJson, setServiceAccountJson] = useState<any>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const [newNotebookPurpose, setNewNotebookPurpose] = useState('')
  const [showAddNotebook, setShowAddNotebook] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [configData, notebooksData, metricsData] = await Promise.all([
        supabase.from('notebooklm_config').select('*').single(),
        supabase.from('notebooklm_notebooks').select('*'),
        supabase.from('notebooklm_usage').select('*').single()
      ])

      if (configData.data) {
        setConfig(configData.data)
        setProjectId(configData.data.google_cloud_project_id || '')
        setPythonPath(configData.data.python_path || '')
        setServiceAccountJson(configData.data.service_account_json)
      }
      if (notebooksData.data) setNotebooks(notebooksData.data)
      if (metricsData.data) setUsageMetrics(metricsData.data)
    } catch (error) {
      console.error('Failed to load NotebookLM settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setServiceAccountFile(file)
    setJsonError(null)

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      
      if (!json.type || !json.project_id || !json.private_key || !json.client_email) {
        setJsonError('Invalid service account JSON. Missing required fields.')
        setServiceAccountJson(null)
        return
      }

      setServiceAccountJson(json)
      setProjectId(json.project_id)
    } catch (error) {
      setJsonError('Failed to parse JSON file. Please ensure it is a valid service account key.')
      setServiceAccountJson(null)
    }
  }

  const checkPythonInstallation = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/notebooklm/check-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pythonPath: pythonPath || 'python' })
      })
      
      const result = await response.json()
      
      if (config) {
        await supabase
          .from('notebooklm_config')
          .update({ notebooklm_py_installed: result.installed })
          .eq('id', config.id)
        
        setConfig({ ...config, notebooklm_py_installed: result.installed })
      }
    } catch (error) {
      console.error('Failed to check Python installation:', error)
    } finally {
      setSaving(false)
    }
  }

  const saveConfiguration = async () => {
    setSaving(true)
    try {
      const configData = {
        google_cloud_project_id: projectId,
        service_account_json: serviceAccountJson,
        python_path: pythonPath || 'python',
        updated_at: new Date().toISOString()
      }

      if (config) {
        await supabase
          .from('notebooklm_config')
          .update(configData)
          .eq('id', config.id)
      } else {
        await supabase
          .from('notebooklm_config')
          .insert([configData])
      }

      await loadData()
      setTestResult(null)
    } catch (error) {
      console.error('Failed to save configuration:', error)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/notebooklm/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          serviceAccountJson,
          pythonPath: pythonPath || 'python'
        })
      })

      const result = await response.json()
      
      setTestResult({
        success: result.success,
        message: result.message
      })

      if (result.success && config) {
        await supabase
          .from('notebooklm_config')
          .update({
            connection_tested: true,
            last_test_date: new Date().toISOString()
          })
          .eq('id', config.id)
        
        await loadData()
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed. Please check your configuration.'
      })
    } finally {
      setTesting(false)
    }
  }

  const addNotebook = async () => {
    if (!newNotebookPurpose.trim()) return

    setSaving(true)
    try {
      const newNotebook = {
        purpose: newNotebookPurpose,
        notebook_id: `notebook_${Date.now()}`,
        sources: [],
        source_count: 0,
        statistics: {
          queries_count: 0,
          artifacts_generated: 0,
          last_activity: null
        },
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }

      await supabase.from('notebooklm_notebooks').insert([newNotebook])
      await loadData()
      setNewNotebookPurpose('')
      setShowAddNotebook(false)
    } catch (error) {
      console.error('Failed to add notebook:', error)
    } finally {
      setSaving(false)
    }
  }

  const removeNotebook = async (id: string) => {
    if (!confirm('Are you sure you want to remove this notebook?')) return

    setSaving(true)
    try {
      await supabase.from('notebooklm_notebooks').delete().eq('id', id)
      setNotebooks(notebooks.filter(n => n.id !== id))
    } catch (error) {
      console.error('Failed to remove notebook:', error)
    } finally {
      setSaving(false)
    }
  }

  const addSourceToNotebook = async (notebookId: string) => {
    const sourceUrl = prompt('Enter source URL or path:')
    if (!sourceUrl) return

    setSaving(true)
    try {
      const notebook = notebooks.find(n => n.id === notebookId)
      if (!notebook) return

      const updatedSources = [...notebook.sources, sourceUrl]
      await supabase
        .from('notebooklm_notebooks')
        .update({
          sources: updatedSources,
          source_count: updatedSources.length,
          last_updated: new Date().toISOString()
        })
        .eq('id', notebookId)

      await loadData()
    } catch (error) {
      console.error('Failed to add source:', error)
    } finally {
      setSaving(false)
    }
  }

  const removeSourceFromNotebook = async (notebookId: string, sourceIndex: number) => {
    setSaving(true)
    try {
      const notebook = notebooks.find(n => n.id === notebookId)
      if (!notebook) return

      const updatedSources = notebook.sources.filter((_, i) => i !== sourceIndex)
      await supabase
        .from('notebooklm_notebooks')
        .update({
          sources: updatedSources,
          source_count: updatedSources.length,
          last_updated: new Date().toISOString()
        })
        .eq('id', notebookId)

      await loadData()
    } catch (error) {
      console.error('Failed to remove source:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400 flex items-center gap-2">
          <Loader2 className="animate-spin" />
          Loading NotebookLM settings...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">NotebookLM Integration</h1>
          <p className="text-gray-400 mt-1">Configure and manage NotebookLM for AI-powered research and content generation</p>
        </div>
        <BookOpen className="text-lime-400" size={32} />
      </div>

      <div className="flex gap-2 border-b border-white/5">
        <button
          onClick={() => setActiveTab('setup')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'setup'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          Setup & Configuration
        </button>
        <button
          onClick={() => setActiveTab('notebooks')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'notebooks'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          Notebook Management
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-6 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'usage'
              ? 'text-lime-400 border-lime-400'
              : 'text-gray-400 border-transparent hover:text-white'
          }`}
        >
          Usage Monitoring
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'setup' && (
          <div className="space-y-6">
            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Database size={20} className="text-lime-400" />
                Google Cloud Project Setup
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Project ID</label>
                  <input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="your-gcp-project-id"
                    className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Service Account JSON</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="service-account-upload"
                    />
                    <label
                      htmlFor="service-account-upload"
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#121212] border border-white/10 rounded-xl text-gray-400 hover:bg-white/5 cursor-pointer transition-colors"
                    >
                      <Upload size={18} />
                      {serviceAccountFile ? serviceAccountFile.name : 'Upload service account JSON file'}
                    </label>
                  </div>
                  
                  {jsonError && (
                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                      <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-red-400">{jsonError}</span>
                    </div>
                  )}
                  
                  {serviceAccountJson && !jsonError && (
                    <div className="mt-2 p-3 bg-lime-400/10 border border-lime-400/20 rounded-xl flex items-start gap-2">
                      <Check size={18} className="text-lime-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <div className="text-lime-400 font-medium">Valid service account</div>
                        <div className="text-gray-400 mt-1">
                          Project: {serviceAccountJson.project_id}<br />
                          Email: {serviceAccountJson.client_email}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={saveConfiguration}
                    disabled={saving || !projectId || !serviceAccountJson}
                    className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Terminal size={20} className="text-lime-400" />
                Python Fallback Configuration
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Python Path</label>
                  <input
                    type="text"
                    value={pythonPath}
                    onChange={(e) => setPythonPath(e.target.value)}
                    placeholder="python (default) or /path/to/python"
                    className="w-full px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Package size={20} className="text-lime-400" />
                    <div>
                      <div className="text-sm font-medium text-white">notebooklm-py Installation</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {config?.notebooklm_py_installed ? (
                          <span className="text-lime-400">Installed and ready</span>
                        ) : (
                          <span className="text-yellow-400">Not detected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={checkPythonInstallation}
                    disabled={saving}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors flex items-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Check Installation
                  </button>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="text-sm text-blue-300">
                    <strong>Installation command:</strong>
                    <code className="block mt-2 p-2 bg-black/30 rounded font-mono text-xs">
                      pip install notebooklm-py
                    </code>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity size={20} className="text-lime-400" />
                Connection Test
              </h3>
              
              <p className="text-sm text-gray-400 mb-4">
                Test your configuration by creating a sample notebook and generating an infographic.
              </p>

              <button
                onClick={testConnection}
                disabled={testing || !config?.google_cloud_project_id || !config?.service_account_json}
                className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    Run Connection Test
                  </>
                )}
              </button>

              {testResult && (
                <div className={`mt-4 p-4 rounded-xl border ${
                  testResult.success 
                    ? 'bg-lime-400/10 border-lime-400/20' 
                    : 'bg-red-500/10 border-red-500/20'
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <Check size={18} className="text-lime-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <X size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <div className={`text-sm font-medium ${
                        testResult.success ? 'text-lime-400' : 'text-red-400'
                      }`}>
                        {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{testResult.message}</div>
                    </div>
                  </div>
                </div>
              )}

              {config?.connection_tested && config?.last_test_date && (
                <div className="mt-4 text-xs text-gray-500">
                  Last tested: {new Date(config.last_test_date).toLocaleString()}
                </div>
              )}
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText size={20} className="text-lime-400" />
                Documentation & Resources
              </h3>
              
              <div className="space-y-3">
                <a
                  href="https://cloud.google.com/vertex-ai/generative-ai/docs/notebooklm/overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-lime-400/10">
                      <FileText size={18} className="text-lime-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">NotebookLM Enterprise Documentation</div>
                      <div className="text-xs text-gray-400">Official Google Cloud Vertex AI docs</div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>

                <a
                  href="https://github.com/raivisdejus/notebooklm-python"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-lime-400/10">
                      <Terminal size={18} className="text-lime-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">notebooklm-py (Unofficial Library)</div>
                      <div className="text-xs text-gray-400">Python library on GitHub</div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>

                <a
                  href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-lime-400/10">
                      <Database size={18} className="text-lime-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Google Cloud Service Accounts</div>
                      <div className="text-xs text-gray-400">Create and manage service accounts</div>
                    </div>
                  </div>
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notebooks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-white">Persistent Notebooks</h3>
                <p className="text-sm text-gray-400">Manage notebooks organized by purpose</p>
              </div>
              <button
                onClick={() => setShowAddNotebook(true)}
                className="px-4 py-2 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Add Notebook
              </button>
            </div>

            {showAddNotebook && (
              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                <h4 className="text-md font-semibold text-white mb-4">Create New Notebook</h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newNotebookPurpose}
                    onChange={(e) => setNewNotebookPurpose(e.target.value)}
                    placeholder="Enter notebook purpose (e.g., Product Research, Customer Insights)"
                    className="flex-1 px-4 py-2 bg-[#121212] border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-lime-500/50"
                  />
                  <button
                    onClick={addNotebook}
                    disabled={saving || !newNotebookPurpose.trim()}
                    className="px-6 py-2 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowAddNotebook(false)
                      setNewNotebookPurpose('')
                    }}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {notebooks.map(notebook => (
                <div key={notebook.id} className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-lime-400/10">
                        <BookOpen size={20} className="text-lime-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">{notebook.purpose}</h4>
                        <p className="text-sm text-gray-400">ID: {notebook.notebook_id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeNotebook(notebook.id)}
                      disabled={saving}
                      className="p-2 hover:bg-red-500/20 rounded-xl text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="text-xs text-gray-400">Sources</div>
                      <div className="text-xl font-bold text-white mt-1">{notebook.source_count}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="text-xs text-gray-400">Queries</div>
                      <div className="text-xl font-bold text-white mt-1">{notebook.statistics.queries_count}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl">
                      <div className="text-xs text-gray-400">Artifacts</div>
                      <div className="text-xl font-bold text-white mt-1">{notebook.statistics.artifacts_generated}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium text-gray-400">Sources</h5>
                      <button
                        onClick={() => addSourceToNotebook(notebook.id)}
                        disabled={saving}
                        className="text-xs px-3 py-1 bg-lime-400/10 hover:bg-lime-400/20 text-lime-400 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Plus size={12} />
                        Add Source
                      </button>
                    </div>
                    
                    {notebook.sources.length > 0 ? (
                      <div className="space-y-2">
                        {notebook.sources.map((source, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                            <span className="text-sm text-gray-300 truncate flex-1">{source}</span>
                            <button
                              onClick={() => removeSourceFromNotebook(notebook.id, index)}
                              disabled={saving}
                              className="ml-2 p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic p-3 bg-white/5 rounded-lg">
                        No sources added yet
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
                    Last updated: {new Date(notebook.last_updated).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {notebooks.length === 0 && (
              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-12 text-center">
                <BookOpen size={48} className="text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No notebooks configured</h3>
                <p className="text-gray-400 mb-6">Create persistent notebooks for different research purposes</p>
                <button
                  onClick={() => setShowAddNotebook(true)}
                  className="px-6 py-3 bg-lime-400 hover:bg-lime-500 text-black font-semibold rounded-xl transition-colors"
                >
                  Create Your First Notebook
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <Activity size={20} className="text-lime-400" />
                  <div className="px-3 py-1 bg-lime-400/10 rounded-full">
                    <span className="text-xs font-medium text-lime-400">This Month</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {usageMetrics?.api_calls_count || 0}
                </div>
                <div className="text-sm text-gray-400">API Calls</div>
              </div>

              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <HardDrive size={20} className="text-lime-400" />
                  <div className="px-3 py-1 bg-blue-400/10 rounded-full">
                    <span className="text-xs font-medium text-blue-400">Total</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {usageMetrics?.storage_used_mb ? `${usageMetrics.storage_used_mb.toFixed(2)} MB` : '0 MB'}
                </div>
                <div className="text-sm text-gray-400">Storage Used</div>
              </div>

              <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <TrendingUp size={20} className="text-lime-400" />
                  <div className="px-3 py-1 bg-purple-400/10 rounded-full">
                    <span className="text-xs font-medium text-purple-400">Total</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">
                  {usageMetrics?.artifact_history.reduce((sum, item) => sum + item.count, 0) || 0}
                </div>
                <div className="text-sm text-gray-400">Artifacts Generated</div>
              </div>
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 size={20} className="text-lime-400" />
                Artifact Generation History
              </h3>
              
              {usageMetrics?.artifact_history && usageMetrics.artifact_history.length > 0 ? (
                <div className="space-y-2">
                  {usageMetrics.artifact_history.map((item, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="text-sm text-gray-400 w-24">{item.date}</div>
                      <div className="flex-1 bg-white/5 rounded-full h-8 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-lime-400 to-emerald-400 flex items-center justify-end pr-3"
                          style={{ 
                            width: `${Math.max((item.count / Math.max(...usageMetrics.artifact_history.map(h => h.count))) * 100, 5)}%` 
                          }}
                        >
                          <span className="text-xs font-medium text-black">{item.count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <BarChart3 size={48} className="mx-auto mb-3 text-gray-600" />
                  <p>No artifact generation history available</p>
                </div>
              )}
            </div>

            <div className="bg-[#1c1c1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Usage Details</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Active Notebooks</span>
                  <span className="text-sm font-semibold text-white">{notebooks.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Total Sources</span>
                  <span className="text-sm font-semibold text-white">
                    {notebooks.reduce((sum, nb) => sum + nb.source_count, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Total Queries</span>
                  <span className="text-sm font-semibold text-white">
                    {notebooks.reduce((sum, nb) => sum + nb.statistics.queries_count, 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl">
                  <span className="text-sm text-gray-400">Average Sources per Notebook</span>
                  <span className="text-sm font-semibold text-white">
                    {notebooks.length > 0 
                      ? (notebooks.reduce((sum, nb) => sum + nb.source_count, 0) / notebooks.length).toFixed(1)
                      : '0'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
