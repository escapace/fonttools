import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  parsePipRequirementsFile,
  VersionOperator,
  type ProjectNameRequirement,
} from 'pip-requirements-js'
import { minVersion } from 'semver'
import { parse as parseToml } from 'smol-toml'

interface PackageJson {
  name: string
  version: string
  devEngines?: {
    runtime?: {
      name?: string
      version?: string
    }
  }
}

interface PyodideModule {
  loadPyodide: (options: { indexURL: string }) => Promise<{
    runPython: (code: string) => unknown
  }>
}

interface PyodidePackageJson {
  version: string
}

interface RuntimeVersions {
  pythonVersion: string
}

interface PyProjectToml {
  project?: {
    dependencies?: unknown
  }
}

interface SourceDistribution {
  sha256: string
  url: string
}

interface UvLock {
  package?: UvLockPackage[]
}

interface UvLockPackage {
  name: string
  version: string
  sdist?: {
    hash?: string
    url?: string
  }
}

interface Versions {
  brotli: string
  fonttools: string
  lxml: string
  node: string
  pyodide: string
  python: string
  uharfbuzz: string
  unicodedata2: string
}

type DependencyName = 'brotli' | 'fonttools' | 'lxml' | 'uharfbuzz' | 'unicodedata2'

const ROOT_DIRECTORY = path.resolve(import.meta.dirname, '..')
const DOCKERFILE_PATH = path.join(ROOT_DIRECTORY, 'Dockerfile')
const PACKAGE_JSON_PATH = path.join(ROOT_DIRECTORY, 'package.json')
const PYODIDE_PACKAGE_JSON_PATH = path.join(
  ROOT_DIRECTORY,
  'node_modules',
  'pyodide',
  'package.json',
)
const PYODIDE_RUNTIME_DIRECTORY = path.join(ROOT_DIRECTORY, 'node_modules', 'pyodide')
const PYPROJECT_TOML_PATH = path.join(ROOT_DIRECTORY, 'pyproject.toml')
const UV_LOCK_PATH = path.join(ROOT_DIRECTORY, 'uv.lock')

function extractMinimumNodeVersion(nodeRange: string): string {
  const version = minVersion(nodeRange)?.version

  if (version === undefined) {
    throw new Error(`Could not determine minimum Node version from range: ${nodeRange}`)
  }

  return version
}

function toPythonVersionTag(pythonVersion: string): string {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.\d+$/.exec(pythonVersion)

  if (match?.groups?.major === undefined || match.groups.minor === undefined) {
    throw new Error(`Could not determine Python version tag from version: ${pythonVersion}`)
  }

  return `${match.groups.major}${match.groups.minor}`
}

function extractPinnedDependencyVersion(
  requirements: ProjectNameRequirement[],
  dependencyName: DependencyName,
): string {
  const matchingRequirements = requirements.filter(
    (requirement) => requirement.name.toLowerCase() === dependencyName,
  )

  if (matchingRequirements.length !== 1) {
    throw new Error(
      `Expected exactly one pinned dependency for ${dependencyName}, found ${matchingRequirements.length}`,
    )
  }

  const [requirement] = matchingRequirements
  const versionSpecification = requirement.versionSpec?.find(
    (versionSpec) => versionSpec.operator === VersionOperator.VersionMatching,
  )

  if (versionSpecification?.version === undefined) {
    throw new Error(
      `Expected an exact pinned version for ${dependencyName} in ${PYPROJECT_TOML_PATH}`,
    )
  }

  return versionSpecification.version
}

async function readPinnedDependencyVersions(): Promise<Pick<Versions, DependencyName>> {
  const pyproject = parseToml(await readFile(PYPROJECT_TOML_PATH, 'utf8')) as PyProjectToml
  const dependencies = pyproject.project?.dependencies

  if (!Array.isArray(dependencies)) {
    throw new TypeError(`Could not find project.dependencies in ${PYPROJECT_TOML_PATH}`)
  }

  const dependencyLines = dependencies.filter(
    (dependency): dependency is string => typeof dependency === 'string',
  )
  const requirements = parsePipRequirementsFile(dependencyLines.join('\n')).filter(
    (requirement): requirement is ProjectNameRequirement => requirement.type === 'ProjectName',
  )

  return {
    brotli: extractPinnedDependencyVersion(requirements, 'brotli'),
    fonttools: extractPinnedDependencyVersion(requirements, 'fonttools'),
    lxml: extractPinnedDependencyVersion(requirements, 'lxml'),
    uharfbuzz: extractPinnedDependencyVersion(requirements, 'uharfbuzz'),
    unicodedata2: extractPinnedDependencyVersion(requirements, 'unicodedata2'),
  }
}

async function getVersions(
  packageJson: PackageJson,
  pyodidePackageJson: PyodidePackageJson,
): Promise<Versions> {
  if (packageJson.devEngines?.runtime?.name !== 'node') {
    throw new Error(`Could not find devEngines.runtime.name=node in ${PACKAGE_JSON_PATH}`)
  }

  if (packageJson.devEngines.runtime.version === undefined) {
    throw new Error(`Could not find devEngines.runtime.version in ${PACKAGE_JSON_PATH}`)
  }

  const { loadPyodide } = (await import('pyodide')) as PyodideModule

  const pyodide = await loadPyodide({
    indexURL: PYODIDE_RUNTIME_DIRECTORY,
  })

  const runtimeVersions = JSON.parse(
    pyodide.runPython(`
import json
import sys

json.dumps({
    'pythonVersion': '.'.join(str(part) for part in sys.version_info[:3]),
})
`) as string,
  ) as RuntimeVersions

  const pinnedDependencyVersions = await readPinnedDependencyVersions()

  return {
    ...pinnedDependencyVersions,
    node: extractMinimumNodeVersion(packageJson.devEngines.runtime.version),
    pyodide: pyodidePackageJson.version,
    python: runtimeVersions.pythonVersion,
  }
}

async function readUnicodeData2SourceDistribution(): Promise<SourceDistribution> {
  const uvLock = parseToml(await readFile(UV_LOCK_PATH, 'utf8')) as UvLock
  const packageEntry = uvLock.package?.find((candidate) => candidate.name === 'unicodedata2')

  if (packageEntry === undefined) {
    throw new Error(`Could not find unicodedata2 in ${UV_LOCK_PATH}`)
  }

  if (packageEntry.sdist?.url === undefined) {
    throw new Error(`Could not find unicodedata2 sdist.url in ${UV_LOCK_PATH}`)
  }

  if (packageEntry.sdist.hash === undefined) {
    throw new Error(`Could not find unicodedata2 sdist.hash in ${UV_LOCK_PATH}`)
  }

  const sha256Match = /^sha256:(?<sha256>[a-f0-9]{64})$/.exec(packageEntry.sdist.hash)

  if (sha256Match?.groups?.sha256 === undefined) {
    throw new Error(`Expected a sha256 sdist hash for unicodedata2 in ${UV_LOCK_PATH}`)
  }

  return {
    sha256: sha256Match.groups.sha256,
    url: packageEntry.sdist.url,
  }
}

function replaceDockerfileArgument(
  dockerfile: string,
  argumentName: string,
  value: string,
): string {
  const pattern = new RegExp(`^ARG ${argumentName}=.*$`, 'm')

  if (!pattern.test(dockerfile)) {
    throw new Error(`Could not find ARG ${argumentName} in ${DOCKERFILE_PATH}`)
  }

  return dockerfile.replace(pattern, `ARG ${argumentName}=${value}`)
}

async function updateDockerfile(
  versions: Versions,
  unicodedata2Source: SourceDistribution,
): Promise<void> {
  let dockerfile = await readFile(DOCKERFILE_PATH, 'utf8')

  dockerfile = replaceDockerfileArgument(dockerfile, 'NODE_VERSION', versions.node)
  dockerfile = replaceDockerfileArgument(dockerfile, 'PYODIDE_NPM_VERSION', versions.pyodide)
  dockerfile = replaceDockerfileArgument(dockerfile, 'PYODIDE_BUILD_VERSION', versions.pyodide)
  dockerfile = replaceDockerfileArgument(dockerfile, 'FONTTOOLS_VERSION', versions.fonttools)
  dockerfile = replaceDockerfileArgument(
    dockerfile,
    'PYTHON_VERSION_TAG',
    toPythonVersionTag(versions.python),
  )
  dockerfile = replaceDockerfileArgument(dockerfile, 'UHARFBUZZ_REF', `v${versions.uharfbuzz}`)
  dockerfile = replaceDockerfileArgument(dockerfile, 'UHARFBUZZ_VERSION', versions.uharfbuzz)
  dockerfile = replaceDockerfileArgument(
    dockerfile,
    'UNICODEDATA2_SOURCE_URL',
    unicodedata2Source.url,
  )
  dockerfile = replaceDockerfileArgument(
    dockerfile,
    'UNICODEDATA2_SOURCE_SHA256',
    unicodedata2Source.sha256,
  )

  await writeFile(DOCKERFILE_PATH, dockerfile)
}

async function main(): Promise<void> {
  const packageJson = JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8')) as PackageJson
  const pyodidePackageJson = JSON.parse(
    await readFile(PYODIDE_PACKAGE_JSON_PATH, 'utf8'),
  ) as PyodidePackageJson
  const versions = await getVersions(packageJson, pyodidePackageJson)

  const unicodedata2Source = await readUnicodeData2SourceDistribution()
  await updateDockerfile(versions, unicodedata2Source)
}

await main()
