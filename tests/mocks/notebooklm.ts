import { vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

export class MockNotebookLMService {
  private notebooks: Map<string, any> = new Map()
  private artifacts: Map<string, any> = new Map()
  private sources: Map<string, any[]> = new Map()

  clearAll() {
    this.notebooks.clear()
    this.artifacts.clear()
    this.sources.clear()
  }

  async createNotebook(title: string, purpose: string) {
    const notebookId = `notebook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const notebook = {
      notebookId,
      title,
      purpose,
      createdAt: new Date().toISOString()
    }

    this.notebooks.set(notebookId, notebook)
    this.sources.set(notebookId, [])

    return notebook
  }

  async addSources(notebookId: string, sources: any[]) {
    if (!this.notebooks.has(notebookId)) {
      throw new Error(`Notebook ${notebookId} not found`)
    }

    const existingSources = this.sources.get(notebookId) || []
    this.sources.set(notebookId, [...existingSources, ...sources])

    return true
  }

  async generateInfographic(
    notebookId: string,
    prompt: string,
    orientation: 'portrait' | 'landscape' | 'square' = 'landscape'
  ) {
    if (!this.notebooks.has(notebookId)) {
      throw new Error(`Notebook ${notebookId} not found`)
    }

    const artifactId = `infographic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.artifacts.set(artifactId, {
      type: 'infographic',
      notebookId,
      prompt,
      orientation,
      createdAt: new Date().toISOString()
    })

    return artifactId
  }

  async generateSlides(
    notebookId: string,
    prompt: string,
    audience: string = 'general'
  ) {
    if (!this.notebooks.has(notebookId)) {
      throw new Error(`Notebook ${notebookId} not found`)
    }

    const artifactId = `slides-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.artifacts.set(artifactId, {
      type: 'slides',
      notebookId,
      prompt,
      audience,
      createdAt: new Date().toISOString()
    })

    return artifactId
  }

  async generateVideoOverview(
    notebookId: string,
    format: 'mp4' | 'webm' = 'mp4',
    visualStyle: 'minimal' | 'dynamic' | 'professional' = 'professional'
  ) {
    if (!this.notebooks.has(notebookId)) {
      throw new Error(`Notebook ${notebookId} not found`)
    }

    const artifactId = `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    this.artifacts.set(artifactId, {
      type: 'video',
      notebookId,
      format,
      visualStyle,
      createdAt: new Date().toISOString()
    })

    return artifactId
  }

  async downloadArtifact(artifactId: string, outputPath: string) {
    if (!this.artifacts.has(artifactId)) {
      throw new Error(`Artifact ${artifactId} not found`)
    }

    const artifact = this.artifacts.get(artifactId)
    const outputDir = path.dirname(outputPath)

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const mockContent = `Mock ${artifact.type} content for artifact ${artifactId}`
    fs.writeFileSync(outputPath, mockContent)

    return {
      success: true,
      outputPath,
      size: Buffer.byteLength(mockContent)
    }
  }

  getNotebook(notebookId: string) {
    return this.notebooks.get(notebookId)
  }

  getArtifact(artifactId: string) {
    return this.artifacts.get(artifactId)
  }

  getSources(notebookId: string) {
    return this.sources.get(notebookId) || []
  }
}

export const mockNotebookLM = new MockNotebookLMService()
