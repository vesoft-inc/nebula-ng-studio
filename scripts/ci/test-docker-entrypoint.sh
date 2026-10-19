#!/usr/bin/env bash
set -euo pipefail

image=${IMAGE:?IMAGE is required}
fixture=$(mktemp -d)
fixture=$(cd "${fixture}" && pwd -P)
prefix="studio-entrypoint-$$-${RANDOM}"
bind_container="${prefix}-bind"
user_container="${prefix}-user"
outside_volume="${prefix}-outside"

cleanup() {
  status=$?
  trap - EXIT
  if [[ ${status} -ne 0 ]]; then
    docker logs "${bind_container}" 2>/dev/null || true
    docker logs "${user_container}" 2>/dev/null || true
  fi
  docker rm --force --volumes "${bind_container}" "${user_container}" >/dev/null 2>&1 || true
  # The fixture now belongs to container UIDs, so remove its contents as root.
  docker run --rm --pull=never --network=none --user 0:0 --entrypoint /bin/sh \
    --mount "type=bind,source=${fixture},target=/fixture" \
    "${image}" -ec '
      chmod u+rwx /fixture/data /fixture/data/nested /fixture/logs /fixture/user-data /fixture/user-logs 2>/dev/null || true
      rm -rf /fixture/data /fixture/logs /fixture/user-data /fixture/user-logs
    ' || true
  docker volume rm "${outside_volume}" >/dev/null 2>&1 || true
  rm -f "${fixture}/seed.db" "${fixture}/snapshot.db"
  rmdir "${fixture}" || true
  exit "${status}"
}
trap cleanup EXIT

wait_ready() {
  local container=$1 state
  for attempt in {1..45}; do
    state=$(docker inspect --format '{{.State.Status}} {{.State.Health.Status}}' "${container}")
    if [[ ${state} == 'running healthy' ]]; then
      docker exec "${container}" /app/studio -healthcheck http://127.0.0.1:7001/api-studio/health/ready
      return
    fi
    [[ ${state} == running* ]] || return 1
    sleep 1
  done
  return 1
}

assert_user() {
  # Inspect the actual Studio process, including when Docker's init is PID 1.
  # `docker exec id` would only report the image's default exec user (root).
  docker exec "$1" /bin/sh -ec '
    found=0
    for status in /proc/[0-9]*/status; do
      if grep -qs "^Name:[[:space:]]*studio$" "$status"; then
        awk -v uid="$1" -v gid="$2" '\''
          $1 == "Uid:" { for (i = 2; i <= NF; i++) if ($i != uid) exit 1; seen++ }
          $1 == "Gid:" { for (i = 2; i <= NF; i++) if ($i != gid) exit 1; seen++ }
          END { if (seen != 2) exit 1 }
        '\'' "$status"
        found=1
      fi
    done
    test "$found" = 1
  ' sh "$2" "$3"
}

stop_cleanly() {
  docker stop --timeout 10 "$1" >/dev/null
  test "$(docker inspect --format '{{.State.ExitCode}}' "$1")" != 137
}

assert_database_preserved() {
  docker run --rm --pull=never --network=none --user 0:0 --entrypoint /bin/cat \
    --mount "type=bind,source=${fixture}/data,target=/app/data,readonly" \
    "${image}" /app/data/studio.db > "${fixture}/snapshot.db"
  python3 - "${fixture}/snapshot.db" <<'PY'
import sqlite3
import sys

with sqlite3.connect(sys.argv[1]) as db:
    assert db.execute('SELECT value FROM entrypoint_fixture').fetchall() == [('preserved',)]
PY
}

expect_failure() {
  local output
  if output=$(docker run --rm --pull=never --network=none "$@" "${image}" 2>&1); then
    printf 'Expected permission failure, got success: %s\n' "${output}" >&2
    return 1
  fi
  printf '%s\n' "${output}" | grep -Fq 'Studio entrypoint:'
  printf '%s\n' "${output}" | grep -Fq '/app/data'
  printf '%s\n' "${output}"
}

python3 - "${fixture}/seed.db" <<'PY'
import sqlite3
import sys

with sqlite3.connect(sys.argv[1]) as db:
    db.execute('CREATE TABLE entrypoint_fixture (value TEXT NOT NULL)')
    db.execute("INSERT INTO entrypoint_fixture VALUES ('preserved')")
PY

docker volume create "${outside_volume}" >/dev/null
docker run --rm --pull=never --network=none --user 0:0 --entrypoint /bin/sh \
  --mount "type=bind,source=${fixture},target=/fixture" \
  --mount "type=volume,source=${outside_volume},target=/outside" \
  "${image}" -ec '
    mkdir -p /fixture/data/nested /fixture/logs /fixture/user-data /fixture/user-logs
    printf preserved > /fixture/data/nested/marker
    cp /fixture/seed.db /fixture/data/studio.db
    printf outside > /outside/marker
    chmod 0400 /fixture/data/studio.db /fixture/data/nested/marker /outside/marker
    chmod 0700 /fixture/data /fixture/logs
    chmod 0700 /fixture/data/nested
    ln -s /outside /fixture/data/external-directory
    ln -s /outside/marker /fixture/data/external-file
    chown -R --no-dereference 0:0 /fixture/data /fixture/logs /outside
    chown 12345:23456 /fixture/user-data /fixture/user-logs
  '

echo 'Testing root-owned bind mounts, existing files, symlinks, and non-root Studio with --init'
docker run --detach --pull=never --network=none --init --read-only \
  --name "${bind_container}" \
  --mount "type=bind,source=${fixture}/data,target=/app/data" \
  --mount "type=bind,source=${fixture}/logs,target=/app/logs" \
  --mount "type=volume,source=${outside_volume},target=/outside,readonly" \
  --health-interval 1s --health-start-period 1s --health-timeout 2s --health-retries 30 \
  "${image}" >/dev/null
wait_ready "${bind_container}"
assert_user "${bind_container}" 10001 10001
docker exec --user 10001:10001 "${bind_container}" /bin/sh -ec '
  test "$(cat /app/data/nested/marker)" = preserved
  test -w /app/data/nested/marker
  test -w /app/data/studio.db
  test -s /app/data/studio.db
  test -w /app/logs
  test -L /app/data/external-directory
  test -L /app/data/external-file
'
docker exec "${bind_container}" /bin/sh -ec '
  test "$(stat -c %u:%g:%a /outside/marker)" = 0:0:400
  test "$(cat /outside/marker)" = outside
'
stop_cleanly "${bind_container}"
assert_database_preserved

echo 'Testing permission repair and preservation of an existing SQLite database on restart'
docker run --rm --pull=never --network=none --user 0:0 --entrypoint /bin/sh \
  --mount "type=bind,source=${fixture}/data,target=/app/data" \
  "${image}" -ec 'chown 0:0 /app/data /app/data/studio.db; chmod 0000 /app/data/studio.db'
docker start "${bind_container}" >/dev/null
wait_ready "${bind_container}"
assert_user "${bind_container}" 10001 10001
docker exec --user 10001:10001 "${bind_container}" /bin/sh -ec '
  test -s /app/data/studio.db
  test "$(cat /app/data/nested/marker)" = preserved
'
stop_cleanly "${bind_container}"
assert_database_preserved

echo 'Testing an explicitly configured UID/GID'
docker run --detach --pull=never --network=none --user 12345:23456 \
  --name "${user_container}" \
  --mount "type=bind,source=${fixture}/user-data,target=/app/data" \
  --mount "type=bind,source=${fixture}/user-logs,target=/app/logs" \
  --health-interval 1s --health-start-period 1s --health-timeout 2s --health-retries 30 \
  "${image}" >/dev/null
wait_ready "${user_container}"
assert_user "${user_container}" 12345 23456
stop_cleanly "${user_container}"

echo 'Testing clear errors for read-only mounts and an unprepared --user directory'
expect_failure \
  --mount "type=bind,source=${fixture}/data,target=/app/data,readonly" \
  --mount "type=bind,source=${fixture}/logs,target=/app/logs"
expect_failure --user 12345:23456 \
  --tmpfs /app/data:rw,uid=0,gid=0,mode=0700 \
  --tmpfs /app/logs:rw,uid=0,gid=0,mode=0700
expect_failure --cap-drop CHOWN \
  --tmpfs /app/data:rw,uid=0,gid=0,mode=0700 \
  --tmpfs /app/logs:rw,uid=0,gid=0,mode=0700

echo 'Testing version queries without writable data or log directories'
docker run --rm --pull=never --network=none \
  --tmpfs /app/data:rw,uid=0,gid=0,mode=0700 \
  --tmpfs /app/logs:rw,uid=0,gid=0,mode=0700 \
  "${image}" -v

echo 'Docker entrypoint checks passed.'
