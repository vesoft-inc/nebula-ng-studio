# Upgrade legacy Studio 5.x (before 5.3.2)

This guide covers upgrading a NebulaGraph Studio **5.x DEB or RPM installation earlier than 5.3.2** to a current Studio release. This one-time upgrade moves Studio to its current application and service layout while preserving the configuration and, when used, SQLite data. If you already run 5.3.2 or later, follow the regular [upgrade instructions](linux-packages.md#upgrade-and-remove) instead.

The migration script supports standard, unmodified installations only. Run it **once** for this upgrade; later Studio upgrades do not need it. The read-only preflight check is required, and installations with custom paths, service overrides, or other unsupported changes must be upgraded manually.

## Before upgrading

- Download the target Studio release in the matching package format and architecture.
- Verify its checksum.
- Back up the configuration and database before starting.
- Plan to start the new service manually. The upgrade never starts it automatically; it preserves the previous enabled, disabled, or masked state.

Database changes are forward-only. Keep the pre-upgrade database backup until the new installation has been verified; an upgraded database must not be opened by the previous Studio version.

## Run the one-time migration

Use `scripts/migrate-nebula-graph-studio.sh` from the same source tag as the target release. Its read-only check verifies the package, architecture, required system dependencies, service account, and standard installation layout without stopping the service or changing installed files. Do not run `migrate` until this check succeeds:

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

Use the corresponding RPM filenames for an RPM installation. The script backs up the existing configuration and, when used, SQLite database. It installs the target Studio release, puts the migrated configuration under `/etc/nebula-studio/` and SQLite data under `/var/lib/nebula-studio/`, transfers the enabled or masked state to the new service, and leaves it stopped. Existing log files remain at their previous location.

Start and verify Studio explicitly:

```bash
sudo systemctl start nebula-studio.service
sudo ./scripts/migrate-nebula-graph-studio.sh verify
```

Use `--source-root <path>` if the existing Studio installation is somewhere other than `/usr/local/nebula-graph-studio`.

For MySQL, create an external backup first and pass `--mysql-backup-confirmed`. A custom database path, systemd override, occupied target directory, modified service script, or architecture mismatch requires a manual upgrade.

If the migration is interrupted, resolve the reported problem and rerun it with the same package to resume. Completed backups and deployed data are not overwritten. Once migration and verification succeed, use the regular upgrade procedure for future Studio versions; do not run this script again.

## Rollback

Stop the new service before rolling back. Restore the previous application, configuration, and pre-upgrade database backup together. Do not reuse a database after the new version has applied its schema changes.
