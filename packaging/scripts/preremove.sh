#!/bin/sh
set -eu

action=${1:-remove}
preserve_dir=/var/lib/nebula-studio-package
preserved=${preserve_dir}/config.yaml

prepare_preserve_dir() {
    if [ -e "${preserve_dir}" ] || [ -L "${preserve_dir}" ]; then
        [ ! -L "${preserve_dir}" ] && [ -d "${preserve_dir}" ] \
            || { echo "Unsafe package state directory: ${preserve_dir}" >&2; exit 1; }
        [ "$(stat -c '%u:%a' "${preserve_dir}")" = 0:700 ] \
            || { echo "Unsafe ownership or permissions on ${preserve_dir}" >&2; exit 1; }
    else
        install -d -m 0700 -o root -g root "${preserve_dir}"
    fi
}

case "${action}" in
    0 | remove)
        if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
            systemctl stop nebula-studio.service >/dev/null 2>&1 || true
            systemctl disable nebula-studio.service >/dev/null 2>&1 || true
        fi
        if [ -f /etc/nebula-studio/config.yaml ]; then
            prepare_preserve_dir
            umask 077
            temporary=$(mktemp "${preserve_dir}/.config.XXXXXX")
            trap 'rm -f -- "${temporary}"' EXIT HUP INT TERM
            install -m 0600 -o root -g root /etc/nebula-studio/config.yaml "${temporary}"
            mv -f -- "${temporary}" "${preserved}"
            trap - EXIT HUP INT TERM
        fi
        ;;
esac
