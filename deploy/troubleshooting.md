# Troubleshooting

Common Studio startup, connectivity, configuration, and data failures. See [`docker.md`](docker.md), [`linux-packages.md`](linux-packages.md), or [`linux-tar.md`](linux-tar.md) for deployment instructions.

## Studio redirects to the login page repeatedly

Studio generates temporary authentication secrets when none are configured, which invalidates existing cookies after a restart. Set stable `STUDIO_TOKEN_SECRET` and a 16-, 24-, or 32-byte `STUDIO_ENCRYPT_PASSPHRASE`, and keep them unchanged across restarts.

## The container restarts in a loop

An invalid or empty secret stops startup. `docker compose ps` may show `Restarting` or an uptime that repeatedly resets. Use `docker compose logs studio` to find the startup error.

## Cannot connect to Graphd

The address must be reachable from the Server process, not only from the browser: use `host.docker.internal:9669` for a host service or a container-network DNS name for another service, since `127.0.0.1` points back to the Studio container.

Confirm the Graphd version is in the supported 5.x protocol family, and verify address, port, username, password, TLS, and network policy outside Studio.

## A custom Docker configuration is not loaded

`STUDIO_CONFIG_FILE` must be an existing readable absolute host path; Compose mounts it over `/app/etc/config-release.yaml` and does not create a missing path. Environment authentication secrets take precedence over values in the file. `docker compose config` shows the resolved mounts.

## Studio cannot write SQLite data

The container runs as a non-root user. Keep the default `/app/data/studio.db` path, or make a custom bind mount writable by UID/GID 10001. Back up the database before changing ownership or mount layout.

## Port 7001 is already in use

Publish a different host port:

```bash
STUDIO_PORT=17001 docker compose up -d --build
```

Open `http://127.0.0.1:17001`.

## OAuth2 login does not start or never returns

Configure the provider endpoints, client credentials, and a public redirect URL ending in `/api-studio/db/oauth2-callback`. Register that exact URL with the provider and configure the matching OAuth2 server in NebulaGraph.

When TLS terminates at a reverse proxy, ensure the proxy marks the OAuth2 cookie as `Secure`. Alternatively, configure TLS directly in Studio.

## A database migration fails

Stop Studio and preserve the failed database before retrying. Do not edit migration records manually.

Database migrations are forward-only. Restore the complete SQLite file or MySQL backup made before the upgrade, then start the matching Studio version.
