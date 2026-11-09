<p align="center">
  <a href="https://nebula-graph.io/" rel="noopener noreferrer">
    <picture>
      <source
        media="(prefers-color-scheme: dark)"
        srcset="apps/web/public/images/login-logo-dark.svg"
      />
      <source
        media="(prefers-color-scheme: light)"
        srcset="apps/web/public/images/login-logo-light.svg"
      />
      <img
        src="apps/web/public/images/login-logo-light.svg"
        alt="NebulaGraph Studio"
        width="429"
        height="57"
      />
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://github.com/vesoft-inc/nebula-ng-studio/actions/workflows/ci.yml"><img src="https://github.com/vesoft-inc/nebula-ng-studio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue" alt="License: Apache-2.0" /></a>
</p>

<p align="center">
  A web-based visualization tool for NebulaGraph.
  <a href="https://dev-docs.nebula-graph.io/master/visualization/studio/" rel="noopener noreferrer">Read the Docs to Learn More.</a>
</p>

## 🚀 Quick start

Studio is available as a multi-architecture OCI image, native Linux packages, or Linux tar archives.

```bash
docker run -d --name nebula-studio \
  --restart unless-stopped \
  -p 7001:7001 \
  -v nebula-studio-data:/app/data \
  vesoft/nebula-studio:latest
```

Open <http://localhost:7001> and enter a Graphd address reachable from the container.

DEB, RPM, and Linux tar archives are available from [GitHub Releases](https://github.com/vesoft-inc/nebula-ng-studio/releases).

See [`deploy/linux-packages.md`](deploy/linux-packages.md) for native package installation and upgrades, [`deploy/linux-tar.md`](deploy/linux-tar.md) for self-contained archives, and [`deploy/docker.md`](deploy/docker.md) for containers.

## ⚙️ Configuration

Studio reads a YAML configuration file. Its location depends on the deployment:

| Deployment                                                  | Configuration file                               |
| ----------------------------------------------------------- | ------------------------------------------------ |
| [Docker](deploy/docker.md#secrets-and-configuration)        | `/app/etc/config.yaml` inside the container      |
| [DEB/RPM](deploy/linux-packages.md#files-and-configuration) | `/etc/nebula-studio/config.yaml`                 |
| [Linux tar archive](deploy/linux-tar.md#configure)          | `etc/config.yaml` inside the extracted directory |

Configuration values may reference environment variables with `$VAR` or `${VAR}`. Use environment variables for secrets instead of storing them directly in YAML.

## 🧩 Compatibility

| Area               | Supported                                                                    | Notes                                                                                        |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| NebulaGraph/Graphd | NebulaGraph 5.x                                                              | NebulaGraph 3.x is not supported.                                                            |
| Native DEB/RPM     | Ubuntu 22.04/24.04, Debian 12/13, Rocky Linux 9/10 on amd64/arm64            | Ubuntu 20.04, CentOS 7, RHEL and AlmaLinux are not fully tested.                             |
| Native tar         | Linux amd64/arm64 with glibc 2.17+                                           | Alpine and other musl-based systems require the container image.                             |
| Container          | Linux containers on amd64/arm64, Docker Engine 20.10+, Docker Compose v2.20+ | macOS and Windows are supported through Docker Desktop or WSL2. Compose v1 is not supported. |

## 🛠️ Troubleshooting

See the [troubleshooting guide](deploy/troubleshooting.md).

## 🤝 Contributing

See the [contributing guide](CONTRIBUTING.md).

## 📄 License

This repository is licensed under the [Apache License 2.0](LICENSE). Third-party components and assets may retain their own compatible license terms in their respective directories.
