import type { FonttoolsFixtureFile } from './fonttools-fixtures'

const browserFixtureUrls = {
  'expect_harfbuzz_repacker.ttx': new URL(
    '../fixtures/fonttools/expect_harfbuzz_repacker.ttx',
    import.meta.url,
  ),
  'harfbuzz_repacker.ttx': new URL('../fixtures/fonttools/harfbuzz_repacker.ttx', import.meta.url),
  'Test-Regular.ttf': new URL('../fixtures/fonttools/Test-Regular.ttf', import.meta.url),
} satisfies Record<FonttoolsFixtureFile, URL>

export async function readFonttoolsFixtureFromBrowser(
  fileName: FonttoolsFixtureFile,
): Promise<Uint8Array> {
  const response = await fetch(browserFixtureUrls[fileName])

  if (!response.ok) {
    throw new Error(`Failed to load fixture ${fileName}: ${response.status} ${response.statusText}`)
  }

  return new Uint8Array(await response.arrayBuffer())
}
