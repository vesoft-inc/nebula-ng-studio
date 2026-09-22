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

Use an exact version tag for reproducible deployments. `latest` tracks stable releases, while `rc` and `beta` track their respective prerelease channels. Other prereleases are available only by exact version. On Linux, add `--add-host host.docker.internal:host-gateway` to reach Graphd running on the Docker host.

Or build and start the checked-in Compose project from the repository root:

```bash
docker compose up -d --build
```

Open <http://127.0.0.1:7001>. The default SQLite database is stored in the `studio-data` volume and survives container replacement.

Inspect or stop the deployment with:

```bash
docker compose logs -f studio
docker compose down
```

`docker compose logs` shows stdout, stderr, and early startup failures. Rotating application logs are written under `/app/logs`, which is not persisted by default.

To retain file logs, add a Compose override such as:

```yaml
services:
  studio:
    volumes:
      - ./studio-logs:/app/logs
```

The host directory must be writable by UID/GID 10001. A separate named volume is also supported.

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

Studio generates temporary authentication secrets when none are configured, so existing sessions become invalid after a restart. Provide stable values for persistent sessions:

```bash
STUDIO_TOKEN_SECRET='<stable-random-value>' \
STUDIO_ENCRYPT_PASSPHRASE='<16-or-24-or-32-byte-value>' \
docker compose up -d --build
```

Use an absolute host path to select a complete deployment-owned YAML file:

```bash
STUDIO_CONFIG_FILE=/absolute/path/config.yaml docker compose up -d --build
```

The file must already exist. Environment secret values override values in the YAML file.

## Health probe and scaling

The built-in probe uses `/api-studio/health` to check that the Server can answer requests. Use `/api-studio/health/ready` when deployment automation must also verify the metadata database and migrations. Neither endpoint checks Graphd.

Set `STUDIO_HEALTHCHECK_URL` only when the built-in liveness URL must use a different scheme or address.

Run one Studio instance. Login sessions are stored in the Server process, so horizontal scaling is not supported.

## Data and upgrades

The image runs as UID/GID 10001. Compose persists `/app/data`; keep the default `/app/data/studio.db` path unless a custom volume has the correct permissions.

Before changing Studio versions:

1. Stop Studio and back up the SQLite volume or MySQL database.
2. Rebuild or pull the exact target version and start it against a copy first.
3. Confirm both health endpoints before upgrading production.

Deploying an earlier image does not reverse database migrations: migrations are forward-only, so restoring the matching pre-upgrade backup is the only way back.
