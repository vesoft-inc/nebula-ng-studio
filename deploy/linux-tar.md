# NebulaGraph Studio Linux archive

The Studio archive contains the Web application, Server binary, default configuration, and service script. It supports 64-bit `amd64` and `arm64` Linux with **glibc 2.17 or newer**.

The archive is tested on CentOS 7/8 and Ubuntu 20.04/22.04/24.04. Alpine and other musl-based systems are not supported; use the container image instead.

## Archive layout

```text
nebula-studio-<version>
├── LICENSE
├── README.md
├── assets
├── bin
├── etc
└── scripts
```

## Verify and extract

Keep the archive and its `.sha256` file in the same directory, then verify it before extraction:

```bash
sha256sum --check nebula-studio-<version>-linux-<arch>.tar.gz.sha256
tar -xzf nebula-studio-<version>-linux-<arch>.tar.gz
cd nebula-studio-<version>
```

## Configure

Review `etc/config.yaml` before starting Studio. Set stable authentication secrets when login sessions must survive a restart, and ensure Graphd is reachable from the Server host.

To use a configuration outside the archive, pass it to the service script with `-c`, or run the binary directly with `-f`. Without either flag, `etc/config.yaml` inside the archive is used.

## Start and stop Studio

The archive is managed by `scripts/studio.service`:

```bash
sudo ./scripts/studio.service start studio
sudo ./scripts/studio.service status studio
sudo ./scripts/studio.service stop studio
sudo ./scripts/studio.service restart studio
```

The script stores the process ID under `pids/` and writes output to `logs/studio.log`. If startup fails, it prints the latest log lines. Use `./scripts/studio.service -v` for the version and `-h` for help.

Set `STUDIO_HEALTHCHECK_URL` when Studio listens on a non-default address.

Use `/api-studio/health/ready` when deployment automation also needs to verify the metadata database and migrations.

Open <http://127.0.0.1:7001>.

For troubleshooting, run the Server directly in the foreground:

```bash
./bin/studio -f ./etc/config.yaml
```

## Data and logs

- `data/studio.db` — SQLite database.
- `logs/` — service output and rotating application logs.
- `pids/studio.pid` — running Server process ID.

## Upgrade

1. Stop Studio in the current directory and back up its configuration and database. For SQLite, preserve the configured database file and any `-wal` and `-shm` companions after the process has stopped (`data/studio.db` by default). Back up MySQL separately.
2. Verify and extract the new archive into a separate directory. Review its `etc/config.yaml` and carry over your settings. For the default SQLite path, create `data/` in the new directory and restore the backed-up database files there. Check external paths and custom relative SQLite paths against the new directory. Do not copy the old binary, assets, scripts, PID files, or logs.
3. Update any service path or symlink that points to the old directory. Start Studio from the new directory, check its version, and verify both health endpoints:

```bash
./bin/studio -v
sudo ./scripts/studio.service start studio
./bin/studio -healthcheck http://127.0.0.1:7001/api-studio/health
./bin/studio -healthcheck http://127.0.0.1:7001/api-studio/health/ready
```

Database migrations are forward-only. To roll back, stop the new version and restore the previous archive, configuration, and pre-upgrade database backup together.
