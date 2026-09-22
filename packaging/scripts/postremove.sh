#!/bin/sh
set -eu

action=${1:-remove}
preserve_dir=/var/lib/nebula-studio-package
preserved=${preserve_dir}/config.yaml

validate_preserve_dir() {
    [ ! -L "${preserve_dir}" ] && [ -d "${preserve_dir}" ] \
        || { echo "Unsafe package state directory: ${preserve_dir}" >&2; exit 1; }
    [ "$(stat -c '%u:%a' "${preserve_dir}")" = 0:700 ] \
        || { echo "Unsafe ownership or permissions on ${preserve_dir}" >&2; exit 1; }
}

validate_preserved_config() {
    [ ! -L "${preserved}" ] && [ -f "${preserved}" ] \
        || { echo "Unsafe preserved configuration: ${preserved}" >&2; exit 1; }
    [ "$(stat -c '%u:%a' "${preserved}")" = 0:600 ] \
        || { echo "Unsafe ownership or permissions on ${preserved}" >&2; exit 1; }
}

case "${action}" in
    purge)
        if [ -e "${preserve_dir}" ] || [ -L "${preserve_dir}" ]; then
            validate_preserve_dir
            if [ -e "${preserved}" ] || [ -L "${preserved}" ]; then
                validate_preserved_config
            fi
        fi
        rm -f /etc/nebula-studio/config.yaml
        if [ -d "${preserve_dir}" ]; then
            rm -f "${preserved}"
            rmdir "${preserve_dir}" 2>/dev/null || true
        fi
        ;;
    0 | remove)
        if [ -e "${preserve_dir}" ] || [ -L "${preserve_dir}" ]; then
            validate_preserve_dir
            if [ -e "${preserved}" ] || [ -L "${preserved}" ]; then
                validate_preserved_config
                if [ ! -f /etc/nebula-studio/config.yaml ]; then
                    install -d -m 0750 -o root -g nebula-studio /etc/nebula-studio
                    temporary=$(mktemp /etc/nebula-studio/.config.XXXXXX)
                    trap 'rm -f -- "${temporary}"' EXIT HUP INT TERM
                    install -m 0640 -o root -g nebula-studio "${preserved}" "${temporary}"
                    mv -f -- "${temporary}" /etc/nebula-studio/config.yaml
                    trap - EXIT HUP INT TERM
                fi
                rm -f "${preserved}"
            fi
            rmdir "${preserve_dir}" 2>/dev/null || true
        fi
        ;;
esac

if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl daemon-reload
fi
