# Troubleshooting

Common Studio startup, connectivity, configuration, and data failures. The two supported deployment paths are documented in [`docker.md`](docker.md) and [`linux-tar.md`](linux-tar.md).

## Studio redirects to the login page repeatedly

Without configured authentication secrets Studio generates new process-local values at every start, so existing cookies become invalid. Set stable `STUDIO_TOKEN_SECRET` and a 16-, 24-, or 32-byte `STUDIO_ENCRYPT_PASSPHRASE` through the environment or a deployment-owned configuration file, and keep them unchanged across restarts.

Server logs record the secret source (`environment`, `config`, or `generated`) but never the values.

## The container restarts in a loop

An invalid secret stops startup: an explicitly configured encryption passphrase must be exactly 16, 24 or 32 bytes, and an empty secret environment variable is rejected rather than ignored. Under `restart: unless-stopped` the container then restarts indefinitely, so `docker compose ps` usually shows `Restarting` or an uptime that repeatedly resets to a few seconds. Use `docker compose logs studio` to find the repeated initialization error.

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

OAuth2 has no provider preset in the checked-in configuration; an enabled deployment must set authorization, token, and userinfo endpoints, client ID, client secret, and an externally reachable redirect URL ending in `/api-studio/db/oauth2-callback`.

That URL is taken verbatim from `SSO.Oauth2.RedirectURL` and is never derived from forwarded host or protocol headers, so register the public HTTPS callback exactly; the graph database must also have the OAuth2 server named by `SSO.Oauth2.ServerName` configured.

Session and OAuth2 cookies are marked `Secure` and `SameSite=None` only when Studio terminates TLS itself through the top-level `CertFile` and `KeyFile` settings. Behind a TLS-terminating proxy the cookie carries `HttpOnly` alone, because that check reads Studio's own listener and never `X-Forwarded-Proto`: either terminate TLS at Studio, or add `Secure` at the proxy (for example nginx `proxy_cookie_flags`).

## A database migration fails

Stop Studio and preserve the failed database before retrying. Inspect the Server error and the `schema_migrations` table; do not delete migration records or edit tables ad hoc.

Migrations are forward-only, and a successful migration is recorded only after its transaction completes. Restore the complete SQLite file or MySQL database backed up immediately before the upgrade and start the matching Studio version; a corrective migration needs a new ordered ID and a review alongside the application change.
