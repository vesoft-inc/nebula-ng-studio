# Troubleshooting

Common Studio startup, connectivity, upgrade, and data failures. See [`docker.md`](docker.md), [`linux-packages.md`](linux-packages.md), or [`linux-tar.md`](linux-tar.md) for deployment instructions.

## A DEB or RPM upgrade from older Studio 5.x is blocked

Installing a current package over a Studio 5.x release earlier than 5.3.2 may report a package conflict. Do not force the installation or remove the existing installation manually first: installing the new package alone does not transfer the configuration, database, or service state. Follow [Upgrade legacy Studio 5.x](upgrade-legacy-studio.md) for the one-time upgrade.

## Sessions are lost after Studio restarts

Studio generates temporary authentication secrets when none are configured, which invalidates existing sessions after a restart. Set stable `STUDIO_TOKEN_SECRET` and a 16-, 24-, or 32-byte `STUDIO_ENCRYPT_PASSPHRASE`, and keep them unchanged across restarts.

## The container restarts in a loop

Use `docker compose ps` to check for `Restarting` or an uptime that repeatedly resets, then inspect the startup error with `docker compose logs studio`. An invalid or explicitly empty authentication secret is one possible cause.

## Cannot connect to Graphd

The address must be reachable from the Server process, not only from the browser: use `host.docker.internal:9669` for a host service or a container-network DNS name for another service, since `127.0.0.1` points back to the Studio container.

Confirm the Graphd version is in the supported 5.x protocol family, and verify address, port, username, password, TLS, and network policy outside Studio.

## Studio cannot write SQLite data

By default, the entrypoint initializes `/app/data` and `/app/logs` as root, then runs Studio as UID/GID 10001. A host directory such as `./studio/data:/app/data` is initialized automatically, including existing database files. See [host data directories and permissions](docker.md#host-data-directories-and-permissions).

If startup reports `Studio entrypoint:`, check that the mount is writable and permits ownership changes. Read-only mounts, NFS root-squash, and host security policies can block initialization. With a non-root `--user` or Compose `user:` override, automatic repair is skipped; both directories and any existing database files must already be accessible to that UID/GID. Custom database paths and symlink targets outside the initialized directories require their own permissions. Back up the database before changing ownership or mount layout.

## OAuth2 login does not start or never returns

Configure the provider endpoints, client credentials, and a public redirect URL ending in `/api-studio/db/oauth2-callback`. Register that exact URL with the provider and configure the matching OAuth2 server in NebulaGraph.

If the provider redirects back but login fails, check that the browser sends the temporary `oauth2_context` cookie to the callback. When TLS terminates at a reverse proxy, inspect the actual cookie behavior; Studio sets `Secure` only when it serves HTTPS itself.

## A database migration fails

Stop Studio and preserve the failed database before retrying. Do not edit migration records manually.

Database migrations are forward-only. Restore the complete SQLite file or MySQL backup made before the upgrade, then start the matching Studio version.
