export const fonttoolsFixtureFiles = {
  expectHarfbuzzRepackerTtx: 'expect_harfbuzz_repacker.ttx',
  harfbuzzRepackerTtx: 'harfbuzz_repacker.ttx',
  testRegularTtf: 'Test-Regular.ttf',
} as const

export type FonttoolsFixtureFile =
  (typeof fonttoolsFixtureFiles)[keyof typeof fonttoolsFixtureFiles]
