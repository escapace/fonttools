import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

interface BuildProvenance {
  emscriptenVersion: string
  pyodideBuildVersion: string
  pyodideVersion: string
  pythonVersion: string
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T
}

async function fileSha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

async function readSha256Sums(filePath: string): Promise<Map<string, string>> {
  const content = await readFile(filePath, 'utf8')
  const result = new Map<string, string>()

  for (const line of content.split('\n')) {
    if (line.trim() === '') {
      continue
    }

    const match = /^([a-f0-9]{64})\s{2}(.+)$/.exec(line)
    if (match === null) {
      throw new Error(`Invalid SHA256SUMS line: ${line}`)
    }

    const [, sha256, filename] = match
    result.set(filename, sha256)
  }

  return result
}

async function verifyWheelBundle(wheelsDirectory: string): Promise<void> {
  const checksumsPath = path.join(wheelsDirectory, 'SHA256SUMS')
  const checksums = await readSha256Sums(checksumsPath)

  for (const [filename, expectedSha256] of checksums) {
    const actualSha256 = await fileSha256(path.join(wheelsDirectory, filename))
    if (actualSha256 !== expectedSha256) {
      throw new Error(
        `Checksum mismatch for ${filename}: expected ${expectedSha256}, got ${actualSha256}`,
      )
    }
  }
}

async function listWheelFiles(wheelsDirectory: string): Promise<string[]> {
  const entries = await readdir(wheelsDirectory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.whl'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))
}

async function main(): Promise<void> {
  const rootDirectory = path.resolve(import.meta.dirname, '..')
  const runtimeDirectory = process.argv[2] ?? path.join(rootDirectory, 'node_modules', 'pyodide')
  const wheelsDirectory = process.argv[3] ?? path.join(rootDirectory, 'lib', 'pyodide-wheels')

  const provenance = await readJson<BuildProvenance>(
    path.join(wheelsDirectory, 'build-provenance.json'),
  )
  const pyodidePackageJson = await readJson<{ version: string }>(
    path.join(runtimeDirectory, 'package.json'),
  )

  if (pyodidePackageJson.version !== provenance.pyodideVersion) {
    throw new Error(
      `Pyodide runtime version ${pyodidePackageJson.version} does not match wheel bundle version ${provenance.pyodideVersion}`,
    )
  }

  await verifyWheelBundle(wheelsDirectory)

  const wheelFiles = await listWheelFiles(wheelsDirectory)
  if (wheelFiles.length === 0) {
    throw new Error(`No wheel files found in ${wheelsDirectory}`)
  }

  const pyodideModuleUrl = pathToFileURL(path.join(runtimeDirectory, 'pyodide.mjs')).href
  const { loadPyodide } = (await import(pyodideModuleUrl)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<{
      loadPackage: (packages: string[]) => Promise<void>
      runPython: (code: string) => unknown
    }>
  }

  const pyodide = await loadPyodide({
    indexURL: runtimeDirectory,
  })

  const wheelUrls = wheelFiles.map(
    (filename) => pathToFileURL(path.join(wheelsDirectory, filename)).href,
  )
  await pyodide.loadPackage(wheelUrls)

  const result = pyodide.runPython(`
import brotli
import fontTools
import lxml.etree
import uharfbuzz
import unicodedata2
import sys

print('python=' + sys.version.split()[0])
print('fonttools=' + fontTools.version)
print('uharfbuzz=' + uharfbuzz.__version__)
print('unicodedata2=' + unicodedata2.unidata_version)
`)

  console.log('Loaded wheels from:', wheelsDirectory)
  console.log('Using pyodide runtime:', runtimeDirectory)
  console.log('Build provenance:', provenance)
  console.log(result)
}

await main()
