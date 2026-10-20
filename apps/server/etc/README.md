# Server configuration files

These are separate starting configurations, not layers merged at runtime. Studio reads the file passed with `-f`; without `-f`, it reads `etc/config.yaml` from its working directory.

| File | Used by | Paths |
| --- | --- | --- |
| `config.yaml` | Local development | Relative paths under the working directory |
| `config-release.yaml` | Docker image (copied to `/app/etc/config.yaml`) and Linux tar archive (copied to `etc/config.yaml`) | Relative SQLite path; file logs under the working directory |
| `config-package.yaml` | DEB and RPM build; installed as `/etc/nebula-studio/config.yaml` | SQLite in `/var/lib/nebula-studio`, logs in `/var/log/nebula-studio` |

For a deployment, edit the installed or mounted configuration rather than these source templates. Authentication secrets can be supplied through `STUDIO_TOKEN_SECRET` and `STUDIO_ENCRYPT_PASSPHRASE`.
