# Docker deployment

Studio needs an existing NebulaGraph Graphd reachable from its container. You can run the released image directly or use the Compose example below. For reproducible deployments, replace `latest` with an exact release version.

## Start Studio

Run the image directly:

```bash
docker run -d --name nebula-studio \
  --restart unless-stopped \
  -p 7001:7001 \
  -v nebula-studio-data:/app/data \
  vesoft/nebula-studio:latest
```

Alternatively, save this image-based example as `compose.yaml` in your deployment directory:

```yaml
services:
  studio:
    image: vesoft/nebula-studio:${STUDIO_IMAGE_TAG:-latest}
    init: true
    ports:
      - '${STUDIO_PORT:-7001}:7001'
    environment:
      - STUDIO_TOKEN_SECRET
      - STUDIO_TOKEN_ISSUER
      - STUDIO_ENCRYPT_PASSPHRASE
      - STUDIO_GRAPHD_DEFAULT_HOST
      - STUDIO_GRAPHD_DEFAULT_PORT
      - STUDIO_HEALTHCHECK_URL
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    volumes:
      - studio-data:/app/data
    restart: unless-stopped

volumes:
  studio-data:
```

Run `docker compose up -d` and open <http://localhost:7001>.

## Host data directories and permissions

To keep SQLite data in a host directory, replace `studio-data:/app/data` with a bind mount in the service's `volumes` list:

```yaml
services:
  studio:
    volumes:
      - ./studio/data:/app/data
```

With `docker run`, use `-v "$PWD/studio/data:/app/data"`. Docker creates a missing host directory when using this short mount syntax. Relative Compose paths are resolved from the Compose file's directory.

At startup, the image's entrypoint runs as root, initializes `/app/data` and `/app/logs`, then switches to UID/GID `10001:10001` before starting Studio. It repairs ownership and adds missing owner read/write permissions to existing files, including restored databases; directories also receive owner search permission. It only changes entries that need repair and does not follow symbolic links or recurse into other filesystems. The script uses `exec` to replace itself with Studio, so Studio receives stop signals directly (or through Docker's init when `init: true` is used).

Use dedicated Studio data and log directories: initialization changes the corresponding host files' ownership and permissions. Stop Studio and back up existing data before changing the mount. Switching from the named volume does not copy its database into the host directory; migrate the data first if you need to preserve it.

For deployments that require a non-root container from the start, use `--user 10001:10001` with `docker run`, or add `user: '10001:10001'` to the Compose service. The entrypoint then skips ownership repair and checks that `/app/data` and `/app/logs` are writable/searchable by that user. Prepare both directories and any existing database files for the selected UID/GID before startup. A different non-root UID/GID is also supported when both directories are writable by that identity.

Automatic repair requires writable storage that permits ownership changes. Read-only mounts, NFS root-squash, or host security policies can require deployment-side configuration. Custom SQLite or log paths outside `/app/data` and `/app/logs` also require deployment-managed permissions. Version and healthcheck commands skip directory initialization.

## Secrets and configuration

Set `STUDIO_IMAGE_TAG` to an exact version to pin the Compose image.

Studio generates temporary authentication secrets when none are configured, invalidating existing sessions after a restart. Set stable `STUDIO_TOKEN_SECRET` and `STUDIO_ENCRYPT_PASSPHRASE` values in the deployment environment. The passphrase must be 16, 24, or 32 bytes. For example:

```bash
STUDIO_TOKEN_SECRET='<stable-random-value>' \
STUDIO_ENCRYPT_PASSPHRASE='<16-or-24-or-32-byte-value>' \
docker compose up -d
```

`STUDIO_TOKEN_ISSUER` is optional and defaults to the neutral value `auth-service`. Set the same
stable value on every replica if the deployment requires a custom JWT issuer. The issuer must not
contain the signing secret.

When upgrading from a release affected by the JWT issuer disclosure, generate a new
`STUDIO_TOKEN_SECRET` with `openssl rand -base64 48` and replace the previous value. Deploy the
new secret to every replica at the same time, without a legacy-secret fallback. This deliberately
invalidates all existing Studio sessions, so users must log in again. Do not reuse the old signing
secret. Keep `STUDIO_TOKEN_ISSUER` consistent across replicas. If a rollback is necessary, use a
release that includes the issuer validation fix and keep the new secret.

The image reads `/app/etc/config.yaml` by default. For other settings, mount a complete, readable YAML file at that path as read-only. Keep the existing data volume:

```yaml
services:
  studio:
    volumes:
      - studio-data:/app/data
      - /absolute/path/config.yaml:/app/etc/config.yaml:ro
```

The host file must already exist. Environment secret values take precedence over the YAML values.

## Graphd connectivity and port

The Graphd address entered on the login page must be reachable from the Studio container:

- For Graphd on the Docker host, use `host.docker.internal:9669`. The Compose example maps that name on Linux; with `docker run`, add `--add-host host.docker.internal:host-gateway` on Linux.
- For Graphd elsewhere, use a reachable DNS name or IP address.
- Do not use `127.0.0.1` unless Graphd runs in the Studio container.

To prefill the login page, set `STUDIO_GRAPHD_DEFAULT_HOST` and `STUDIO_GRAPHD_DEFAULT_PORT` in the Compose environment:

```bash
STUDIO_GRAPHD_DEFAULT_HOST=host.docker.internal \
STUDIO_GRAPHD_DEFAULT_PORT=9669 \
docker compose up -d
```

With `docker run`, pass them using `-e`. The bundled YAML files expand these variables at startup. A custom YAML file must retain the `${STUDIO_GRAPHD_DEFAULT_HOST}` and `${STUDIO_GRAPHD_DEFAULT_PORT}` placeholders to use them; literal YAML values remain unchanged. Without a port value, the login page uses `9669`.

To change only the host-side Studio port with Compose, run `STUDIO_PORT=17001 docker compose up -d` and open <http://localhost:17001>.

## Health and logs

The built-in health probe checks `/api-studio/health` for a response from Studio. Use `/api-studio/health/ready` when you also need to verify the metadata database and migrations. Neither endpoint checks Graphd. Set `STUDIO_HEALTHCHECK_URL` if the built-in probe must use another scheme or address.

Use `docker compose ps` to inspect status and `docker compose logs -f studio` to see stdout, stderr, and startup errors. Rotating application logs are written to `/app/logs`, which is not persisted by default. To retain them, add a separate mount while keeping the data volume:

```yaml
services:
  studio:
    volumes:
      - studio-data:/app/data
      - ./studio-logs:/app/logs
```

The entrypoint initializes the host log directory for UID/GID 10001 unless a non-root `--user`/`user:` override is configured. Keep it separate from the SQLite data volume. Run only one Studio instance because login sessions are stored in the Server process.

The image's default exec user is root even after Studio drops privileges. For interactive commands, use `docker compose exec --user 10001:10001 studio sh` or `docker exec --user 10001:10001 <container> sh`. To inspect Studio's running identity, check its process in `/proc`; `docker exec <container> id` reports the exec user's identity, not Studio's.

## Data and upgrades

The named volume keeps SQLite data across container replacement. `docker compose down` preserves it; `docker compose down --volumes` deletes it. Studio runs as UID/GID 10001 after entrypoint initialization, unless a non-root user override is configured. Keep the default `/app/data/studio.db` path unless a custom data mount has the correct permissions.

Before changing versions, stop Studio and back up the SQLite volume or MySQL database. Test the target version against a copy before upgrading production, then pull the image and start it. Confirm both health endpoints after the upgrade.

Database migrations are forward-only. An earlier image cannot undo them; rollback requires the matching pre-upgrade database backup.
