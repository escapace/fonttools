import { readFonttoolsFixtureFromBrowser } from './fonttools-fixtures.browser'
import { createFonttoolsParityAdapter } from './fonttools-parity.contract'
import { createFonttoolsParityPyodideRuntime } from './fonttools-parity.pyodide-runtime'

const pyodideRuntimeModuleUrl = new URL('../../node_modules/pyodide/pyodide.mjs', import.meta.url)
const pyodideRuntimeIndexUrl = new URL('.', pyodideRuntimeModuleUrl).href

export function createBrowserFonttoolsParityAdapter() {
  return createFonttoolsParityAdapter(
    createFonttoolsParityPyodideRuntime('browser', {
      indexURL: pyodideRuntimeIndexUrl,
      async getLoadPyodide() {
        return (await import('pyodide')).loadPyodide
      },
    }),
    readFonttoolsFixtureFromBrowser,
  )
}
