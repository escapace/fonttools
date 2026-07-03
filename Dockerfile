ARG NODE_VERSION=24.15.0
ARG PYODIDE_NPM_VERSION=0.29.4
ARG PYODIDE_BUILD_VERSION=0.29.3
ARG PYODIDE_XBUILDENV_VERSION=0.29.4
ARG FONTTOOLS_VERSION=4.62.1
ARG PYTHON_VERSION_TAG=313
ARG UHARFBUZZ_REF=v0.52.0
ARG UHARFBUZZ_VERSION=0.52.0
ARG UNICODEDATA2_SOURCE_URL=https://files.pythonhosted.org/packages/44/cb/520721a715da85530e21c71953b9b9a85a44e0d80d3b34bf9303c422d208/unicodedata2-17.0.1.tar.gz
ARG UNICODEDATA2_SOURCE_SHA256=d79943d153f5f6bfbe3f55a5ec611985184bda37fcedb3ecc75322d82ae6ad3b

FROM python:3.13-bookworm AS base
ARG NODE_VERSION

SHELL ["/bin/bash", "-lc"]

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  apt-get update && \
  apt-get install -y --no-install-recommends ca-certificates curl gnupg xz-utils file git patch make findutils gzip bzip2 libatomic1 && \
  rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  export GNUPGHOME="$(mktemp -d)"; \
  export ARCH="$(uname -m)"; \
  case "$ARCH" in \
  x86_64) ARCH="x64";; \
  aarch64) ARCH="arm64";; \
  *) echo "unsupported architecture"; exit 1 ;; \
  esac; \
  for key in \
  5BE8A3F6C8A5C01D106C0AD820B1A390B168D356 \
  DD792F5973C6DE52C432CBDAC77ABFA00DDBF2B7 \
  CC68F5A3106FF448322E48ED27F5E38D5B0A215F \
  8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
  890C08DB8579162FEE0DF9DB8BEAB4DFCF555EF4 \
  C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C \
  108F52B48DB57BB0CC439B2997B01419BD92F80A \
  A363A499291CBBC940DD62E41F10027AF002F8B0 \
  ; do \
  gpg --batch --keyserver hkps://keys.openpgp.org --recv-keys "$key" || \
  gpg --batch --keyserver keyserver.ubuntu.com --recv-keys "$key"; \
  done; \
  curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz"; \
  curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc"; \
  gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc; \
  grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c -; \
  tar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner; \
  ln -s /usr/local/bin/node /usr/local/bin/nodejs; \
  gpgconf --kill all; \
  rm -rf "$GNUPGHOME" "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt; \
  groupadd --gid 1000 node; \
  useradd --uid 1000 --create-home --shell=/bin/sh -g node node; \
  node --version; \
  npm --version

FROM base AS package
USER node
WORKDIR /home/node/package
COPY --chown=node:node scripts/patches/uharfbuzz-v0.52.0-pyodide-support.patch /home/node/package/scripts/patches/uharfbuzz-v0.52.0-pyodide-support.patch
ENV PATH="/home/node/.local/bin:$PATH" PYTHONUNBUFFERED=1

FROM package AS pyodide-toolchain
ARG PYODIDE_BUILD_VERSION
ARG PYODIDE_XBUILDENV_VERSION
ENV PYODIDE_CROSS_BUILD_ENV_METADATA_URL="https://pyodide.github.io/pyodide/api/pyodide-cross-build-environments.json" \
  PYODIDE_ROOT="/home/node/package/.pyodide-xbuildenv/xbuildenv/xbuildenv/pyodide-root" \
  PYODIDE_XBUILDENV_PATH="/home/node/package/.pyodide-xbuildenv"

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  python -m pip install --user "wheel<0.46" "pyodide-build==${PYODIDE_BUILD_VERSION}" pytest

# Installing by verified URL avoids pyodide-build regenerating a package index from
# cross-build environment lock files whose schema may differ from the toolchain package.
RUN python - <<'PY' && \
  pyodide xbuildenv install --path "${PYODIDE_XBUILDENV_PATH}" --url "file:///tmp/pyodide-xbuildenv-${PYODIDE_XBUILDENV_VERSION}.tar.bz2" && \
  pyodide config get python_version > /home/node/package/pyodide-python-version.txt && \
  pyodide config get emscripten_version > /home/node/package/emscripten-version.txt && \
  rm "/tmp/pyodide-xbuildenv-${PYODIDE_XBUILDENV_VERSION}.tar.bz2"
import hashlib
import json
import os
import urllib.request

version = os.environ['PYODIDE_XBUILDENV_VERSION']
archive_path = f'/tmp/pyodide-xbuildenv-{version}.tar.bz2'
with urllib.request.urlopen(os.environ['PYODIDE_CROSS_BUILD_ENV_METADATA_URL']) as response:
    release = json.load(response)['releases'].get(version)

if release is None:
    raise SystemExit(f'Could not find Pyodide cross-build environment {version}')

with urllib.request.urlopen(release['url']) as response:
    archive = response.read()

actual_sha256 = hashlib.sha256(archive).hexdigest()
if actual_sha256 != release['sha256']:
    raise SystemExit(f'Expected sha256 {release["sha256"]}, got {actual_sha256}')

with open(archive_path, 'wb') as archive_file:
    archive_file.write(archive)
PY

RUN --mount=type=cache,target=/home/node/.cache/emsdk-downloads,uid=1000,gid=1000,id=emsdk-downloads,sharing=locked \
  EMSDK_VERSION=$(cat /home/node/package/emscripten-version.txt) && \
  export EMSDK_KEEP_DOWNLOADS=1 && \
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git /home/node/emsdk && \
  rm -rf /home/node/emsdk/downloads && \
  ln -s /home/node/.cache/emsdk-downloads /home/node/emsdk/downloads && \
  /home/node/emsdk/emsdk install "${EMSDK_VERSION}" && \
  /home/node/emsdk/emsdk activate "${EMSDK_VERSION}"

FROM pyodide-toolchain AS pyodide-standard-wheels
ARG PYODIDE_NPM_VERSION
USER node

RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000,id=npm,sharing=locked \
  mkdir -p /home/node/runtime /home/node/wheelhouse && \
  cd /home/node/runtime && \
  npm init -y >/dev/null 2>&1 && \
  npm install --no-save "pyodide@${PYODIDE_NPM_VERSION}" && \
  python - <<'PY'
import json
import os
import urllib.request
from pathlib import Path

version = os.environ['PYODIDE_NPM_VERSION']
package_dir = Path('/home/node/runtime/node_modules/pyodide')
wheelhouse = Path('/home/node/wheelhouse')
lock = json.loads((package_dir / 'pyodide-lock.json').read_text())
base = f'https://cdn.jsdelivr.net/pyodide/v{version}/full/'
for name in ('brotli', 'lxml'):
    filename = lock['packages'][name]['file_name']
    urllib.request.urlretrieve(base + filename, wheelhouse / filename)
PY

FROM pyodide-toolchain AS fonttools-wheel
ARG FONTTOOLS_VERSION
ARG PYTHON_VERSION_TAG
USER node

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  mkdir -p /home/node/wheelhouse && \
  python -m pip download \
    --no-deps \
    --only-binary=:all: \
    --implementation py \
    --platform any \
    --python-version ${PYTHON_VERSION_TAG} \
    --abi none \
    --dest /home/node/wheelhouse \
    "fonttools==${FONTTOOLS_VERSION}"

FROM pyodide-toolchain AS uharfbuzz-wheel
ARG UHARFBUZZ_REF
ARG UHARFBUZZ_VERSION
USER node
WORKDIR /home/node/src

RUN git clone --depth 1 --branch "${UHARFBUZZ_REF}" --recurse-submodules https://github.com/harfbuzz/uharfbuzz.git /home/node/src
RUN git apply --verbose /home/node/package/scripts/patches/uharfbuzz-v0.52.0-pyodide-support.patch

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  source /home/node/emsdk/emsdk_env.sh >/dev/null && \
  export EMSDK_QUIET=1 && \
  export SETUPTOOLS_SCM_PRETEND_VERSION="${UHARFBUZZ_VERSION}" && \
  pyodide build --outdir /home/node/wheelhouse

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  cd /home/node/package && \
  pyodide venv /tmp/pyodide-venv && \
  /tmp/pyodide-venv/bin/pip install pytest /home/node/wheelhouse/uharfbuzz*.whl && \
  cd /home/node/src && \
  /tmp/pyodide-venv/bin/python -m pytest tests/ -q

FROM pyodide-toolchain AS unicodedata2-wheel
ARG UNICODEDATA2_SOURCE_URL
ARG UNICODEDATA2_SOURCE_SHA256
USER node
WORKDIR /home/node/src

RUN curl -fsSL "$UNICODEDATA2_SOURCE_URL" -o /home/node/unicodedata2.tar.gz && \
  echo "$UNICODEDATA2_SOURCE_SHA256  /home/node/unicodedata2.tar.gz" | sha256sum -c - && \
  mkdir -p /home/node/src && \
  tar -xzf /home/node/unicodedata2.tar.gz -C /home/node/src --strip-components=1

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  source /home/node/emsdk/emsdk_env.sh >/dev/null && \
  export EMSDK_QUIET=1 && \
  pyodide build --outdir /home/node/wheelhouse

RUN --mount=type=cache,target=/home/node/.cache/pip,uid=1000,gid=1000,id=pip,sharing=locked \
  cd /home/node/package && \
  pyodide venv /tmp/pyodide-venv && \
  /tmp/pyodide-venv/bin/pip install pytest /home/node/wheelhouse/unicodedata2*.whl && \
  cd /home/node/src && \
  /tmp/pyodide-venv/bin/python -m pytest tests/test_unicodedata2.py -q

FROM pyodide-toolchain AS bundle
USER node
WORKDIR /home/node/out

COPY --chown=node:node --from=pyodide-standard-wheels /home/node/wheelhouse/brotli-*.whl /home/node/out/src/vendor/
COPY --chown=node:node --from=pyodide-standard-wheels /home/node/wheelhouse/lxml-*.whl /home/node/out/src/vendor/
COPY --chown=node:node --from=fonttools-wheel /home/node/wheelhouse/fonttools-*.whl /home/node/out/src/vendor/
COPY --chown=node:node --from=uharfbuzz-wheel /home/node/wheelhouse/uharfbuzz-*.whl /home/node/out/src/vendor/
COPY --chown=node:node --from=unicodedata2-wheel /home/node/wheelhouse/unicodedata2-*.whl /home/node/out/src/vendor/

FROM scratch AS export
COPY --from=bundle /home/node/out/ /
