# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.25.14
ARG GO_SHA256_AMD64=a21ae5633a269bcd7e90cf767e48225633795e99d831742cbf3397064fee7712
ARG GO_SHA256_ARM64=9bf234ea70ffec9347fdf6b22ce4add51717d3386a38a441e8c8743fceb5eaee
ARG GO_BUILDER_IMAGE=oraclelinux:7-slim@sha256:1add6ed8602ea996528110fe75f4b03c2ca7ffdbe9497148dbb46c3cc9ce6acd
ARG STUDIO_VERSION
ARG GIT_HASH=unknown
ARG GIT_REF=unknown
ARG SOURCE_URL=https://github.com/vesoft-inc/nebula-ng-studio
ARG LICENSES=Apache-2.0

FROM --platform=$BUILDPLATFORM node:24.21.0-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS web-builder

ARG STUDIO_VERSION
ARG STUDIO_BRAND_NAME
ARG STUDIO_BRAND_NAME_ZH_CN
ARG STUDIO_BRAND_CONSOLE_NAME
ARG STUDIO_BRAND_CONSOLE_PROMPT
ARG STUDIO_BRAND_STUDIO_TITLE
ARG STUDIO_BRAND_GUI_TITLE
ARG STUDIO_BRAND_COPYRIGHT
ARG STUDIO_BRAND_HELP_URL_TEMPLATE
ARG STUDIO_DEFAULT_LANGUAGE

WORKDIR /workspace

ENV HUSKY=0

RUN corepack enable \
    && corepack prepare pnpm@9.12.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json tailwind.config.mjs postcss.config.mjs .npmrc ./
COPY apps/gui/package.json ./apps/gui/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/force-graph/package.json ./packages/force-graph/package.json
COPY packages/ui-components/package.json ./packages/ui-components/package.json
COPY packages/utils/package.json ./packages/utils/package.json

RUN studio_version="${STUDIO_VERSION:-$(node -p "require('./apps/web/package.json').version")}" \
    && test -n "${studio_version}" \
    && printf '%s\n' "${studio_version}" > /tmp/studio-version

RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages

RUN STUDIO_VERSION="$(cat /tmp/studio-version)" pnpm build

# The server binary is built on a glibc 2.17 baseline so one archive runs on CentOS 7,
# Ubuntu 22.04 and Ubuntu 24.04. No official golang image offers that baseline, so the
# toolchain is installed from the pinned release archive and verified by SHA-256;
# .github/workflows/studio-archives.yml asserts the resulting symbol floor.
FROM ${GO_BUILDER_IMAGE} AS server-builder

ARG GO_VERSION
ARG GO_SHA256_AMD64
ARG GO_SHA256_ARM64
ARG TARGETARCH

ENV PATH=/usr/local/go/bin:${PATH}
ENV GOTOOLCHAIN=local

RUN set -eux; \
    yum install -y gcc glibc-devel tar gzip curl ca-certificates; \
    case "${TARGETARCH}" in \
      amd64) go_sha="${GO_SHA256_AMD64}" ;; \
      arm64) go_sha="${GO_SHA256_ARM64}" ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/go.tar.gz "https://go.dev/dl/go${GO_VERSION}.linux-${TARGETARCH}.tar.gz"; \
    printf '%s  %s\n' "${go_sha}" /tmp/go.tar.gz > /tmp/go.sha256; \
    sha256sum -c /tmp/go.sha256; \
    rm -f /tmp/go.sha256; \
    tar -C /usr/local -xzf /tmp/go.tar.gz; \
    rm -f /tmp/go.tar.gz; \
    yum clean all; \
    go version

WORKDIR /workspace/apps/server

COPY apps/server/go.mod apps/server/go.sum ./

RUN go mod download

COPY apps/server .
COPY --from=web-builder /workspace/apps/server/assets/public ./assets/public
COPY --from=web-builder /tmp/studio-version /tmp/studio-version

ARG GIT_HASH
ARG GIT_REF
ARG STUDIO_BRAND_STUDIO_TITLE
ARG TARGETOS
ARG TARGETARCH

RUN studio_version="$(cat /tmp/studio-version)" \
    && test -n "${studio_version}" \
    && product_name_ldflag= \
    && if [ "${STUDIO_BRAND_STUDIO_TITLE+x}" = x ]; then \
      product_name_ldflag="-X 'github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version.ProductName=${STUDIO_BRAND_STUDIO_TITLE}'"; \
    fi \
    && test "$(go env GOOS)" = "${TARGETOS}" \
    && test "$(go env GOARCH)" = "${TARGETARCH}" \
    && CGO_ENABLED=1 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -trimpath \
    -ldflags="-s -w \
      -X github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version.Value=${studio_version} \
      -X github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version.GitHash=${GIT_HASH} \
      -X github.com/vesoft-inc/nebula-ng-studio/apps/server/pkg/version.GitRef=${GIT_REF} \
      ${product_name_ldflag}" \
    -o /out/studio \
    .

RUN CGO_ENABLED=1 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /out/studio-migrate-helper \
    ./cmd/studio-migrate-helper

FROM scratch AS archive-export

COPY --from=server-builder /out/studio /studio
COPY --from=server-builder /out/studio-migrate-helper /studio-migrate-helper
COPY --from=server-builder /workspace/apps/server/assets/public /assets/public

FROM --platform=$TARGETPLATFORM debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251 AS runtime

ARG STUDIO_VERSION
ARG GIT_HASH
ARG GIT_REF
ARG SOURCE_URL
ARG LICENSES

LABEL org.opencontainers.image.title="NebulaGraph Studio" \
      org.opencontainers.image.description="Self-hosted NebulaGraph Studio with integrated Explorer" \
      org.opencontainers.image.source="${SOURCE_URL}" \
      org.opencontainers.image.version="${STUDIO_VERSION}" \
      org.opencontainers.image.revision="${GIT_HASH}" \
      org.opencontainers.image.ref.name="${GIT_REF}" \
      org.opencontainers.image.licenses="${LICENSES}"

# Debian's util-linux provides setpriv for dropping privileges after mount setup.
RUN command -v setpriv >/dev/null \
    && groupadd --system --gid 10001 studio \
    && useradd --uid 10001 --gid studio --home-dir /app --shell /usr/sbin/nologin --no-create-home studio \
    && mkdir -p /app/data /app/logs /etc/ssl/certs \
    && chown -R studio:studio /app

WORKDIR /app

COPY --from=server-builder --chown=studio:studio /out/studio ./studio
COPY --from=server-builder --chown=studio:studio /workspace/apps/server/assets/public ./assets/public
COPY --from=server-builder --chown=studio:studio /workspace/apps/server/etc ./etc
# The builder is Oracle Linux, whose ca-certificates ships the bundle at the RHEL
# path (the Debian-style name does not exist there); the runtime image is Debian
# and has no /etc/ssl at all, so the bundle is copied to the Debian path.
COPY --from=server-builder /etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem /etc/ssl/certs/ca-certificates.crt
COPY --chmod=0555 scripts/docker-entrypoint.sh /usr/local/bin/studio-entrypoint.sh

# The entrypoint initializes mounted directories, then execs Studio as 10001:10001.
# Deployments that provide their own directory permissions can override --user.
USER root

VOLUME ["/app/data"]

EXPOSE 7001

# The probe follows the listener scheme: a deployment that terminates TLS in Studio
# overrides STUDIO_HEALTHCHECK_URL with its https URL, as scripts/studio.service does.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD /usr/local/bin/studio-entrypoint.sh -healthcheck "${STUDIO_HEALTHCHECK_URL:-http://127.0.0.1:7001/api-studio/health}"

STOPSIGNAL SIGTERM

ENTRYPOINT ["/usr/local/bin/studio-entrypoint.sh"]
CMD ["-f", "etc/config-release.yaml"]
