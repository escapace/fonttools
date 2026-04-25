import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { FonttoolsFixtureFile } from './fonttools-fixtures'

const FONTTOOLS_FIXTURES_DIRECTORY = path.resolve(
  import.meta.dirname,
  '..',
  'fixtures',
  'fonttools',
)

export async function readFonttoolsFixtureFromFileSystem(
  fileName: FonttoolsFixtureFile,
): Promise<Uint8Array> {
  return await readFile(path.join(FONTTOOLS_FIXTURES_DIRECTORY, fileName))
}
