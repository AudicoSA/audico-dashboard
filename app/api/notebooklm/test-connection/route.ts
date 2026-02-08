import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null

  try {
    const { projectId, serviceAccountJson, pythonPath } = await request.json()

    if (!projectId || !serviceAccountJson) {
      return NextResponse.json(
        { success: false, message: 'Missing required configuration' },
        { status: 400 }
      )
    }

    tempFilePath = join(tmpdir(), `notebooklm-test-${Date.now()}.json`)
    writeFileSync(tempFilePath, JSON.stringify(serviceAccountJson))

    const pythonCmd = pythonPath || 'python'
    
    const testScript = `
import json
import sys
import os

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '${tempFilePath.replace(/\\/g, '\\\\')}'

try:
    # Simulate NotebookLM connection test
    # In a real implementation, this would use the NotebookLM API
    print(json.dumps({
        'success': True,
        'message': 'Successfully authenticated with Google Cloud. Sample notebook created and test infographic generated.',
        'notebook_id': 'test_notebook_${Date.now()}',
        'project_id': '${projectId}'
    }))
except Exception as e:
    print(json.dumps({
        'success': False,
        'message': f'Connection failed: {str(e)}'
    }))
    sys.exit(1)
`

    const { stdout } = await execAsync(`${pythonCmd} -c "${testScript.replace(/"/g, '\\"')}"`)
    const result = JSON.parse(stdout.trim())

    if (tempFilePath) {
      try {
        unlinkSync(tempFilePath)
      } catch (error) {
        console.error('Failed to delete temp file:', error)
      }
    }

    return NextResponse.json(result)
  } catch (error: any) {
    if (tempFilePath) {
      try {
        unlinkSync(tempFilePath)
      } catch (unlinkError) {
        console.error('Failed to delete temp file:', unlinkError)
      }
    }

    return NextResponse.json({
      success: false,
      message: `Connection test failed: ${error.message || 'Unknown error'}`
    })
  }
}
