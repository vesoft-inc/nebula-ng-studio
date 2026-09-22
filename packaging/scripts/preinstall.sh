#!/bin/sh
set -eu

service_name=nebula-studio.service
service_user=nebula-studio
service_group=nebula-studio
state_file=/run/nebula-studio-package-state

systemd_running() {
    command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]
}

existing_user=$(getent passwd "${service_user}" || true)

if getent group "${service_group}" >/dev/null 2>&1; then
    group_entry=$(getent group "${service_group}")
    group_gid=$(printf '%s\n' "${group_entry}" | cut -d: -f3)
    gid_min=$(awk '$1 == "GID_MIN" { print $2; exit }' /etc/login.defs 2>/dev/null || true)
    gid_min=${gid_min:-1000}
    if [ -z "${group_entry}" ] || [ "${group_gid}" -le 0 ] || [ "${group_gid}" -ge "${gid_min}" ]; then
        echo "Existing ${service_group} group is not a system service group." >&2
        exit 1
    fi
else
    if [ -n "${existing_user}" ]; then
        echo "Existing ${service_user} account has no matching ${service_group} group." >&2
        exit 1
    fi
    groupadd --system "${service_group}"
fi

if [ -n "${existing_user}" ]; then
    passwd_entry=${existing_user}
    user_uid=$(printf '%s\n' "${passwd_entry}" | cut -d: -f3)
    user_gid=$(printf '%s\n' "${passwd_entry}" | cut -d: -f4)
    user_home=$(printf '%s\n' "${passwd_entry}" | cut -d: -f6)
    user_shell=$(printf '%s\n' "${passwd_entry}" | cut -d: -f7)
    expected_gid=$(getent group "${service_group}" | cut -d: -f3)
    uid_min=$(awk '$1 == "UID_MIN" { print $2; exit }' /etc/login.defs 2>/dev/null || true)
    uid_min=${uid_min:-1000}
    case "${user_shell}" in
        /usr/sbin/nologin | /sbin/nologin | /bin/false) ;;
        *)
            echo "Existing ${service_user} account is not the required system service account." >&2
            exit 1
            ;;
    esac
    if [ "${user_uid}" -le 0 ] || [ "${user_uid}" -ge "${uid_min}" ] \
        || [ "${user_gid}" != "${expected_gid}" ] \
        || [ "${user_home}" != /var/lib/nebula-studio ]; then
        echo "Existing ${service_user} account is not the required system service account." >&2
        exit 1
    fi
else
    nologin=/usr/sbin/nologin
    [ -x "${nologin}" ] || nologin=/sbin/nologin
    [ -x "${nologin}" ] || nologin=/bin/false
    useradd --system --gid "${service_group}" --home-dir /var/lib/nebula-studio \
        --shell "${nologin}" --no-create-home "${service_user}"
fi

install -d -m 0750 -o "${service_user}" -g "${service_group}" /var/lib/nebula-studio /var/log/nebula-studio
install -d -m 0750 -o root -g "${service_group}" /etc/nebula-studio

if systemd_running; then
    if systemctl cat "${service_name}" >/dev/null 2>&1; then
        service_state=$(systemctl is-enabled "${service_name}" 2>/dev/null || true)
        case "${service_state}" in
            enabled | enabled-runtime | masked | masked-runtime) ;;
            *) service_state=disabled ;;
        esac
        umask 077
        printf '%s\n' "${service_state}" > "${state_file}"
        chown root:root "${state_file}"
        if systemctl is-active --quiet "${service_name}"; then
            systemctl stop "${service_name}"
            if systemctl is-active --quiet "${service_name}"; then
                echo "Failed to stop ${service_name}; refusing to replace a running binary." >&2
                exit 1
            fi
        fi
    else
        rm -f "${state_file}"
    fi
fi
