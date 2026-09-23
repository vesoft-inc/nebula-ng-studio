#!/usr/bin/env bash
set -euo pipefail

suite=${1:?usage: test-native-packages.sh <debian-family|rocky9|rocky10>}
arch=${PACKAGE_ARCH:?PACKAGE_ARCH is required}
release_root=${RELEASE_ROOT:?RELEASE_ROOT is required}
upgrade_root=${UPGRADE_ROOT:?UPGRADE_ROOT is required}
metadata=${upgrade_root}/fixture-metadata.json

test -f "${metadata}"
jq -e \
  --arg arch "${arch}" \
  --arg version "${STUDIO_VERSION:?STUDIO_VERSION is required}" \
  --arg sha "${GIT_HASH:?GIT_HASH is required}" \
  '.arch == $arch and .version == $version and .sourceSha == $sha' \
  "${metadata}" >/dev/null
(
  cd "${release_root}"
  test -f "assets-${arch}.txt"
  test "$(wc -l < "assets-${arch}.txt" | tr -d ' ')" = 6
  while IFS= read -r asset; do test -f "${asset}"; done < "assets-${arch}.txt"
  sha256sum --check --status ./*.sha256
)
(
  cd "${upgrade_root}"
  sha256sum --check --status nebula-studio-old.deb.sha256 nebula-studio-old.rpm.sha256
)

deb=$(jq -r .debFile "${metadata}")
rpm=$(jq -r .rpmFile "${metadata}")
[[ ${deb} =~ ^nebula-studio_[A-Za-z0-9.+~-]+_${arch}\.deb$ ]]
[[ ${rpm} =~ ^nebula-studio-[A-Za-z0-9._+~-]+-1\.(x86_64|aarch64)\.rpm$ ]]
test -f "${release_root}/${deb}"
test -f "${release_root}/${rpm}"
test -f "${upgrade_root}/nebula-studio-old.rpm"

test_debian() {
  local image=$1
  echo "Testing ${image} on ${arch}"
  docker run --rm -v "${release_root}:/work:ro" "${image}" sh -ceu '
    apt-get update >/dev/null
    if ! apt-get install -y "/work/$1" > /tmp/studio-install.log 2>&1; then
      cat /tmp/studio-install.log >&2
      exit 1
    fi
    test -x /usr/lib/nebula-studio/bin/studio
    test ! -e /run/systemd/system
    printf preserved > /var/lib/nebula-studio/studio.db
    chown nebula-studio:nebula-studio /var/lib/nebula-studio/studio.db
    if ! dpkg --remove nebula-studio > /tmp/studio-remove.log 2>&1; then
      cat /tmp/studio-remove.log >&2
      exit 1
    fi
    test -f /var/lib/nebula-studio/studio.db
  ' sh "${deb}"
}

test_rocky_install() {
  local image=$1
  echo "Testing package installation on ${image} (${arch})"
  docker run --rm -v "${release_root}:/work:ro" "${image}" sh -ceu '
    if ! dnf install -y "/work/$1" > /tmp/studio-install.log 2>&1; then
      cat /tmp/studio-install.log >&2
      exit 1
    fi
    test -x /usr/lib/nebula-studio/bin/studio
    test ! -e /run/systemd/system
    printf preserved > /var/lib/nebula-studio/studio.db
    chown nebula-studio:nebula-studio /var/lib/nebula-studio/studio.db
    if ! rpm -e nebula-studio > /tmp/studio-remove.log 2>&1; then
      cat /tmp/studio-remove.log >&2
      exit 1
    fi
    test -f /var/lib/nebula-studio/studio.db
  ' sh "${rpm}"
}

test_rocky_systemd() {
  local image=$1 suffix=$2
  local container="studio-rpm-${suffix}-${arch}-${GITHUB_RUN_ID:-local}"
  local test_image="studio-systemd-${suffix}-${arch}:${GITHUB_RUN_ID:-local}"

  docker build --progress=plain \
    --platform "linux/${arch}" \
    --build-arg "ROCKY_BASE=${image}" \
    --file .github/docker/rocky-systemd.Dockerfile \
    --tag "${test_image}" .
  docker run --detach --privileged --cgroupns=host \
    --name "${container}" \
    --volume /sys/fs/cgroup:/sys/fs/cgroup:rw \
    --volume "${release_root}:/release:ro" \
    --volume "${upgrade_root}:/upgrade:ro" \
    "${test_image}"
  cleanup_container() { docker rm --force "${container}" >/dev/null 2>&1 || true; }
  trap cleanup_container EXIT
  for attempt in {1..180}; do
    if [[ $(docker inspect --format '{{.State.Running}}' "${container}") != true ]]; then
      docker inspect --format '{{json .State}}' "${container}" >&2
      docker logs "${container}" >&2
      exit 1
    fi
    state=$(docker exec "${container}" systemctl is-system-running 2>&1 || true)
    if [[ ${state} == starting || ${state} == running || ${state} == degraded ]]; then break; fi
    if [[ ${attempt} -eq 180 ]]; then
      echo "systemd did not become usable (last state: ${state:-empty})." >&2
      docker inspect --format '{{json .State}}' "${container}" >&2
      docker exec "${container}" systemctl --no-pager --failed >&2 || true
      docker logs "${container}" >&2
      exit 1
    fi
    sleep 1
  done

  docker exec "${container}" dnf install -y /upgrade/nebula-studio-old.rpm >/dev/null
  test "$(docker exec "${container}" systemctl is-enabled nebula-studio.service 2>/dev/null || true)" = disabled
  if docker exec "${container}" systemctl is-active --quiet nebula-studio.service; then
    echo 'The package must not auto-start the Studio service.' >&2
    exit 1
  fi
  docker exec "${container}" sh -c "echo '# package-upgrade-preserved' >> /etc/nebula-studio/config.yaml"
  docker exec "${container}" systemctl enable nebula-studio.service
  docker exec "${container}" systemctl start nebula-studio.service
  for attempt in {1..30}; do
    if docker exec "${container}" /usr/lib/nebula-studio/bin/studio \
      -healthcheck http://127.0.0.1:7001/api-studio/health; then break; fi
    test "${attempt}" -lt 30
    sleep 1
  done
  docker exec "${container}" dnf install -y "/release/${rpm}" >/dev/null
  if docker exec "${container}" systemctl is-active --quiet nebula-studio.service; then
    echo 'The upgraded package must leave the Studio service stopped.' >&2
    exit 1
  fi
  test "$(docker exec "${container}" systemctl is-enabled nebula-studio.service)" = enabled
  docker exec "${container}" grep -Fqx '# package-upgrade-preserved' /etc/nebula-studio/config.yaml
  docker exec "${container}" systemctl start nebula-studio.service
  for attempt in {1..30}; do
    if docker exec "${container}" /usr/lib/nebula-studio/bin/studio \
      -healthcheck http://127.0.0.1:7001/api-studio/health; then break; fi
    test "${attempt}" -lt 30
    sleep 1
  done
  docker exec "${container}" rpm -e nebula-studio
  docker exec "${container}" test -f /var/lib/nebula-studio/studio.db
  cleanup_container
  trap - EXIT
}

case "${suite}" in
  debian-family)
    for image in ubuntu:22.04 ubuntu:24.04 debian:12-slim debian:13-slim; do
      test_debian "${image}"
    done
    ;;
  rocky9)
    test_rocky_install rockylinux:9
    test_rocky_systemd rockylinux:9 rocky9
    ;;
  rocky10)
    test_rocky_install rockylinux/rockylinux:10
    test_rocky_systemd rockylinux/rockylinux:10 rocky10
    ;;
  *) echo "Unknown native package test suite: ${suite}" >&2; exit 1 ;;
esac
