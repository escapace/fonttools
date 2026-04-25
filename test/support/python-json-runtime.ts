export interface PythonJsonRuntime {
  readonly name: 'browser' | 'node' | 'uv'

  createTempDirectory: (prefix: string) => Promise<string>
  joinPath: (directoryPath: string, fileName: string) => string
  runJson: (script: string, files?: Record<string, Uint8Array>) => Promise<unknown>
}

export interface PyodideInstance {
  FS: {
    mkdirTree: (directoryPath: string) => void
    writeFile: (filePath: string, content: Uint8Array) => void
  }
  runPython: (code: string) => unknown
}

function makePyodideTemporaryDirectory(prefix: string): string {
  return `/tmp/${prefix}-${Math.random().toString(36).slice(2)}`
}

function getPosixParentDirectory(filePath: string): string {
  return filePath.replace(/\/[^/]+$/u, '')
}

function writeFilesToPyodide(
  pyodide: Pick<PyodideInstance, 'FS'>,
  files: Record<string, Uint8Array>,
): void {
  for (const [filePath, content] of Object.entries(files)) {
    pyodide.FS.mkdirTree(getPosixParentDirectory(filePath))
    pyodide.FS.writeFile(filePath, content)
  }
}

export function createPyodidePythonJsonRuntime(
  name: 'browser' | 'node',
  getPyodide: () => Promise<PyodideInstance>,
): PythonJsonRuntime {
  return {
    name,
    async createTempDirectory(prefix) {
      return await Promise.resolve(makePyodideTemporaryDirectory(prefix))
    },
    joinPath(directoryPath, fileName) {
      return `${directoryPath}/${fileName}`
    },
    async runJson(script, files = {}) {
      const pyodide = await getPyodide()
      writeFilesToPyodide(pyodide, files)
      return JSON.parse(String(pyodide.runPython(`${script}\nRESULT`))) as unknown
    },
  }
}
