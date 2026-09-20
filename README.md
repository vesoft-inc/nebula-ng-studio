<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://github.com/user-attachments/assets/4f7c9f6d-7ce3-4c57-8e1b-26a7f53c26da"
    />
    <source
      media="(prefers-color-scheme: light)"
      srcset="https://github.com/user-attachments/assets/a82894c8-de42-4b87-9bc0-134b203b5c0e"
    />
    <img
      src="https://github.com/user-attachments/assets/a82894c8-de42-4b87-9bc0-134b203b5c0e"
      alt="NebulaGraph Studio"
      width="429"
      height="57"
    />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/vesoft-inc/nebula-ng-studio/actions/workflows/ci.yml"><img src="https://github.com/vesoft-inc/nebula-ng-studio/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="LICENSE"><img src="https://github.com/user-attachments/assets/d2877980-d8d4-4185-8c7c-05852bc89c90" alt="License: Apache-2.0" /></a>
</p>

<p align="center">A web-based visualization tool for NebulaGraph.</p>

## 🚀 Quick start

Studio is available as a multi-architecture OCI image, Linux tar archives, or source code.

```bash
docker run -d --name nebula-studio \
  --restart unless-stopped \
  -p 7001:7001 \
  -v nebula-studio-data:/app/data \
  ghcr.io/vesoft-inc/nebula-studio:latest
```

Open <http://localhost:7001> and enter a Graphd address reachable from the container.

Linux tar archives are available from [GitHub Releases](https://github.com/vesoft-inc/nebula-ng-studio/releases) ([`deploy/linux-tar.md`](deploy/linux-tar.md)). [`deploy/docker.md`](deploy/docker.md) covers image tags, Graphd connectivity, secrets, ports, custom configuration, and health probes.

## ⚙️ Configuration

Studio Server reads the YAML selected by its `-f <path>` flag. Local development defaults to `apps/server/etc/config.yaml`; the container defaults to `/app/etc/config-release.yaml`.

Before YAML decoding, Studio expands environment references with Go's `os.ExpandEnv`: both `$VAR` and `${VAR}` are supported, undefined variables expand to an empty string, and YAML quoting does not disable expansion. For a sensitive value containing a literal `$`, pass the whole value through an environment variable instead of writing it in YAML. Normal field and value validation still runs after expansion.

## 🧩 Compatibility

| Area               | Release-qualified baseline                                                   | Boundary                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NebulaGraph/Graphd | NebulaGraph 5.x                                                              | NebulaGraph 3.x is not supported.                                                                                                                                           |
| Native tar runtime | Linux amd64/arm64, glibc 2.17+                                               | Tested on CentOS 7/8 and Ubuntu 20.04/22.04/24.04; newer glibc systems are expected to work but are untested. Alpine and other musl distributions need the container image. |
| Container runtime  | Linux containers on amd64/arm64, Docker Engine 20.10+, Docker Compose v2.20+ | macOS and Windows run the image through Docker Desktop or WSL2. Compose v1 is unsupported.                                                                                  |

## 🛠️ Troubleshooting

Common startup, Graphd connectivity, Docker configuration, and database migration failures are documented in [`deploy/troubleshooting.md`](deploy/troubleshooting.md).

## 🤝 Contributing

Development setup and repository checks are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

This repository is licensed under the [Apache License 2.0](LICENSE). Third-party components and assets may retain their own compatible license terms in their respective directories.
