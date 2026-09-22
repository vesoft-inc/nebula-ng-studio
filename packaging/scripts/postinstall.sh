#!/bin/sh
set -eu

service_name=nebula-studio.service
state_file=/run/nebula-studio-package-state

systemd_running() {
    command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]
}

chown root:nebula-studio /etc/nebula-studio/config.yaml
chmod 0640 /etc/nebula-studio/config.yaml

if systemd_running; then
    systemctl daemon-reload
    systemctl stop "${service_name}" >/dev/null 2>&1 || true
    if [ -f "${state_file}" ]; then
        service_state=$(cat "${state_file}")
        case "${service_state}" in
            enabled | enabled-runtime)
                systemctl unmask "${service_name}" >/dev/null 2>&1 || true
                systemctl enable "${service_name}" >/dev/null
                ;;
            masked | masked-runtime)
                systemctl disable "${service_name}" >/dev/null 2>&1 || true
                systemctl mask "${service_name}" >/dev/null
                ;;
            *)
                systemctl disable "${service_name}" >/dev/null 2>&1 || true
                ;;
        esac
        rm -f "${state_file}"
    else
        systemctl disable "${service_name}" >/dev/null 2>&1 || true
    fi
    if systemctl is-active --quiet "${service_name}"; then
        echo "Failed to keep ${service_name} stopped after installation." >&2
        exit 1
    fi
fi

echo "NebulaGraph Studio is installed and stopped. Start it with: systemctl start ${service_name}"
