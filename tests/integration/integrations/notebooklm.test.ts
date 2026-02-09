import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import NotebookLMService from '@/services/integrations/notebooklm-service'
import * as fs from 'fs'
import * as path from 'path'

describe('NotebookLM Service Integration Tests', () => {
  let service: NotebookLMService
  let testOutputDir: string

  beforeEach(() => {
    process.env.NOTEBOOKLM_PYTHON_PATH = '/mock/python/path'
    
    testOutputDir = path.join(process.cwd(), 'tmp', 'test-notebooklm')
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true })
    }

    service = new NotebookLMService()
  })

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('notebook creation', () => {
    it('should create a new notebook', async () => {
      const notebook = await service.createNotebook(
        'Test Notebook',
        'Testing purposes'
      )

      expect(notebook).toBeDefined()
      expect(notebook.notebookId).toBeDefined()
      expect(notebook.title).toBe('Test Notebook')
      expect(notebook.purpose).toBe('Testing purposes')
      expect(notebook.createdAt).toBeDefined()
    })

    it('should generate unique notebook IDs', async () => {
      const notebook1 = await service.createNotebook('Notebook 1', 'Test')
      const notebook2 = await service.createNotebook('Notebook 2', 'Test')

      expect(notebook1.notebookId).not.toBe(notebook2.notebookId)
    })
  })

  describe('source management', () => {
    it('should add text sources to notebook', async () => {
      const notebook = await service.createNotebook('Test', 'Test')

      const sources = [
        {
          type: 'text' as const,
          content: 'This is test content',
          title: 'Test Source',
          metadata: { category: 'test' }
        }
      ]

      const result = await service.addSources(notebook.notebookId, sources)

      expect(result).toBe(true)
    })

    it('should add multiple sources to notebook', async () => {
      const notebook = await service.createNotebook('Test', 'Test')

      const sources = [
        {
          type: 'text' as const,
          content: 'Content 1',
          title: 'Source 1'
        },
        {
          type: 'url' as const,
          content: 'https://example.com/page',
          title: 'Source 2'
        },
        {
          type: 'pdf' as const,
          content: 'https://example.com/doc.pdf',
          title: 'Source 3'
        }
      ]

      const result = await service.addSources(notebook.notebookId, sources)

      expect(result).toBe(true)
    })

    it('should reject sources for non-existent notebook', async () => {
      const sources = [
        {
          type: 'text' as const,
          content: 'Test',
          title: 'Test'
        }
      ]

      await expect(
        service.addSources('non-existent-notebook', sources)
      ).rejects.toThrow('Notebook')
    })
  })

  describe('artifact generation', () => {
    let notebookId: string

    beforeEach(async () => {
      const notebook = await service.createNotebook('Test Notebook', 'Test')
      notebookId = notebook.notebookId

      await service.addSources(notebookId, [
        {
          type: 'text',
          content: 'Sample content for testing',
          title: 'Test Content'
        }
      ])
    })

    it('should generate infographic', async () => {
      const artifactId = await service.generateInfographic(
        notebookId,
        'Create an infographic about testing',
        'landscape'
      )

      expect(artifactId).toBeDefined()
      expect(typeof artifactId).toBe('string')
      expect(artifactId).toContain('infographic')
    })

    it('should generate slide deck', async () => {
      const artifactId = await service.generateSlides(
        notebookId,
        'Create slides about testing',
        'developers'
      )

      expect(artifactId).toBeDefined()
      expect(typeof artifactId).toBe('string')
      expect(artifactId).toContain('slides')
    })

    it('should generate video overview', async () => {
      const artifactId = await service.generateVideoOverview(
        notebookId,
        'mp4',
        'professional'
      )

      expect(artifactId).toBeDefined()
      expect(typeof artifactId).toBe('string')
      expect(artifactId).toContain('video')
    })
  })

  describe('artifact download', () => {
    let notebookId: string
    let artifactId: string

    beforeEach(async () => {
      const notebook = await service.createNotebook('Test', 'Test')
      notebookId = notebook.notebookId

      await service.addSources(notebookId, [
        { type: 'text', content: 'Test content', title: 'Test' }
      ])

      artifactId = await service.generateInfographic(
        notebookId,
        'Test prompt',
        'landscape'
      )
    })

    it('should download artifact to file', async () => {
      const outputPath = path.join(testOutputDir, 'test-artifact.png')

      const result = await service.downloadArtifact(artifactId, outputPath)

      expect(result.success).toBe(true)
      expect(result.outputPath).toBe(outputPath)
      expect(result.size).toBeGreaterThan(0)
      expect(fs.existsSync(outputPath)).toBe(true)
    })
  })
})
