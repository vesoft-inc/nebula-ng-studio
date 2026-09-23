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

## Secrets and configuration

Set `STUDIO_IMAGE_TAG` to an exact version to pin the Compose image.

Studio generates temporary authentication secrets when none are configured, invalidating existing sessions after a restart. Set stable `STUDIO_TOKEN_SECRET` and `STUDIO_ENCRYPT_PASSPHRASE` values in the deployment environment. The passphrase must be 16, 24, or 32 bytes. For example:

```bash
STUDIO_TOKEN_SECRET='<stable-random-value>' \
STUDIO_ENCRYPT_PASSPHRASE='<16-or-24-or-32-byte-value>' \
docker compose up -d
```

For other settings, add a complete, readable YAML file as a read-only mount. Keep the existing data volume:

```yaml
services:
  studio:
    volumes:
      - studio-data:/app/data
      - /absolute/path/config.yaml:/app/etc/config-release.yaml:ro
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

The host log directory must be writable by UID/GID 10001. Keep it separate from the SQLite data volume. Run only one Studio instance because login sessions are stored in the Server process.

## Data and upgrades

The named volume keeps SQLite data across container replacement. `docker compose down` preserves it; `docker compose down --volumes` deletes it. The image runs as UID/GID 10001. Keep the default `/app/data/studio.db` path unless a custom data mount has the correct permissions.

Before changing versions, stop Studio and back up the SQLite volume or MySQL database. Test the target version against a copy before upgrading production, then pull the image and start it. Confirm both health endpoints after the upgrade.

Database migrations are forward-only. An earlier image cannot undo them; rollback requires the matching pre-upgrade database backup.
