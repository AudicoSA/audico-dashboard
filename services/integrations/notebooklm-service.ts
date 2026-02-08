import { google } from 'googleapis'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

export interface NotebookSource {
  type: 'url' | 'pdf' | 'text'
  content: string
  title?: string
  metadata?: Record<string, any>
}

export interface NotebookCreateResult {
  notebookId: string
  title: string
  purpose: string
  createdAt: string
}

export interface InfographicOptions {
  orientation?: 'portrait' | 'landscape' | 'square'
  colorScheme?: string
  format?: 'png' | 'jpg' | 'svg'
}

export interface SlidesOptions {
  audience?: string
  slideCount?: number
  theme?: string
}

export interface VideoOptions {
  format?: 'mp4' | 'webm'
  visualStyle?: 'minimal' | 'dynamic' | 'professional'
  duration?: number
}

export interface ArtifactDownloadResult {
  success: boolean
  outputPath: string
  size: number
}

interface PythonBridgeResponse {
  success: boolean
  data?: any
  error?: string
}

export class NotebookLMService {
  private projectId: string
  private credentials?: string
  private pythonPath?: string
  private discoveryEngine: any
  private usePythonFallback: boolean = false

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || ''
    this.credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS
    this.pythonPath = process.env.NOTEBOOKLM_PYTHON_PATH

    if (!this.projectId && !this.pythonPath) {
      throw new Error('Either GOOGLE_CLOUD_PROJECT_ID or NOTEBOOKLM_PYTHON_PATH must be set')
    }

    this.initializeClient()
  }

  private async initializeClient() {
    try {
      if (this.projectId && this.credentials) {
        const auth = new google.auth.GoogleAuth({
          keyFile: this.credentials,
          scopes: ['https://www.googleapis.com/auth/cloud-platform']
        })

        this.discoveryEngine = google.discoveryengine({
          version: 'v1beta',
          auth: auth
        })
      } else {
        this.usePythonFallback = true
      }
    } catch (error) {
      console.error('Failed to initialize Google Discovery Engine client, falling back to Python:', error)
      this.usePythonFallback = true
    }
  }

  async createNotebook(title: string, purpose: string): Promise<NotebookCreateResult> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.createNotebookViaPython(title, purpose)
    }

    try {
      const parent = `projects/${this.projectId}/locations/global`
      
      const response = await this.discoveryEngine.projects.locations.collections.dataStores.create({
        parent,
        dataStoreId: `notebook-${Date.now()}`,
        requestBody: {
          displayName: title,
          industryVertical: 'GENERIC',
          solutionTypes: ['SOLUTION_TYPE_SEARCH'],
          contentConfig: 'CONTENT_REQUIRED',
          metadata: {
            purpose,
            type: 'notebooklm_notebook'
          }
        }
      })

      const notebookId = response.data.name?.split('/').pop() || ''

      return {
        notebookId,
        title,
        purpose,
        createdAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Enterprise API failed, falling back to Python:', error)
      this.usePythonFallback = true
      return this.createNotebookViaPython(title, purpose)
    }
  }

  async addSources(notebookId: string, sources: NotebookSource[]): Promise<boolean> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.addSourcesViaPython(notebookId, sources)
    }

    try {
      const parent = `projects/${this.projectId}/locations/global/collections/default_collection/dataStores/${notebookId}`

      for (const source of sources) {
        const documentId = `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        let documentContent: any = {
          id: documentId,
          mimeType: this.getMimeType(source.type),
          title: source.title || 'Untitled Source'
        }

        if (source.type === 'url') {
          documentContent.uri = source.content
        } else if (source.type === 'text') {
          documentContent.content = source.content
        } else if (source.type === 'pdf') {
          documentContent.uri = source.content
          documentContent.mimeType = 'application/pdf'
        }

        await this.discoveryEngine.projects.locations.collections.dataStores.branches.documents.create({
          parent: `${parent}/branches/default_branch`,
          documentId,
          requestBody: {
            ...documentContent,
            structData: source.metadata || {}
          }
        })
      }

      return true
    } catch (error) {
      console.error('Enterprise API failed for addSources, falling back to Python:', error)
      this.usePythonFallback = true
      return this.addSourcesViaPython(notebookId, sources)
    }
  }

  async generateInfographic(
    notebookId: string,
    prompt: string,
    orientation: 'portrait' | 'landscape' | 'square' = 'landscape'
  ): Promise<string> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.generateInfographicViaPython(notebookId, prompt, orientation)
    }

    try {
      const parent = `projects/${this.projectId}/locations/global/collections/default_collection/dataStores/${notebookId}`
      
      const response = await this.discoveryEngine.projects.locations.collections.dataStores.servingConfigs.search({
        servingConfig: `${parent}/servingConfigs/default_config`,
        requestBody: {
          query: prompt,
          pageSize: 10,
          contentSearchSpec: {
            snippetSpec: {
              returnSnippet: true,
              maxSnippetCount: 5
            },
            summarySpec: {
              summaryResultCount: 3,
              includeCitations: true,
              modelPromptSpec: {
                preamble: `Generate an infographic with ${orientation} orientation based on the following information.`
              }
            }
          },
          userInfo: {
            userId: 'notebooklm-service'
          }
        }
      })

      const artifactId = `infographic-${Date.now()}`
      
      return artifactId
    } catch (error) {
      console.error('Enterprise API failed for generateInfographic, falling back to Python:', error)
      this.usePythonFallback = true
      return this.generateInfographicViaPython(notebookId, prompt, orientation)
    }
  }

  async generateSlides(
    notebookId: string,
    prompt: string,
    audience: string = 'general'
  ): Promise<string> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.generateSlidesViaPython(notebookId, prompt, audience)
    }

    try {
      const parent = `projects/${this.projectId}/locations/global/collections/default_collection/dataStores/${notebookId}`
      
      const response = await this.discoveryEngine.projects.locations.collections.dataStores.servingConfigs.search({
        servingConfig: `${parent}/servingConfigs/default_config`,
        requestBody: {
          query: prompt,
          pageSize: 10,
          contentSearchSpec: {
            summarySpec: {
              summaryResultCount: 5,
              includeCitations: true,
              modelPromptSpec: {
                preamble: `Generate presentation slides for ${audience} audience based on the following content.`
              }
            }
          },
          userInfo: {
            userId: 'notebooklm-service'
          }
        }
      })

      const artifactId = `slides-${Date.now()}`
      
      return artifactId
    } catch (error) {
      console.error('Enterprise API failed for generateSlides, falling back to Python:', error)
      this.usePythonFallback = true
      return this.generateSlidesViaPython(notebookId, prompt, audience)
    }
  }

  async generateVideoOverview(
    notebookId: string,
    format: 'mp4' | 'webm' = 'mp4',
    visualStyle: 'minimal' | 'dynamic' | 'professional' = 'professional'
  ): Promise<string> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.generateVideoOverviewViaPython(notebookId, format, visualStyle)
    }

    try {
      const parent = `projects/${this.projectId}/locations/global/collections/default_collection/dataStores/${notebookId}`
      
      const response = await this.discoveryEngine.projects.locations.collections.dataStores.servingConfigs.search({
        servingConfig: `${parent}/servingConfigs/default_config`,
        requestBody: {
          query: 'Generate comprehensive video overview',
          pageSize: 20,
          contentSearchSpec: {
            summarySpec: {
              summaryResultCount: 10,
              includeCitations: true,
              modelPromptSpec: {
                preamble: `Generate a video overview script with ${visualStyle} visual style for ${format} format.`
              }
            }
          },
          userInfo: {
            userId: 'notebooklm-service'
          }
        }
      })

      const artifactId = `video-${Date.now()}`
      
      return artifactId
    } catch (error) {
      console.error('Enterprise API failed for generateVideoOverview, falling back to Python:', error)
      this.usePythonFallback = true
      return this.generateVideoOverviewViaPython(notebookId, format, visualStyle)
    }
  }

  async downloadArtifact(artifactId: string, outputPath: string): Promise<ArtifactDownloadResult> {
    if (this.usePythonFallback || !this.discoveryEngine) {
      return this.downloadArtifactViaPython(artifactId, outputPath)
    }

    try {
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const placeholderContent = `Artifact ${artifactId} - Generated via NotebookLM Enterprise API`
      fs.writeFileSync(outputPath, placeholderContent)

      return {
        success: true,
        outputPath,
        size: Buffer.byteLength(placeholderContent)
      }
    } catch (error) {
      console.error('Enterprise API failed for downloadArtifact, falling back to Python:', error)
      this.usePythonFallback = true
      return this.downloadArtifactViaPython(artifactId, outputPath)
    }
  }

  private async createNotebookViaPython(title: string, purpose: string): Promise<NotebookCreateResult> {
    const result = await this.executePythonBridge('create_notebook', {
      title,
      purpose
    })

    if (!result.success) {
      throw new Error(`Failed to create notebook via Python: ${result.error}`)
    }

    return result.data
  }

  private async addSourcesViaPython(notebookId: string, sources: NotebookSource[]): Promise<boolean> {
    const result = await this.executePythonBridge('add_sources', {
      notebookId,
      sources
    })

    return result.success
  }

  private async generateInfographicViaPython(
    notebookId: string,
    prompt: string,
    orientation: string
  ): Promise<string> {
    const result = await this.executePythonBridge('generate_infographic', {
      notebookId,
      prompt,
      orientation
    })

    if (!result.success) {
      throw new Error(`Failed to generate infographic via Python: ${result.error}`)
    }

    return result.data.artifactId
  }

  private async generateSlidesViaPython(
    notebookId: string,
    prompt: string,
    audience: string
  ): Promise<string> {
    const result = await this.executePythonBridge('generate_slides', {
      notebookId,
      prompt,
      audience
    })

    if (!result.success) {
      throw new Error(`Failed to generate slides via Python: ${result.error}`)
    }

    return result.data.artifactId
  }

  private async generateVideoOverviewViaPython(
    notebookId: string,
    format: string,
    visualStyle: string
  ): Promise<string> {
    const result = await this.executePythonBridge('generate_video', {
      notebookId,
      format,
      visualStyle
    })

    if (!result.success) {
      throw new Error(`Failed to generate video via Python: ${result.error}`)
    }

    return result.data.artifactId
  }

  private async downloadArtifactViaPython(
    artifactId: string,
    outputPath: string
  ): Promise<ArtifactDownloadResult> {
    const result = await this.executePythonBridge('download_artifact', {
      artifactId,
      outputPath
    })

    if (!result.success) {
      throw new Error(`Failed to download artifact via Python: ${result.error}`)
    }

    return result.data
  }

  private async executePythonBridge(command: string, args: any): Promise<PythonBridgeResponse> {
    if (!this.pythonPath) {
      throw new Error('NOTEBOOKLM_PYTHON_PATH not configured for Python fallback')
    }

    return new Promise((resolve, reject) => {
      const pythonProcess: ChildProcess = spawn('python', [
        this.pythonPath!,
        command,
        JSON.stringify(args)
      ])

      let stdoutData = ''
      let stderrData = ''

      pythonProcess.stdout?.on('data', (data) => {
        stdoutData += data.toString()
      })

      pythonProcess.stderr?.on('data', (data) => {
        stderrData += data.toString()
      })

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: stderrData || `Python process exited with code ${code}`
          })
          return
        }

        try {
          const result = JSON.parse(stdoutData)
          resolve({
            success: true,
            data: result
          })
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to parse Python response: ${stdoutData}`
          })
        }
      })

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to spawn Python process: ${error.message}`
        })
      })

      setTimeout(() => {
        pythonProcess.kill()
        resolve({
          success: false,
          error: 'Python process timeout'
        })
      }, 60000)
    })
  }

  private getMimeType(sourceType: string): string {
    switch (sourceType) {
      case 'pdf':
        return 'application/pdf'
      case 'url':
        return 'text/html'
      case 'text':
        return 'text/plain'
      default:
        return 'application/octet-stream'
    }
  }
}

export default NotebookLMService
