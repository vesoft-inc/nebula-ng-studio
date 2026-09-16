# NebulaGraph Studio Linux archive

The Studio archive contains the self-hosted Web application under `assets/public`, Server binary, default release configuration, service scripts, and Apache License 2.0 text. It supports 64-bit Linux on `amd64` and `arm64` with **glibc 2.17 or newer**, which is the binary's measured symbol floor (`GLIBC_2.17`).

The archive is tested on CentOS 7 and CentOS 8, and on Ubuntu 20.04, 22.04 and 24.04. Other glibc-based distributions at that level or newer should work but are outside the tested matrix. musl-based distributions such as Alpine are **not** supported: this binary is dynamically linked against glibc. On those systems use the container image instead — it ships its own userland, so the host libc does not matter.

## Archive layout

```text
nebula-studio-<version>
├── assets   # static frontend served by the Server
├── bin      # studio Server binary
├── etc      # default configuration
└── scripts  # service manager used to start, stop and inspect Studio
```

The working directory must contain `assets/public/index.html`; the frontend is not embedded in `bin/studio`. Replace `assets/public` as one complete directory so `index.html` and its fingerprinted bundles always come from the same build.

## Verify and extract

Keep the archive and its `.sha256` file in the same directory, then verify it before extraction:

```bash
sha256sum --check nebula-studio-<version>-linux-<arch>.tar.gz.sha256
tar -xzf nebula-studio-<version>-linux-<arch>.tar.gz
cd nebula-studio-<version>
```

## Configure

Review `etc/config.yaml` before starting Studio. In particular, set `Auth.TokenSecret` and `Auth.EncryptPassphrase` — or the matching environment variables — when login sessions must survive a restart. Graphd must be reachable from the Server process.

To use a configuration outside the archive, pass it to the service script with `-c`, or run the binary directly with `-f`. Without either flag, `etc/config.yaml` inside the archive is used.

## Start and stop Studio

The archive is managed by `scripts/studio.service`:

```bash
sudo ./scripts/studio.service start studio
sudo ./scripts/studio.service status studio
sudo ./scripts/studio.service stop studio
sudo ./scripts/studio.service restart studio
```

`studio` and `all` are equivalent, and the target may be omitted.

| Command   | Behaviour                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`   | Starts the Server in the background, writes `pids/studio.pid`, appends output to `logs/studio.log`, and waits up to 30 seconds for the Server to answer. |
| `status`  | Prints `studio-server is running, pid is <pid>` and exits `0`; when stopped it prints `studio-server status is: Exited` and exits `3`.                   |
| `stop`    | Sends `SIGTERM`, waits up to 30 seconds for the process to exit, then removes `pids/studio.pid`.                                                         |
| `restart` | `stop` followed by `start`.                                                                                                                              |

`./scripts/studio.service -v` prints the Server version, and `-h` prints the usage. If the Server does not become healthy, `start` prints the last lines of `logs/studio.log` and exits non-zero. When the Server listens somewhere other than its default address, point the startup check at that address with `STUDIO_HEALTHCHECK_URL`.

Open <http://127.0.0.1:7001>.

## Run Studio as a systemd service

To keep Studio running across reboots, install the archive at a stable path and wrap the same script in a unit. Extract to `/usr/local/nebula-studio` first, then create `/etc/systemd/system/nebula-studio.service`:

```ini
[Unit]
Description=NebulaGraph Studio
After=network-online.target
Wants=network-online.target

[Service]
Type=forking
PIDFile=/usr/local/nebula-studio/pids/studio.pid
ExecStart=/bin/bash /usr/local/nebula-studio/scripts/studio.service start studio
ExecStop=/bin/bash /usr/local/nebula-studio/scripts/studio.service stop studio
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nebula-studio.service
sudo systemctl status nebula-studio.service
```

Add `User=` and `Group=` to the unit to run Studio as a dedicated account, and make the whole install directory writable by that account so `pids/`, `logs/` and `data/` can be created.

## Run in the foreground

For debugging, run the Server directly in the foreground instead of through the service script:

```bash
./bin/studio -f ./etc/config.yaml
```

The service script remains the supported way to run Studio in the background with restart handling.

## Data and logs

- `data/studio.db` — the bundled SQLite database, created relative to the archive root. Back it up before an upgrade.
- `logs/studio.log` — Server output captured by the service script. The Server also writes its own rotating logs (`access.log`, `error.log`, `severe.log`, `slow.log`, `stat.log`) into the same `logs/` directory.
- `pids/studio.pid` — the running Server's process id, maintained by the service script.

Studio stores sketches plus Explorer snapshots, icon groups, and global configuration in that database, which is separate from the NebulaGraph Graphd selected at login.

Before an upgrade, stop Studio, back up the database, and start the target version against a copy first. Reverting the binary does not revert the database schema: if the previous version cannot read the migrated schema, restore the backup taken immediately before the upgrade. Do not delete rows from `schema_migrations` to force re-execution.
