# NebulaGraph Studio Linux packages

Studio provides DEB and RPM packages for 64-bit `amd64` and `arm64` Linux. Download the package and matching `.sha256` file from [GitHub Releases](https://github.com/vesoft-inc/nebula-ng-studio/releases).

## Compatibility

| Package | Tested                           | Not fully tested                    |
| ------- | -------------------------------- | ----------------------------------- |
| DEB     | Ubuntu 22.04/24.04, Debian 12/13 | Ubuntu 20.04                        |
| RPM     | Rocky Linux 9/10                 | CentOS 7, compatible RHEL/AlmaLinux |

Alpine and other musl-based systems require the container image. Studio does not currently provide an APT or YUM repository.

## Install

Verify and install the package for your architecture.

```bash
# DEB
sha256sum --check nebula-studio_<file-version>_amd64.deb.sha256
sudo dpkg --install nebula-studio_<file-version>_amd64.deb

# RPM
sha256sum --check nebula-studio-<file-version>-1.x86_64.rpm.sha256
sudo rpm -U nebula-studio-<file-version>-1.x86_64.rpm
```

Prerelease filenames use dots, for example `5.4.0.rc.3`. Installation leaves Studio stopped and disabled. Review the configuration, then start it explicitly:

```bash
sudo systemctl start nebula-studio.service
sudo systemctl status nebula-studio.service
sudo systemctl enable nebula-studio.service  # optional: start during boot
```

## Files and configuration

| Content                      | Location                           |
| ---------------------------- | ---------------------------------- |
| Application                  | `/usr/lib/nebula-studio`           |
| Configuration                | `/etc/nebula-studio/config.yaml`   |
| Optional environment         | `/etc/nebula-studio/studio.env`    |
| SQLite database              | `/var/lib/nebula-studio/studio.db` |
| Application logs             | `/var/log/nebula-studio`           |

The package manager protects `config.yaml` during upgrades. For stable login sessions, set `STUDIO_TOKEN_SECRET` and `STUDIO_ENCRYPT_PASSPHRASE` in `studio.env`, make it readable only by root, and restart Studio.

To prefill the Graphd address on the login page, set `STUDIO_GRAPHD_DEFAULT_HOST` and `STUDIO_GRAPHD_DEFAULT_PORT` in `studio.env` and restart Studio. The packaged YAML expands these variables. If you replace their YAML entries with literal values, the environment variables no longer affect those entries.

## Upgrade and remove

Back up the database before upgrading. Installing a newer package stops Studio and leaves it stopped afterward; its enabled or masked state is preserved.

```bash
sudo systemctl start nebula-studio.service
/usr/lib/nebula-studio/bin/studio -healthcheck http://127.0.0.1:7001/api-studio/health
/usr/lib/nebula-studio/bin/studio -healthcheck http://127.0.0.1:7001/api-studio/health/ready
```

Removing the package keeps the database, logs and service account. Debian purge also removes the package-managed `config.yaml`, but keeps the database and a user-created `studio.env`.

Database migrations are forward-only. Restore the pre-upgrade database backup when rolling back.
