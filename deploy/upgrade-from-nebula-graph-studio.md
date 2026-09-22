# Upgrade from `nebula-graph-studio`

This guide applies only to installations distributed under the previous `nebula-graph-studio` name. For a new installation, use the standard DEB, RPM, or Linux archive documentation instead.

The provided upgrade script is designed for standard, unmodified DEB and RPM installations. It is not a general-purpose migration tool: the read-only preflight check is required, and installations with custom paths, service overrides, or other unsupported changes must be upgraded manually. Extracted tgz installations follow the separate procedure below.

## Before upgrading

- Download the `nebula-studio` release with the matching package format and architecture.
- Verify its checksum.
- Back up the configuration and database before starting.
- Plan to start the new service manually. The upgrade never starts it automatically; it preserves the previous enabled, disabled, or masked state.

Database changes are forward-only. Keep the pre-upgrade database backup until the new installation has been verified; an upgraded database must not be opened by the previous Studio version.

## From a DEB or RPM installation

Use `scripts/migrate-nebula-graph-studio.sh` from the same source tag as the new package. Its read-only check verifies the package, architecture, required system dependencies, service account, and standard installation layout without stopping the service or changing installed files. Do not run `migrate` until this check succeeds:

```bash
sudo ./scripts/migrate-nebula-graph-studio.sh check \
  --package ./nebula-studio_<file-version>_amd64.deb \
  --checksum ./nebula-studio_<file-version>_amd64.deb.sha256
```

If the check succeeds, run the upgrade:

```bash
sudo ./scripts/migrate-nebula-graph-studio.sh migrate \
  --package ./nebula-studio_<file-version>_amd64.deb \
  --checksum ./nebula-studio_<file-version>_amd64.deb.sha256
```

Use the corresponding RPM filenames for an RPM installation. The script backs up the existing configuration and SQLite database, replaces the package, transfers the enabled or masked service state, and leaves the new service stopped.

Start and verify Studio explicitly:

```bash
sudo systemctl start nebula-studio.service
sudo ./scripts/migrate-nebula-graph-studio.sh verify
```

Use `--source-root <path>` if the previous package was installed somewhere other than `/usr/local/nebula-graph-studio`.

For MySQL, create an external backup first and pass `--mysql-backup-confirmed`. A custom database path, systemd override, occupied target directory, modified service script, or architecture mismatch requires a manual upgrade.

If the command is interrupted, resolve the reported problem and rerun it with the same package. Completed backups and deployed data are not overwritten.

## From an extracted tgz archive

The upgrade script supports DEB and RPM installations only. To upgrade an extracted archive manually:

1. Stop Studio and back up the existing installation and database. For SQLite, use its backup command or preserve `studio.db`, `studio.db-wal`, and `studio.db-shm` together after the process has stopped. Back up MySQL separately.
2. Verify and extract the new archive into a separate directory. Do not overwrite the existing installation.
3. Copy `etc/config.yaml` and the SQLite data into the corresponding locations in the new directory. Keep the new binary, assets, and scripts; do not copy old PID files or logs.
4. Update the systemd unit or stable symlink if used, start Studio manually, and verify `/api-studio/health` and `/api-studio/health/ready`.

## Rollback

Stop the new service before rolling back. Restore the previous application, configuration, and pre-upgrade database backup together. Do not reuse a database after the new version has applied its schema changes.
