import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import type { PythonJsonRuntime } from './python-json-runtime'

const execFileAsync = promisify(execFile)

function addPythonResultPrint(script: string): string {
  return `${script}\nprint(RESULT)`
}

async function writeFilesToFileSystem(files: Record<string, Uint8Array>): Promise<void> {
  for (const [filePath, content] of Object.entries(files)) {
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
}

export function createUvPythonJsonRuntime(rootDirectory: string): PythonJsonRuntime {
  return {
    name: 'uv',
    async createTempDirectory(prefix) {
      return await mkdtemp(path.join(tmpdir(), `${prefix}-`))
    },
    joinPath(directoryPath, fileName) {
      return path.join(directoryPath, fileName)
    },
    async runJson(script, files = {}) {
      await writeFilesToFileSystem(files)

      const { stdout } = await execFileAsync(
        'uv',
        ['run', '--frozen', 'python', '-c', addPythonResultPrint(script)],
        {
          cwd: rootDirectory,
          maxBuffer: 10 * 1024 * 1024,
        },
      )

      return JSON.parse(stdout.trim()) as unknown
    },
  }
}
