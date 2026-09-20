# Docker deployment

Studio runs as a single container and needs an existing NebulaGraph Graphd reachable from it. Start the released image directly, or build the image from this repository with the checked-in Compose project.

## Start Studio

Run the released image:

```bash
docker run -d --name nebula-studio \
  --restart unless-stopped \
  -p 7001:7001 \
  -v nebula-studio-data:/app/data \
  ghcr.io/vesoft-inc/nebula-studio:latest
```

Every release publishes `ghcr.io/vesoft-inc/nebula-studio:<version>`. Publishing the GitHub Release automatically promotes the immutable image digest: stable releases move the `X.Y`, `X`, and `latest` channels, release candidates in the exact `X.Y.Z-rc.N` form move `X.Y-rc` and `rc`, and exact `X.Y.Z-beta.N` releases move `X.Y-beta` and `beta`. Alpha and other valid prereleases keep only their immutable version tag. Each channel only moves forward, and prerelease channels never affect stable channels. Release versions must be canonical SemVer without build metadata (`+...`) and must fit the 128-character OCI tag limit. On Linux, add `--add-host host.docker.internal:host-gateway` to reach Graphd running on the Docker host.

Or build and start the checked-in Compose project from the repository root:

```bash
docker compose up -d --build
```

Open <http://127.0.0.1:7001>. The default SQLite database is stored in the `studio-data` named volume (fully qualified as `nebula-studio_studio-data`, since Compose prefixes volume names with the project name) and survives container replacement.

Static text responses use gzip by default; set `Assets.Gzip: false` in a custom
configuration when compression is provided by an upstream proxy.

Inspect or stop the deployment with:

```bash
docker compose logs -f studio
docker compose down
```

`docker compose logs` shows the container's stdout and stderr, including early startup failures. Studio's rotating application logs remain under `/app/logs`; that directory is ephemeral by default and is discarded when Compose replaces the container.

If file logs must survive container replacement, add a deployment-owned Compose override. A host bind mount is the simplest choice when an operator or log collector needs direct file access:

```yaml
services:
  studio:
    volumes:
      - ./studio-logs:/app/logs
```

The host directory must be writable by UID/GID 10001. A named volume mounted at `/app/logs` is also valid when only container-independent retention is needed. Logs are operational data and should not share the `studio-data` database volume.

`docker compose down` keeps the named volume. Do not add `--volumes` unless the database has been backed up and permanent deletion is intended.

## Ports and Graphd connectivity

Change only the host-side Studio port with:

```bash
STUDIO_PORT=17001 docker compose up -d --build
```

The Graphd address entered on the login page is resolved by the Studio Server container:

- Use `host.docker.internal:9669` for Graphd on the Docker host. Compose maps this name to the host gateway.
- Use a deployment DNS name or reachable IP for Graphd on another machine.
- Do not use `127.0.0.1` unless Graphd runs in the same container.
- Username and password are entered at login and are never Docker build arguments.

## Secrets and custom configuration

Without overrides, Compose mounts the checked-in `apps/server/etc/config-release.yaml` read-only. It contains no fixed authentication secrets, OAuth provider preset, or database password. Studio generates process-local authentication secrets on startup, so sessions do not survive a restart unless stable values are supplied.

For stable sessions, provide both values through the deployment secret layer:

```bash
STUDIO_TOKEN_SECRET='<stable-random-value>' \
STUDIO_ENCRYPT_PASSPHRASE='<16-24-or-32-byte-value>' \
docker compose up -d --build
```

Use an absolute host path to select a complete deployment-owned YAML file:

```bash
STUDIO_CONFIG_FILE=/absolute/path/config.yaml docker compose up -d --build
```

Compose requires that file to exist and mounts it at `/app/etc/config-release.yaml` read-only. Environment secret values override the selected YAML.

## Health probe and scaling

The image's built-in probe calls `GET /api-studio/health`. This unauthenticated liveness endpoint returns `200` when the Server can answer HTTP requests and never checks the metadata database or Graphd.

Use `GET /api-studio/health/ready` as an external readiness gate. It returns `200` when the metadata database is disabled or when the connection and all known migrations are ready; it returns `503` when the database is unavailable or not fully migrated. Graphd is selected per login session and does not affect either probe.

Both endpoints also support `HEAD` and send `Cache-Control: no-store`. A deployment that terminates TLS in Studio can override the built-in liveness URL by passing `STUDIO_HEALTHCHECK_URL=https://127.0.0.1:7001/api-studio/health`; the checked-in Compose file forwards this variable to the container. The certificate must be trusted inside the container.

Run one Studio instance. Login sessions and Graphd credentials live in the Server process that created them; the metadata database stores application data, not sessions. A second instance behind a load balancer therefore rejects the first instance's session cookie with a session error even when both share identical secrets and database, so horizontal scaling is not supported in this release line.

## Data and upgrades

The image runs as the non-root `studio` user (UID/GID 10001) and writes only under `/app/data` and `/app/logs`. Compose persists `/app/data` but leaves `/app/logs` ephemeral by default; keep the default `/app/data/studio.db` path.

Before changing Studio versions:

1. Stop Studio and back up the SQLite volume or MySQL database.
2. Rebuild or pull the exact target version and start it against a copy first.
3. Confirm both health endpoints before upgrading production.

Deploying an earlier image does not reverse database migrations: migrations are forward-only, so restoring the matching pre-upgrade backup is the only way back.
