import path from 'node:path'
import { readFonttoolsFixtureFromFileSystem } from './fonttools-fixtures.node'
import { createFonttoolsParityAdapter } from './fonttools-parity.contract'
import { createUvPythonJsonRuntime } from './python-json-runtime.node'

const FONTTOOLS_REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..')

export function createUvFonttoolsParityAdapter() {
  return createFonttoolsParityAdapter(
    createUvPythonJsonRuntime(FONTTOOLS_REPOSITORY_ROOT),
    readFonttoolsFixtureFromFileSystem,
  )
}
