import { readFonttoolsFixtureFromFileSystem } from './fonttools-fixtures.node'
import { createFonttoolsParityAdapter } from './fonttools-parity.contract'
import { createFonttoolsParityPyodideRuntime } from './fonttools-parity.pyodide-runtime'

export function createNodeFonttoolsParityAdapter() {
  return createFonttoolsParityAdapter(
    createFonttoolsParityPyodideRuntime('node'),
    readFonttoolsFixtureFromFileSystem,
  )
}
