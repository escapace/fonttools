import vendoredWheelUrls from '@escapace/fonttools'
import {
  createPyodidePythonJsonRuntime,
  type PyodideInstance,
  type PythonJsonRuntime,
} from './python-json-runtime'

type LoadPyodide = (options?: {
  checkAPIVersion?: boolean
  indexURL?: string
  stdout?: (message: string) => void
}) => Promise<{ loadPackage: (packages: string[]) => Promise<unknown> } & PyodideInstance>

async function installVendoredFonttoolsWheels(
  pyodide: Awaited<ReturnType<LoadPyodide>>,
): Promise<PyodideInstance> {
  await pyodide.loadPackage(Object.values(vendoredWheelUrls).map((url) => url.href))
  return pyodide
}

let pyodidePromise: Promise<PyodideInstance> | undefined

export function createFonttoolsParityPyodideRuntime(
  name: 'browser' | 'node',
  options: {
    checkAPIVersion?: boolean
    indexURL?: string
    getLoadPyodide?: () => Promise<LoadPyodide>
  } = {},
): PythonJsonRuntime {
  async function getPyodide(): Promise<PyodideInstance> {
    if (pyodidePromise !== undefined) {
      return await pyodidePromise
    }

    pyodidePromise = (async () => {
      const getLoadPyodide =
        options.getLoadPyodide ?? (async () => (await import('pyodide')).loadPyodide as LoadPyodide)
      const loadPyodide = await getLoadPyodide()

      return await installVendoredFonttoolsWheels(
        await loadPyodide({
          checkAPIVersion: options.checkAPIVersion ?? true,
          ...(options.indexURL === undefined ? {} : { indexURL: options.indexURL }),
          stdout: () => undefined,
        }),
      )
    })()

    return await pyodidePromise
  }

  return createPyodidePythonJsonRuntime(name, getPyodide)
}
