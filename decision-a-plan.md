# Decision A scope

This repository owns the extracted Pyodide-compatible fonttools wheel bundle and its publication as a standalone npm package. It does not own downstream runtime selection, application integration, or system-versus-wasm conformance policy.

That boundary matters because the earlier plan mixed two separable concerns: producing the reusable artifact and integrating that artifact into Pangram. The work in this repository should stop at the package boundary.

## Package objective

Publish a versioned npm package that provides a reproducible local bundle of the pinned wheels and metadata needed to load them with a matching local Pyodide runtime.

The package should make the build product portable and auditable:

- build the wheel bundle in Docker
- pin and record all relevant versions
- carry the local patch needed for `uharfbuzz`
- publish the resulting assets as part of the npm package
- make consumer expectations explicit

## Package boundary

### This repository owns

- `scripts/pyodide-bundle.Dockerfile`
- `scripts/vendor-pyodide-wheels.sh`
- `scripts/patches/uharfbuzz-v0.52.0-pyodide-support.patch`
- the pinned wheel set and its versions
- bundle metadata such as `build-provenance.json` and `SHA256SUMS`
- packaging the bundle into the published npm artifact
- a minimal load test or runtime helper if needed to prove the published bundle is consumable
- documentation of the consumer contract

### Downstream consumers own

- choosing between system and wasm backends
- calling application Python scripts such as inspect, strip, or subset
- mounting files into Pyodide and orchestrating execution
- fallback policy when Pyodide is unavailable or version-mismatched
- semantic conformance testing against an existing system backend
- product-level decisions such as WOFF support, WOFF2 quality thresholds, and allowed output differences

## In scope

The work in this repository is complete when the package can reliably produce and publish the extracted bundle.

### 1. Reproducible bundle build

Build and export a pinned bundle containing the required wheel files and metadata.

Current bundle contents:

- `brotli`
- `fonttools==4.62.1`
- `lxml==6.0.2`
- `uharfbuzz==0.52.0`
- `unicodedata2==17.0.0`
- `build-provenance.json`
- `SHA256SUMS`

### 2. Package build integration

Wire the bundle build into this package so the published npm artifact contains the generated assets under a stable path.

### 3. Publication contract

Document the runtime assumptions clearly enough that another package can consume this one without reading build scripts.

At minimum that contract should state:

- which Pyodide version the bundle targets
- that consumers must provide a matching local `pyodide` runtime
- that wheels are intended to be loaded by explicit local file URL
- which files in the published package are part of the supported surface

### 4. Minimal verification

Add the smallest test coverage that proves the package artifact is valid.

Minimum checks:

- the Docker build completes and emits the expected files
- published assets include the wheel files and metadata
- checksums validate
- the bundle loads with a matching local Pyodide runtime
- imported package versions match the pinned bundle

## Out of scope

The following work belongs in consumer repositories, not here:

- `PANGRAM_FONTTOOLS_BACKEND=auto|system|wasm`
- backend boundary design such as `system.ts`, `wasm.ts`, or selector code
- refactoring application call sites onto a backend contract
- reusing or rewriting `font-inspect.py`, `font-strip.py`, or other application scripts
- persistent Pyodide process management for an application runtime
- comparing wasm output against a system backend on a production corpus
- defining product-level support policy for unsupported formats or operations

## Constraints

- Keep the containerized build path.
- Keep version pinning explicit.
- Keep the `uharfbuzz` patch local and auditable.
- Do not depend on remote package-name resolution at runtime for correctness.
- Prefer published package assets over incidental cache state.
- Keep the package boundary narrow enough that downstream integration can evolve independently.

## Acceptance criteria

Decision A is in scope-complete for this repository when all of the following are true:

- this repository can build the bundle from source in Docker
- the npm package includes the generated wheels and metadata
- the published artifact records the versions it was built against
- a matching local Pyodide runtime can load the bundle successfully
- the consumer contract is documented without relying on Pangram-specific context

## Immediate next step

The next useful change in this repository is to turn the copied scripts into a first-class package build artifact:

- decide the published asset path under `lib/`
- invoke the bundle builder from the normal package build
- decide whether to ship only assets or assets plus a minimal loader helper
- add one smoke test that loads the published bundle with local Pyodide
