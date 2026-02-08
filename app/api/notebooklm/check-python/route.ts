import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { pythonPath } = await request.json()
    const pythonCmd = pythonPath || 'python'

    try {
      const { stdout } = await execAsync(`${pythonCmd} -c "import notebooklm; print('installed')"`)
      
      return NextResponse.json({
        installed: stdout.trim() === 'installed',
        message: 'notebooklm-py is installed and accessible'
      })
    } catch (error) {
      return NextResponse.json({
        installed: false,
        message: 'notebooklm-py is not installed. Run: pip install notebooklm-py'
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check Python installation', installed: false },
      { status: 500 }
    )
  }
}
