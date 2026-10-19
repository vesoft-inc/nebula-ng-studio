#!/bin/sh
set -eu

fail() {
    printf 'Studio entrypoint: %s\n' "$*" >&2
    exit 1
}

initialize_directory() {
    directory=$1
    [ ! -L "$directory" ] || fail "$directory must be a directory, not a symbolic link"
    mkdir -p "$directory" || fail "cannot create $directory"

    # Stay on this filesystem and do not follow symlinks to unrelated host files.
    # Change only mismatched entries so repeated starts avoid metadata writes.
    if ! find -P "$directory" -xdev \( -type d -o -type f \) \
        \( ! -uid 10001 -o ! -gid 10001 \) \
        -exec chown --no-dereference 10001:10001 -- '{}' + \
        || ! find -P "$directory" -xdev -type d ! -perm -0700 \
            -exec chmod u+rwx -- '{}' + \
        || ! find -P "$directory" -xdev -type f ! -perm -0600 \
            -exec chmod u+rw -- '{}' +; then
        fail "cannot initialize $directory for UID/GID 10001:10001; check that the mount is writable and supports ownership changes"
    fi
}

initialize=true
for argument do
    case "$argument" in
        -v | --v | -v=true | --v=true | -h | --help | -help | --healthcheck | --healthcheck=* | -healthcheck | -healthcheck=*)
            initialize=false
            ;;
    esac
done

if [ "$(id -u)" = 0 ]; then
    if [ "$initialize" = true ]; then
        initialize_directory /app/data
        initialize_directory /app/logs
    fi
    # Re-enter as the final user so permission checks also honor read-only mounts.
    exec setpriv --reuid=10001 --regid=10001 --init-groups "$0" "$@"
fi

if [ "$initialize" = true ]; then
    for directory in /app/data /app/logs; do
        if [ ! -d "$directory" ] || [ ! -w "$directory" ] || [ ! -x "$directory" ]; then
            fail "$directory is not writable/searchable by UID/GID $(id -u):$(id -g); when using --user, prepare the mounted directory permissions before startup"
        fi
    done
fi

exec /app/studio "$@"
