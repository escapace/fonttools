import { describe, expect, test } from 'vitest'
import { fonttoolsFixtureFiles, type FonttoolsFixtureFile } from './fonttools-fixtures'
import type { PythonJsonRuntime } from './python-json-runtime'

export interface FonttoolsParityAdapter extends PythonJsonRuntime {
  readFixture: (fileName: FonttoolsFixtureFile) => Promise<Uint8Array>
}

export function createFonttoolsParityAdapter(
  runtime: PythonJsonRuntime,
  readFixture: FonttoolsParityAdapter['readFixture'],
): FonttoolsParityAdapter {
  return {
    ...runtime,
    readFixture,
  }
}

const expectedSvgXml = [
  '<svgDoc endGlyphID="1" startGlyphID="1">',
  '  <![CDATA[<svg xmlns="http://www.w3.org/2000/svg"><path id="glyph1" d="M2,2"/></svg>]]>',
  '</svgDoc>',
  '<svgDoc endGlyphID="2" startGlyphID="2">',
  '  <![CDATA[<svg xmlns="http://www.w3.org/2000/svg"><path id="glyph2" d="M4,4"/></svg>]]>',
  '</svgDoc>',
  '<svgDoc endGlyphID="3" startGlyphID="3">',
  '  <![CDATA[<svg xmlns="http://www.w3.org/2000/svg"><path id="glyph3" d="M5,5"/></svg>]]>',
  '</svgDoc>',
  '<svgDoc endGlyphID="4" startGlyphID="4">',
  '  <![CDATA[<svg xmlns="http://www.w3.org/2000/svg"><path id="glyph4" d="M6,6"/></svg>]]>',
  '</svgDoc>',
]

const expectedUnicodeData = {
  blockDevanagariExtendedA: 'Devanagari Extended-A',
  scriptCodeEgyptianHieroglyphs: 'Egyp',
  scriptExtensionA: ['Latn'],
  scriptExtensionMiddleDot: [
    'Avst',
    'Cari',
    'Copt',
    'Dupl',
    'Elba',
    'Geor',
    'Glag',
    'Gong',
    'Goth',
    'Grek',
    'Hani',
    'Latn',
    'Lydi',
    'Mahj',
    'Perm',
    'Shaw',
  ],
  scriptExtensionModifierLetterApostrophe: ['Beng', 'Cyrl', 'Deva', 'Latn', 'Lisu', 'Thai', 'Toto'],
  scriptNameLatn: 'Latin',
}

const expectedWoff2RoundTrip = {
  familyName: 'New Font',
  glyphCount: 54,
  headDataMatches: false,
  hmtxDataMatches: true,
  maxpDataMatches: true,
  tables: [
    'GPOS',
    'GSUB',
    'OS/2',
    'cmap',
    'glyf',
    'head',
    'hhea',
    'hmtx',
    'loca',
    'maxp',
    'name',
    'post',
  ],
  woff2Size: 672,
}

const expectedReorderGlyphs = {
  newCoverage1: [
    'Z',
    'Y',
    'X',
    'W',
    'V',
    'U',
    'T',
    'S',
    'R',
    'Q',
    'P',
    'O',
    'N',
    'M',
    'L',
    'K',
    'J',
    'I',
    'H',
    'G',
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
  ],
  newCoverage2: [
    'Z',
    'Y',
    'X',
    'W',
    'V',
    'U',
    'T',
    'S',
    'R',
    'Q',
    'P',
    'O',
    'N',
    'M',
    'L',
    'K',
    'J',
    'I',
    'H',
    'G',
    'F',
    'E',
    'D',
    'C',
    'B',
    'A',
  ],
  oldCoverage1: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ],
  oldCoverage2: [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  ],
}

function buildUnicodeDataScript(): string {
  return `
import json
from fontTools import unicodedata

RESULT = json.dumps({
    'blockDevanagariExtendedA': unicodedata.block("\\U00011B00"),
    'scriptCodeEgyptianHieroglyphs': unicodedata.script_code("Egyptian-Hieroglyphs"),
    'scriptExtensionA': sorted(unicodedata.script_extension("a")),
    'scriptExtensionMiddleDot': sorted(unicodedata.script_extension("\u00B7")),
    'scriptExtensionModifierLetterApostrophe': sorted(unicodedata.script_extension("\u02BC")),
    'scriptNameLatn': unicodedata.script_name("Latn"),
}, sort_keys=True)
`.trim()
}

function buildWoff2RoundTripScript(fontPath: string): string {
  return `
import io
import json
from fontTools.ttLib import TTFont

font = TTFont(${JSON.stringify(fontPath)}, recalcBBoxes=False, recalcTimestamp=False)
buffer = io.BytesIO()
font.flavor = 'woff2'
font.save(buffer, reorderTables=None)
size = len(buffer.getvalue())
buffer.seek(0)
roundtrip = TTFont(buffer, recalcBBoxes=False, recalcTimestamp=False)

RESULT = json.dumps({
    'familyName': roundtrip['name'].getBestFamilyName(),
    'glyphCount': len(roundtrip.getGlyphOrder()),
    'headDataMatches': font.getTableData('head') == roundtrip.getTableData('head'),
    'hmtxDataMatches': font.getTableData('hmtx') == roundtrip.getTableData('hmtx'),
    'maxpDataMatches': font.getTableData('maxp') == roundtrip.getTableData('maxp'),
    'tables': sorted(tag for tag in roundtrip.keys() if tag != 'GlyphOrder'),
    'woff2Size': size,
}, sort_keys=True)
`.trim()
}

function buildReorderGlyphsScript(fontPath: string): string {
  return `
import json
from fontTools.ttLib import TTFont
from fontTools.ttLib.reorderGlyphs import reorderGlyphs

font = TTFont(${JSON.stringify(fontPath)})
old_coverage1 = list(font['GSUB'].table.LookupList.Lookup[0].SubTable[0].Coverage[0].glyphs)
old_coverage2 = list(font['GPOS'].table.LookupList.Lookup[0].SubTable[0].Coverage.glyphs)
new_order = font.getGlyphOrder()
new_order = [new_order[0]] + list(reversed(new_order[1:]))
reorderGlyphs(font, new_order)
new_coverage1 = list(font['GSUB'].table.LookupList.Lookup[0].SubTable[0].Coverage[0].glyphs)
new_coverage2 = list(font['GPOS'].table.LookupList.Lookup[0].SubTable[0].Coverage.glyphs)

RESULT = json.dumps({
    'oldCoverage1': old_coverage1,
    'oldCoverage2': old_coverage2,
    'newCoverage1': new_coverage1,
    'newCoverage2': new_coverage2,
}, sort_keys=True)
`.trim()
}

function buildSvgSubsetScript(): string {
  return `
import json
import pathlib
import tempfile
from string import ascii_letters

from fontTools import subset
from fontTools.fontBuilder import FontBuilder
from fontTools.misc.testTools import getXML
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable
from lxml import etree


def new_svg(**attrs):
    return etree.Element('svg', {'xmlns': 'http://www.w3.org/2000/svg', **attrs})


glyph_order = ['.notdef'] + list(ascii_letters)
pen = TTGlyphPen(glyphSet=None)
pen.moveTo((0, 0))
pen.lineTo((0, 500))
pen.lineTo((500, 500))
pen.lineTo((500, 0))
pen.closePath()
glyph = pen.glyph()
glyphs = {g: glyph for g in glyph_order}

fb = FontBuilder(unitsPerEm=1024, isTTF=True)
fb.setupGlyphOrder(glyph_order)
fb.setupCharacterMap({ord(c): c for c in ascii_letters})
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({g: (500, 0) for g in glyph_order})
fb.setupHorizontalHeader()
fb.setupOS2()
fb.setupPost()
fb.setupNameTable({'familyName': 'TestSVG', 'styleName': 'Regular'})

svg_table = newTable('SVG ')
svg_table.docList = []
fb.font['SVG '] = svg_table

for index in range(1, 11):
    svg = new_svg()
    etree.SubElement(svg, 'path', {'id': f'glyph{index}', 'd': f'M{index},{index}'})
    fb.font['SVG '].docList.append((etree.tostring(svg).decode(), index, index))

temp_directory = pathlib.Path(tempfile.mkdtemp())
font_path = temp_directory / 'TestSVG.ttf'
subset_path = temp_directory / 'TestSVG.subset.ttf'
fb.font.save(font_path)
subset.main([
    str(font_path),
    f'--output-file={subset_path}',
    '--gids=2,4-6',
    '--no-retain_gids',
])
subset_font = TTFont(subset_path)

RESULT = json.dumps(getXML(subset_font['SVG '].toXML, subset_font))
`.trim()
}

function buildHarfbuzzRepackerScript(inputTtxPath: string, expectedTtxPath: string): string {
  return `
import json
import pathlib
import tempfile

from fontTools import subset
from fontTools.misc.testTools import getXML
from fontTools.ttLib import TTFont
import fontTools.ttLib.tables.otBase as otBase

temp_directory = pathlib.Path(tempfile.mkdtemp())
font_path = temp_directory / 'harfbuzz-repacker.otf'
subset_path = temp_directory / 'harfbuzz-repacker.subset.otf'

font = TTFont(recalcBBoxes=False, recalcTimestamp=False)
font.importXML(${JSON.stringify(inputTtxPath)})
font.save(font_path, reorderTables=None)
subset.main([
    str(font_path),
    '--unicodes=0x53a9',
    '--layout-features=*',
    f'--output-file={subset_path}',
])
subset_font = TTFont(subset_path)

expected_font = TTFont()
expected_font.importXML(${JSON.stringify(expectedTtxPath)})
actual_gsub_xml = getXML(subset_font['GSUB'].toXML, subset_font)
expected_gsub_xml = getXML(expected_font['GSUB'].toXML, expected_font)

RESULT = json.dumps({
    'gsubXml': actual_gsub_xml,
    'haveHarfbuzz': otBase.have_uharfbuzz,
    'matchesExpected': actual_gsub_xml == expected_gsub_xml,
}, sort_keys=True)
`.trim()
}

export function defineFonttoolsParityTests(
  runtimeName: FonttoolsParityAdapter['name'],
  createAdapter: () => FonttoolsParityAdapter,
): void {
  describe(`${runtimeName} fonttools parity`, () => {
    test('matches fontTools.unicodedata behavior from upstream tests', async () => {
      const result = await createAdapter().runJson(buildUnicodeDataScript())

      expect(result).toEqual(expectedUnicodeData)
    }, 120_000)

    test('matches TTFont WOFF2 round-trip behavior', async () => {
      const adapter = createAdapter()
      const fontPath = adapter.joinPath(
        await adapter.createTempDirectory('woff2'),
        fonttoolsFixtureFiles.testRegularTtf,
      )
      const result = await adapter.runJson(buildWoff2RoundTripScript(fontPath), {
        [fontPath]: await adapter.readFixture(fonttoolsFixtureFiles.testRegularTtf),
      })

      expect(result).toEqual(expectedWoff2RoundTrip)
    }, 120_000)

    test('matches reorderGlyphs coverage updates from upstream tests', async () => {
      const adapter = createAdapter()
      const fontPath = adapter.joinPath(
        await adapter.createTempDirectory('reorder-glyphs'),
        fonttoolsFixtureFiles.testRegularTtf,
      )
      const result = await adapter.runJson(buildReorderGlyphsScript(fontPath), {
        [fontPath]: await adapter.readFixture(fonttoolsFixtureFiles.testRegularTtf),
      })

      expect(result).toEqual(expectedReorderGlyphs)
    }, 120_000)

    test('matches SVG subsetting output that requires lxml', async () => {
      const result = await createAdapter().runJson(buildSvgSubsetScript())

      expect(result).toEqual(expectedSvgXml)
    }, 120_000)

    test('matches harfbuzz repacker GSUB output', async () => {
      const adapter = createAdapter()
      const temporaryDirectory = await adapter.createTempDirectory('harfbuzz')
      const inputPath = adapter.joinPath(
        temporaryDirectory,
        fonttoolsFixtureFiles.harfbuzzRepackerTtx,
      )
      const expectedPath = adapter.joinPath(
        temporaryDirectory,
        fonttoolsFixtureFiles.expectHarfbuzzRepackerTtx,
      )
      const result = await adapter.runJson(buildHarfbuzzRepackerScript(inputPath, expectedPath), {
        [expectedPath]: await adapter.readFixture(fonttoolsFixtureFiles.expectHarfbuzzRepackerTtx),
        [inputPath]: await adapter.readFixture(fonttoolsFixtureFiles.harfbuzzRepackerTtx),
      })

      expect(result).toEqual(
        expect.objectContaining({
          haveHarfbuzz: true,
          matchesExpected: true,
        }),
      )
    }, 120_000)
  })
}
