import NotebookLMService, {
  NotebookSource,
  NotebookCreateResult,
  ArtifactDownloadResult
} from './notebooklm-service'
import { withResilience } from '../../lib/resilience'

export class ResilientNotebookLMService extends NotebookLMService {
  async createNotebook(title: string, purpose: string): Promise<NotebookCreateResult> {
    return withResilience(
      'notebooklm-api',
      () => super.createNotebook(title, purpose)
    )
  }

  async addSources(notebookId: string, sources: NotebookSource[]): Promise<boolean> {
    return withResilience(
      'notebooklm-api',
      () => super.addSources(notebookId, sources),
      { fallbackValue: false }
    )
  }

  async generateInfographic(
    notebookId: string,
    prompt: string,
    orientation: 'portrait' | 'landscape' | 'square' = 'landscape'
  ): Promise<string> {
    return withResilience(
      'notebooklm-api',
      () => super.generateInfographic(notebookId, prompt, orientation)
    )
  }

  async generateSlides(
    notebookId: string,
    prompt: string,
    audience: string = 'general'
  ): Promise<string> {
    return withResilience(
      'notebooklm-api',
      () => super.generateSlides(notebookId, prompt, audience)
    )
  }

  async generateVideoOverview(
    notebookId: string,
    format: 'mp4' | 'webm' = 'mp4',
    visualStyle: 'minimal' | 'dynamic' | 'professional' = 'professional'
  ): Promise<string> {
    return withResilience(
      'notebooklm-api',
      () => super.generateVideoOverview(notebookId, format, visualStyle)
    )
  }

  async downloadArtifact(artifactId: string, outputPath: string): Promise<ArtifactDownloadResult> {
    return withResilience(
      'notebooklm-api',
      () => super.downloadArtifact(artifactId, outputPath),
      {
        fallbackValue: {
          success: false,
          outputPath,
          size: 0
        }
      }
    )
  }
}

export default ResilientNotebookLMService
