#!/usr/bin/env bash

set -euo pipefail

readonly LEGACY_PACKAGE=nebula-graph-studio
readonly NEW_PACKAGE=nebula-studio
readonly LEGACY_SERVICE=nebula-graph-studio.service
readonly NEW_SERVICE=nebula-studio.service
readonly NEW_USER=nebula-studio
readonly NEW_GROUP=nebula-studio
readonly DEFAULT_LEGACY_ROOT=/usr/local/nebula-graph-studio
readonly NEW_CONFIG=/etc/nebula-studio/config.yaml
readonly NEW_DATA=/var/lib/nebula-studio/studio.db
readonly STATE_DIR=/var/lib/nebula-studio-migration
readonly STATE_FILE=${STATE_DIR}/state

COMMAND=
PACKAGE_FILE=
CHECKSUM_FILE=
LEGACY_ROOT=${DEFAULT_LEGACY_ROOT}
MYSQL_BACKUP_CONFIRMED=false
HELPER=
TEMP_HELPER=
EXTRACT_DIR=
PACKAGE_KIND=
PACKAGE_ARCH=
PACKAGE_VERSION=
PACKAGE_SHA256=
PACKAGE_SIZE_KIB=
PACKAGE_CONFIG_SHA256=
CONFIG_FILE=
DATABASE_ENABLE=
DATABASE_DIALECT=
SQLITE_PATH=
LOG_PATH=
BACKUP_DIR=
PHASE=
LEGACY_SERVICE_STATE=disabled
LEGACY_UNIT_PATH=
LOCK_FILE=${STATE_DIR}/lock

cleanup() {
    if [[ -n ${TEMP_HELPER} ]]; then
        rm -f -- "${TEMP_HELPER}"
    fi
    if [[ -n ${EXTRACT_DIR} ]]; then
        rm -rf -- "${EXTRACT_DIR}"
    fi
}

trap cleanup EXIT

usage() {
    cat <<'EOF'
Usage:
  migrate-nebula-graph-studio.sh check --package <new.deb|new.rpm> --checksum <file> [options]
  migrate-nebula-graph-studio.sh migrate --package <new.deb|new.rpm> --checksum <file> [options]
  migrate-nebula-graph-studio.sh verify

Options:
  --source-root <path>          Existing installation root (default: /usr/local/nebula-graph-studio)
  --mysql-backup-confirmed      Confirm that an external MySQL backup is complete
EOF
}

fail() {
    echo "Migration error: $*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "required command '$1' is unavailable"
}

systemd_running() {
    command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]
}

prepare_state_dir() {
    if [[ -e ${STATE_DIR} || -L ${STATE_DIR} ]]; then
        [[ ! -L ${STATE_DIR} && -d ${STATE_DIR} ]] \
            || fail "migration state directory ${STATE_DIR} is unsafe"
        [[ $(stat -c '%u:%a' "${STATE_DIR}") == 0:700 ]] \
            || fail "migration state directory ${STATE_DIR} must be owned by root with mode 0700"
    else
        install -d -m 0700 -o root -g root "${STATE_DIR}"
    fi
}

acquire_lock() {
    require_command flock
    prepare_state_dir
    exec 9>"${LOCK_FILE}"
    chmod 0600 "${LOCK_FILE}"
    flock -n 9 || fail "another Studio migration process is running"
}

systemctl_property() {
    local unit=$1 property=$2 output
    output=$(systemctl show "${unit}" "--property=${property}" 2>/dev/null) \
        || fail "cannot inspect ${property} for ${unit}"
    # Some systemd releases omit an unset or unavailable property instead of
    # printing "Property=". Callers still validate mandatory values such as
    # FragmentPath, while optional collection properties remain empty.
    [[ -z ${output} ]] && return
    [[ ${output} == "${property}="* ]] \
        || fail "systemctl returned an invalid ${property} value for ${unit}"
    printf '%s\n' "${output#*=}"
}

write_state() {
    [[ -x ${HELPER} ]] || fail "migration helper is unavailable while writing state"
    {
        printf 'PACKAGE_FILE=%q\n' "${PACKAGE_FILE}"
        printf 'PACKAGE_KIND=%q\n' "${PACKAGE_KIND}"
        printf 'PACKAGE_ARCH=%q\n' "${PACKAGE_ARCH}"
        printf 'PACKAGE_VERSION=%q\n' "${PACKAGE_VERSION}"
        printf 'PACKAGE_SHA256=%q\n' "${PACKAGE_SHA256}"
        printf 'PACKAGE_CONFIG_SHA256=%q\n' "${PACKAGE_CONFIG_SHA256}"
        printf 'LEGACY_ROOT=%q\n' "${LEGACY_ROOT}"
        printf 'BACKUP_DIR=%q\n' "${BACKUP_DIR}"
        printf 'LEGACY_SERVICE_STATE=%q\n' "${LEGACY_SERVICE_STATE}"
        printf 'LEGACY_UNIT_PATH=%q\n' "${LEGACY_UNIT_PATH}"
        printf 'DATABASE_ENABLE=%q\n' "${DATABASE_ENABLE}"
        printf 'DATABASE_DIALECT=%q\n' "${DATABASE_DIALECT}"
        printf 'CONFIG_FILE=%q\n' "${CONFIG_FILE}"
        printf 'SQLITE_PATH=%q\n' "${SQLITE_PATH}"
        printf 'LOG_PATH=%q\n' "${LOG_PATH}"
        printf 'PHASE=%q\n' "${PHASE}"
    } | "${HELPER}" write-state --path "${STATE_FILE}"
}

load_state() {
    [[ -f ${STATE_FILE} ]] || fail "migration state ${STATE_FILE} does not exist"
    [[ ! -L ${STATE_FILE} ]] || fail "migration state must not be a symbolic link"
    [[ $(stat -c '%u:%a' "${STATE_FILE}") == 0:600 ]] || fail "migration state has unsafe ownership or permissions"
    local line key
    declare -A seen=()
    while IFS= read -r line || [[ -n ${line} ]]; do
        [[ ${line} =~ ^([A-Z][A-Z0-9_]*)= ]] || fail "migration state contains a malformed line"
        key=${BASH_REMATCH[1]}
        case "${key}" in
            PACKAGE_FILE | PACKAGE_KIND | PACKAGE_ARCH | PACKAGE_VERSION | PACKAGE_SHA256 | PACKAGE_CONFIG_SHA256 | \
                LEGACY_ROOT | BACKUP_DIR | LEGACY_SERVICE_STATE | LEGACY_UNIT_PATH | DATABASE_ENABLE | DATABASE_DIALECT | \
                CONFIG_FILE | SQLITE_PATH | LOG_PATH | PHASE) ;;
            *) fail "migration state contains an unknown field ${key}" ;;
        esac
        [[ -z ${seen[${key}]:-} ]] || fail "migration state contains duplicate field ${key}"
        seen[${key}]=1
    done < "${STATE_FILE}"
    for key in PACKAGE_FILE PACKAGE_KIND PACKAGE_ARCH PACKAGE_VERSION PACKAGE_SHA256 PACKAGE_CONFIG_SHA256 \
        LEGACY_ROOT BACKUP_DIR LEGACY_SERVICE_STATE LEGACY_UNIT_PATH DATABASE_ENABLE DATABASE_DIALECT CONFIG_FILE SQLITE_PATH LOG_PATH PHASE; do
        [[ -n ${seen[${key}]:-} ]] || fail "migration state is missing ${key}"
    done
    # The root-owned state is written exclusively by write_state with shell quoting.
    # shellcheck disable=SC1090
    source "${STATE_FILE}"
    [[ ${PACKAGE_SHA256} =~ ^[0-9a-f]{64}$ ]] || fail "migration state has an invalid package checksum"
    [[ -z ${PACKAGE_CONFIG_SHA256} || ${PACKAGE_CONFIG_SHA256} =~ ^[0-9a-f]{64}$ ]] \
        || fail "migration state has an invalid package config checksum"
    [[ ${PACKAGE_FILE} == /* && ${LEGACY_ROOT} == /* \
        && ${BACKUP_DIR} =~ ^/var/backups/nebula-studio/legacy-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{12}$ ]] \
        || fail "migration state contains unsafe paths"
    case "${PACKAGE_KIND}:${PACKAGE_ARCH}" in
        deb:amd64 | deb:arm64 | rpm:x86_64 | rpm:aarch64) ;;
        *) fail "migration state has invalid package metadata" ;;
    esac
    [[ -n ${PACKAGE_VERSION} && ${PACKAGE_VERSION} != *$'\n'* ]] \
        || fail "migration state has an invalid package version"
    case "${LEGACY_SERVICE_STATE}" in
        enabled | enabled-runtime | disabled | masked | masked-runtime) ;;
        *) fail "migration state has an invalid previous service state" ;;
    esac
    case "${LEGACY_UNIT_PATH}" in
        "/usr/lib/systemd/system/${LEGACY_SERVICE}" | "/lib/systemd/system/${LEGACY_SERVICE}") ;;
        *) fail "migration state has an invalid previous service unit path" ;;
    esac
    [[ ${DATABASE_ENABLE} == true || ${DATABASE_ENABLE} == false ]] \
        || fail "migration state has an invalid database enabled value"
    if [[ ${DATABASE_ENABLE} == true ]]; then
        [[ ${DATABASE_DIALECT} == sqlite3 || ${DATABASE_DIALECT} == mysql ]] \
            || fail "migration state has an invalid database dialect"
    else
        [[ -z ${DATABASE_DIALECT} || ${DATABASE_DIALECT} == sqlite3 || ${DATABASE_DIALECT} == mysql ]] \
            || fail "migration state has an invalid database dialect"
    fi
    [[ ${LOG_PATH} == logs || ${LOG_PATH} == ./logs ]] \
        || fail "migration state has an invalid log path"
    [[ ${CONFIG_FILE} == "${LEGACY_ROOT}/etc/config.yaml" ]] || fail "migration state contains an unexpected config path"
    if [[ ${DATABASE_ENABLE} == true && ${DATABASE_DIALECT} == sqlite3 ]]; then
        [[ ${SQLITE_PATH} == "${LEGACY_ROOT}/data/studio.db" ]] || fail "migration state contains an unexpected SQLite path"
    fi
    case "${PHASE}" in
        preflight_complete | service_stopped | backed_up | legacy_removed | new_installed | deployed | verified) ;;
        *) fail "migration state has an invalid phase ${PHASE}" ;;
    esac
    case "${PHASE}" in
        new_installed | deployed | verified)
            [[ ${PACKAGE_CONFIG_SHA256} =~ ^[0-9a-f]{64}$ ]] || fail "migration state has an invalid package config checksum"
            ;;
    esac
}

parse_arguments() {
    [[ $# -ge 1 ]] || { usage >&2; exit 2; }
    COMMAND=$1
    shift
    case "${COMMAND}" in
        check | migrate | verify) ;;
        *) usage >&2; exit 2 ;;
    esac
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --package)
                [[ $# -ge 2 ]] || fail "--package requires a value"
                PACKAGE_FILE=$2
                shift 2
                ;;
            --checksum)
                [[ $# -ge 2 ]] || fail "--checksum requires a value"
                CHECKSUM_FILE=$2
                shift 2
                ;;
            --source-root)
                [[ $# -ge 2 ]] || fail "--source-root requires a value"
                LEGACY_ROOT=$2
                shift 2
                ;;
            --mysql-backup-confirmed)
                MYSQL_BACKUP_CONFIRMED=true
                shift
                ;;
            *) fail "unknown argument '$1'" ;;
        esac
    done
}

verify_checksum() {
    [[ -f ${PACKAGE_FILE} ]] || fail "package ${PACKAGE_FILE} does not exist"
    [[ -f ${CHECKSUM_FILE} ]] || fail "checksum ${CHECKSUM_FILE} does not exist"
    local expected actual package_name
    package_name=$(basename "${PACKAGE_FILE}")
    expected=$(awk -v name="${package_name}" '$2 == name || $2 == "*" name { print $1 }' "${CHECKSUM_FILE}")
    [[ ${expected} =~ ^[0-9a-fA-F]{64}$ ]] || fail "checksum file does not contain exactly one entry for ${package_name}"
    actual=$(sha256sum "${PACKAGE_FILE}" | awk '{print $1}')
    [[ ${actual,,} == "${expected,,}" ]] || fail "checksum mismatch for ${package_name}"
    PACKAGE_SHA256=${actual,,}
}

extract_rpm_member() {
    local member=$1 output=$2
    rpm2cpio "${PACKAGE_FILE}" | cpio -i --quiet --to-stdout "${member}" > "${output}"
    [[ -s ${output} ]]
}

payload_path_is_present() {
    local path=${1#/}
    grep -Fqx "${path}" "${EXTRACT_DIR}/payload.list" \
        || grep -Fqx "./${path}" "${EXTRACT_DIR}/payload.list" \
        || grep -Fqx "/${path}" "${EXTRACT_DIR}/payload.list"
}

payload_tree_is_present() {
    local path=${1#/}
    grep -Eq "^(\\./|/)?${path}/.+" "${EXTRACT_DIR}/payload.list"
}

validate_deb_package() {
    local field control_script depends
    for field in Version Architecture Installed-Size Maintainer Description; do
        [[ -n $(dpkg-deb -f "${PACKAGE_FILE}" "${field}") ]] \
            || fail "DEB package metadata is missing ${field}"
    done
    depends=$(dpkg-deb -f "${PACKAGE_FILE}" Depends)
    grep -Eq '(^|,[[:space:]]*)libc6[[:space:]]*\(>=[[:space:]]*2\.17\)($|,)' <<< "${depends}" \
        || fail "DEB package does not declare libc6 >= 2.17"
    for field in ca-certificates systemd; do
        grep -Eq "(^|,[[:space:]]*)${field}([[:space:]]*\\([^)]*\\))?($|,)" <<< "${depends}" \
            || fail "DEB package does not declare ${field}"
    done

    dpkg-deb --fsys-tarfile "${PACKAGE_FILE}" | tar -tf - > "${EXTRACT_DIR}/payload.list"
    dpkg-deb --ctrl-tarfile "${PACKAGE_FILE}" | tar -tf - > "${EXTRACT_DIR}/control.list"
    for control_script in preinst postinst prerm postrm; do
        grep -Eq "^(\\./)?${control_script}$" "${EXTRACT_DIR}/control.list" \
            || fail "DEB package is missing the ${control_script} maintainer script"
    done
}

validate_rpm_package() {
    local field scripts requirements
    for field in VERSION RELEASE ARCH SIZE SUMMARY LICENSE; do
        [[ -n $(rpm -qp --queryformat "%{${field}}" "${PACKAGE_FILE}") ]] \
            || fail "RPM package metadata is missing ${field}"
    done
    requirements=$(rpm -qp --requires "${PACKAGE_FILE}") \
        || fail "cannot inspect RPM package dependencies"
    grep -Eq '^glibc[[:space:]]*>=[[:space:]]*2\.17$' <<< "${requirements}" \
        || fail "RPM package does not declare glibc >= 2.17"
    for field in ca-certificates systemd; do
        grep -Eq "^${field}([[:space:]]|$)" <<< "${requirements}" \
            || fail "RPM package does not declare ${field}"
    done

    rpm -qpl "${PACKAGE_FILE}" > "${EXTRACT_DIR}/payload.list" \
        || fail "cannot inspect RPM package contents"
    scripts=$(rpm -qp --scripts "${PACKAGE_FILE}") \
        || fail "cannot inspect RPM package maintainer scripts"
    for field in preinstall postinstall preuninstall postuninstall; do
        grep -Eq "^${field} scriptlet" <<< "${scripts}" \
            || fail "RPM package is missing the ${field} scriptlet"
    done
}

validate_package_payload() {
    local path
    for path in \
        /usr/lib/nebula-studio/bin/studio \
        /usr/lib/nebula-studio/bin/studio-migrate-helper \
        /etc/nebula-studio/config.yaml \
        /usr/share/doc/nebula-studio/README.md \
        /usr/share/doc/nebula-studio/LICENSE; do
        payload_path_is_present "${path}" || fail "package is missing ${path}"
    done
    payload_tree_is_present /usr/lib/nebula-studio/assets/public \
        || fail "package does not contain Studio frontend assets"
    if [[ ${PACKAGE_KIND} == deb ]]; then
        payload_path_is_present /lib/systemd/system/nebula-studio.service \
            || fail "DEB package is missing the systemd service"
    else
        payload_path_is_present /usr/lib/systemd/system/nebula-studio.service \
            || fail "RPM package is missing the systemd service"
    fi
}

extract_helper() {
    local rpm_size
    EXTRACT_DIR=$(mktemp -d)
    case "${PACKAGE_FILE}" in
        *.deb)
            require_command dpkg-deb
            PACKAGE_KIND=deb
            [[ $(dpkg-deb -f "${PACKAGE_FILE}" Package) == "${NEW_PACKAGE}" ]] || fail "DEB package name must be ${NEW_PACKAGE}"
            PACKAGE_ARCH=$(dpkg-deb -f "${PACKAGE_FILE}" Architecture)
            PACKAGE_VERSION=$(dpkg-deb -f "${PACKAGE_FILE}" Version)
            PACKAGE_SIZE_KIB=$(dpkg-deb -f "${PACKAGE_FILE}" Installed-Size)
            [[ ${PACKAGE_SIZE_KIB} =~ ^[0-9]+$ ]] || fail "DEB Installed-Size is invalid"
            validate_deb_package
            dpkg-deb --fsys-tarfile "${PACKAGE_FILE}" \
                | tar -xOf - ./usr/lib/nebula-studio/bin/studio-migrate-helper > "${EXTRACT_DIR}/studio-migrate-helper"
            ;;
        *.rpm)
            require_command rpm
            require_command rpm2cpio
            require_command cpio
            PACKAGE_KIND=rpm
            [[ $(rpm -qp --queryformat '%{NAME}' "${PACKAGE_FILE}") == "${NEW_PACKAGE}" ]] || fail "RPM package name must be ${NEW_PACKAGE}"
            PACKAGE_ARCH=$(rpm -qp --queryformat '%{ARCH}' "${PACKAGE_FILE}")
            PACKAGE_VERSION=$(rpm -qp --queryformat '%{VERSION}-%{RELEASE}' "${PACKAGE_FILE}")
            rpm_size=$(rpm -qp --queryformat '%{SIZE}' "${PACKAGE_FILE}")
            [[ ${rpm_size} =~ ^[0-9]+$ ]] || fail "RPM size metadata is invalid"
            PACKAGE_SIZE_KIB=$(( (rpm_size + 1023) / 1024 ))
            validate_rpm_package
            extract_rpm_member ./usr/lib/nebula-studio/bin/studio-migrate-helper "${EXTRACT_DIR}/studio-migrate-helper" \
                || extract_rpm_member usr/lib/nebula-studio/bin/studio-migrate-helper "${EXTRACT_DIR}/studio-migrate-helper" \
                || extract_rpm_member /usr/lib/nebula-studio/bin/studio-migrate-helper "${EXTRACT_DIR}/studio-migrate-helper" \
                || fail "RPM does not contain the Studio migration helper"
            ;;
        *) fail "package must end in .deb or .rpm" ;;
    esac
    validate_package_payload
    [[ -s ${EXTRACT_DIR}/studio-migrate-helper ]] || fail "package contains an empty Studio migration helper"
    chmod 0700 "${EXTRACT_DIR}/studio-migrate-helper"
    HELPER=$(mktemp /tmp/studio-migrate-helper.XXXXXX)
    TEMP_HELPER=${HELPER}
    install -m 0700 "${EXTRACT_DIR}/studio-migrate-helper" "${HELPER}"
    rm -rf -- "${EXTRACT_DIR}"
    EXTRACT_DIR=
}

validate_deb_database_and_dependencies() {
    local audit_output package status version
    audit_output=$(dpkg --audit 2>&1) || fail "dpkg database health check failed: ${audit_output}"
    [[ -z ${audit_output} ]] || fail "dpkg database has unfinished package operations: ${audit_output}"
    for package in libc6 ca-certificates systemd; do
        status=$(dpkg-query -W -f='${db:Status-Status}' "${package}" 2>/dev/null || true)
        [[ ${status} == installed ]] || fail "required runtime dependency ${package} is not installed"
    done
    version=$(dpkg-query -W -f='${Version}' libc6)
    dpkg --compare-versions "${version}" ge 2.17 \
        || fail "installed libc6 ${version} does not satisfy >= 2.17"
}

validate_rpm_database_and_dependencies() {
    rpm --verifydb >/dev/null || fail "RPM database health check failed"
    local comparison package version
    version=$(rpm -q --queryformat '%{VERSION}' glibc 2>/dev/null) \
        || fail "required runtime dependency glibc is not installed"
    [[ ${version} =~ ^[A-Za-z0-9._+~:-]+$ ]] || fail "installed glibc has an invalid version"
    comparison=$(rpm --eval "%{lua:print(rpm.vercmp(\"${version}\", \"2.17\"))}")
    [[ ${comparison} == 0 || ${comparison} == 1 ]] \
        || fail "installed glibc ${version} does not satisfy >= 2.17"
    for package in ca-certificates systemd; do
        rpm -q "${package}" >/dev/null 2>&1 || fail "required runtime dependency ${package} is not installed"
    done
}

validate_package_database_and_dependencies() {
    if [[ ${PACKAGE_KIND} == deb ]]; then
        validate_deb_database_and_dependencies
    else
        validate_rpm_database_and_dependencies
    fi
}

validate_service_account() {
    local group_entry group_gid gid_min passwd_entry user_uid user_gid user_home user_shell uid_min
    group_entry=$(getent group "${NEW_GROUP}" || true)
    passwd_entry=$(getent passwd "${NEW_USER}" || true)

    if [[ -n ${group_entry} ]]; then
        group_gid=$(cut -d: -f3 <<< "${group_entry}")
        gid_min=$(awk '$1 == "GID_MIN" { print $2; exit }' /etc/login.defs 2>/dev/null || true)
        gid_min=${gid_min:-1000}
        [[ ${group_gid} =~ ^[0-9]+$ && ${gid_min} =~ ^[0-9]+$ \
            && ${group_gid} -gt 0 && ${group_gid} -lt ${gid_min} ]] \
            || fail "existing ${NEW_GROUP} group is not a system service group"
    elif [[ -n ${passwd_entry} ]]; then
        fail "existing ${NEW_USER} account has no matching ${NEW_GROUP} group"
    else
        require_command groupadd
    fi

    if [[ -n ${passwd_entry} ]]; then
        user_uid=$(cut -d: -f3 <<< "${passwd_entry}")
        user_gid=$(cut -d: -f4 <<< "${passwd_entry}")
        user_home=$(cut -d: -f6 <<< "${passwd_entry}")
        user_shell=$(cut -d: -f7 <<< "${passwd_entry}")
        uid_min=$(awk '$1 == "UID_MIN" { print $2; exit }' /etc/login.defs 2>/dev/null || true)
        uid_min=${uid_min:-1000}
        case "${user_shell}" in
            /usr/sbin/nologin | /sbin/nologin | /bin/false) ;;
            *) fail "existing ${NEW_USER} account is not the required system service account" ;;
        esac
        [[ ${user_uid} =~ ^[0-9]+$ && ${user_gid} =~ ^[0-9]+$ && ${uid_min} =~ ^[0-9]+$ \
            && ${user_uid} -gt 0 && ${user_uid} -lt ${uid_min} \
            && ${user_gid} == "${group_gid}" && ${user_home} == /var/lib/nebula-studio ]] \
            || fail "existing ${NEW_USER} account is not the required system service account"
    else
        require_command useradd
    fi
}

validate_target_parents() {
    local path parent
    for path in /usr/lib /etc /var/lib /var/log /var/backups; do
        if [[ -e ${path} || -L ${path} ]]; then
            [[ ! -L ${path} && -d ${path} ]] || fail "target parent ${path} is unsafe"
        else
            parent=${path%/*}
            [[ ! -L ${parent} && -d ${parent} ]] || fail "target parent ${parent} is unsafe"
        fi
    done
}

validate_install_environment() {
    local command
    for command in awk chmod cut date df du getent grep install md5sum mktemp mv readlink realpath rm sha256sum stat systemctl tar; do
        require_command "${command}"
    done
    if [[ ${PACKAGE_KIND} == deb ]]; then
        for command in dpkg dpkg-deb dpkg-query; do
            require_command "${command}"
        done
    else
        for command in cpio rpm rpm2cpio; do
            require_command "${command}"
        done
    fi
    validate_package_database_and_dependencies
    validate_service_account
    validate_target_parents
}

validate_architecture() {
    local host_arch
    if [[ ${PACKAGE_KIND} == deb ]]; then
        require_command dpkg
        host_arch=$(dpkg --print-architecture)
        [[ ${PACKAGE_ARCH} == "${host_arch}" ]] || fail "package architecture ${PACKAGE_ARCH} does not match host ${host_arch}"
    else
        host_arch=$(rpm --eval '%{_arch}')
        [[ ${PACKAGE_ARCH} == "${host_arch}" ]] || fail "package architecture ${PACKAGE_ARCH} does not match host ${host_arch}"
    fi
}

validate_legacy_architecture() {
    local legacy_arch host_arch
    if [[ ${PACKAGE_KIND} == deb ]]; then
        legacy_arch=$(dpkg-query -W -f='${Architecture}' "${LEGACY_PACKAGE}")
        host_arch=$(dpkg --print-architecture)
        [[ ${legacy_arch} == "${host_arch}" ]] || fail \
            "installed package architecture ${legacy_arch} does not match host ${host_arch}; upgrade this installation manually without forcing an architecture"
    else
        legacy_arch=$(rpm -q --queryformat '%{ARCH}' "${LEGACY_PACKAGE}")
        host_arch=$(rpm --eval '%{_arch}')
        case "${legacy_arch}:${host_arch}" in
            x86_64:x86_64 | amd64:x86_64 | aarch64:aarch64) ;;
            *) fail "installed package architecture ${legacy_arch} does not match host ${host_arch}" ;;
        esac
    fi
}

check_legacy_wrapper() {
    local wrapper=${LEGACY_ROOT#/}/scripts/studio.service
    if [[ ${PACKAGE_KIND} == deb ]]; then
        require_command md5sum
        local sums=/var/lib/dpkg/info/${LEGACY_PACKAGE}.md5sums
        [[ -f ${sums} ]] || fail "installed package checksums are unavailable; upgrade manually"
        [[ -f /${wrapper} ]] || fail "existing service wrapper /${wrapper} is missing"
        local expected actual
        expected=$(awk -v path="${wrapper}" '$2 == path { print $1 }' "${sums}")
        [[ ${expected} =~ ^[0-9a-fA-F]{32}$ ]] || fail "existing service wrapper is missing from package metadata"
        actual=$(md5sum "/${wrapper}" | awk '{print $1}')
        [[ ${actual,,} == "${expected,,}" ]] \
            || fail "existing service wrapper was modified; custom startup configuration requires a manual upgrade"
    else
        local verification
        verification=$(rpm -V "${LEGACY_PACKAGE}" 2>&1 || true)
        if awk -v path="/${wrapper}" '$NF == path { found = 1 } END { exit !found }' <<< "${verification}"; then
            fail "existing service wrapper was modified; custom startup configuration requires a manual upgrade"
        fi
    fi
}

check_legacy_script_requirements() {
    local script scripts use_sudo=false
    if [[ ${PACKAGE_KIND} == deb ]]; then
        for script in \
            "/var/lib/dpkg/info/${LEGACY_PACKAGE}.prerm" \
            "/var/lib/dpkg/info/${LEGACY_PACKAGE}.postrm"; do
            if [[ -e ${script} || -L ${script} ]]; then
                [[ ! -L ${script} && -f ${script} ]] \
                    || fail "installed package maintenance script ${script} is unsafe"
                grep -Eq '(^|[[:space:]])sudo([[:space:]]|$)' "${script}" && use_sudo=true
            fi
        done
    else
        scripts=$(rpm -q --scripts "${LEGACY_PACKAGE}") \
            || fail "cannot inspect the installed RPM maintenance scripts"
        grep -Eq '(^|[[:space:]])sudo([[:space:]]|$)' <<< "${scripts}" && use_sudo=true
    fi
    if [[ ${use_sudo} == true ]]; then
        require_command sudo
    fi
}

legacy_package_installed() {
    if [[ ${PACKAGE_KIND} == deb ]]; then
        dpkg-query -W -f='${db:Status-Status}' "${LEGACY_PACKAGE}" 2>/dev/null | grep -Fqx installed
    else
        rpm -q "${LEGACY_PACKAGE}" >/dev/null 2>&1
    fi
}

new_package_installed() {
    if [[ ${PACKAGE_KIND} == deb ]]; then
        dpkg-query -W -f='${db:Status-Status}' "${NEW_PACKAGE}" 2>/dev/null | grep -Fqx installed
    else
        rpm -q "${NEW_PACKAGE}" >/dev/null 2>&1
    fi
}

new_package_matches() {
    new_package_installed || return 1
    if [[ ${PACKAGE_KIND} == deb ]]; then
        [[ $(dpkg-query -W -f='${Version}' "${NEW_PACKAGE}") == "${PACKAGE_VERSION}" \
            && $(dpkg-query -W -f='${Architecture}' "${NEW_PACKAGE}") == "${PACKAGE_ARCH}" ]]
    else
        [[ $(rpm -q --queryformat '%{VERSION}-%{RELEASE}' "${NEW_PACKAGE}") == "${PACKAGE_VERSION}" \
            && $(rpm -q --queryformat '%{ARCH}' "${NEW_PACKAGE}") == "${PACKAGE_ARCH}" ]]
    fi
}

inspect_legacy_config() {
    CONFIG_FILE=${LEGACY_ROOT}/etc/config.yaml
    [[ -f ${CONFIG_FILE} ]] || fail "existing configuration ${CONFIG_FILE} does not exist"
    [[ ! -L ${CONFIG_FILE} ]] || fail "a symlinked configuration requires a manual upgrade"
    DATABASE_ENABLE=$("${HELPER}" inspect-config --config "${CONFIG_FILE}" --field database.enable)
    DATABASE_DIALECT=$("${HELPER}" inspect-config --config "${CONFIG_FILE}" --field database.dialect)
    SQLITE_PATH=$("${HELPER}" inspect-config --config "${CONFIG_FILE}" --field database.sqliteFilePath)
    LOG_PATH=$("${HELPER}" inspect-config --config "${CONFIG_FILE}" --field log.path)

    case "${LOG_PATH}" in
        logs | ./logs) ;;
        *) fail "custom Log.Path '${LOG_PATH}' requires a manual upgrade" ;;
    esac
    if [[ ${DATABASE_ENABLE} == true ]]; then
        case "${DATABASE_DIALECT}" in
            sqlite3)
                case "${SQLITE_PATH}" in
                    data/studio.db | ./data/studio.db) SQLITE_PATH=${LEGACY_ROOT}/data/studio.db ;;
                    *) fail "custom SQLite path '${SQLITE_PATH}' requires a manual upgrade" ;;
                esac
                [[ -f ${SQLITE_PATH} ]] || fail "existing SQLite database ${SQLITE_PATH} does not exist"
                [[ ! -L ${SQLITE_PATH} ]] || fail "a symlinked SQLite database requires a manual upgrade"
                ;;
            mysql)
                [[ ${MYSQL_BACKUP_CONFIRMED} == true ]] || fail "MySQL migration requires --mysql-backup-confirmed"
                ;;
            *) fail "unsupported existing database dialect '${DATABASE_DIALECT}'" ;;
        esac
    fi
}

check_legacy_service() {
    systemd_running || fail "a running systemd instance is required for this upgrade"
    local fragment dropins environment environment_files mask_path unit_path unit_count
    local -a unit_paths=()
    if [[ ${PACKAGE_KIND} == deb ]]; then
        mapfile -t unit_paths < <(dpkg-query -L "${LEGACY_PACKAGE}" \
            | awk -v name="${LEGACY_SERVICE}" '$0 == "/usr/lib/systemd/system/" name || $0 == "/lib/systemd/system/" name')
    else
        mapfile -t unit_paths < <(rpm -ql "${LEGACY_PACKAGE}" \
            | awk -v name="${LEGACY_SERVICE}" '$0 == "/usr/lib/systemd/system/" name || $0 == "/lib/systemd/system/" name')
    fi
    unit_count=${#unit_paths[@]}
    [[ ${unit_count} == 1 ]] || fail "the installed package must contain exactly one standard service unit"
    unit_path=${unit_paths[0]}
    LEGACY_UNIT_PATH=${unit_path}
    [[ ! -L ${unit_path} && -f ${unit_path} ]] || fail "the installed package service unit is missing or unsafe"
    grep -Fq "${LEGACY_ROOT}/scripts/studio.service" "${unit_path}" \
        || fail "existing service unit does not use the expected root ${LEGACY_ROOT}"

    fragment=$(systemctl_property "${LEGACY_SERVICE}" FragmentPath)
    if [[ ${LEGACY_SERVICE_STATE} == masked || ${LEGACY_SERVICE_STATE} == masked-runtime ]]; then
        if [[ ${LEGACY_SERVICE_STATE} == masked ]]; then
            mask_path=/etc/systemd/system/${LEGACY_SERVICE}
        else
            mask_path=/run/systemd/system/${LEGACY_SERVICE}
        fi
        if [[ ${fragment} != /dev/null && ${fragment} != "${unit_path}" ]]; then
            [[ ${fragment} == "${mask_path}" && -L ${mask_path} \
                && $(readlink -f "${mask_path}") == /dev/null ]] \
                || fail "masked existing service resolves to an unexpected unit path ${fragment}"
        fi
    else
        [[ -f ${fragment} && $(readlink -f "${fragment}") == "$(readlink -f "${unit_path}")" ]] \
            || fail "existing service unit is installed at a custom path ${fragment}"
    fi
    dropins=$(systemctl_property "${LEGACY_SERVICE}" DropInPaths)
    [[ -z ${dropins} ]] || fail "existing systemd overrides require a manual upgrade: ${dropins}"
    if grep -Eq '^[[:space:]]*Environment(File)?[[:space:]]*=' "${unit_path}"; then
        fail "existing systemd environment injection requires a manual upgrade"
    fi
    environment=$(systemctl_property "${LEGACY_SERVICE}" Environment)
    environment_files=$(systemctl_property "${LEGACY_SERVICE}" EnvironmentFiles)
    [[ -z ${environment} && -z ${environment_files} ]] \
        || fail "existing systemd environment injection requires a manual upgrade"
}

check_target_is_empty() {
    if [[ -f ${STATE_FILE} ]]; then
        return
    fi
    new_package_installed && fail "${NEW_PACKAGE} is already installed"
    [[ ! -e /usr/lib/nebula-studio && ! -L /usr/lib/nebula-studio ]] || fail "/usr/lib/nebula-studio already exists"
    [[ ! -e /etc/nebula-studio && ! -L /etc/nebula-studio ]] || fail "/etc/nebula-studio already exists"
    [[ ! -e /var/lib/nebula-studio && ! -L /var/lib/nebula-studio ]] || fail "/var/lib/nebula-studio already exists"
    [[ ! -e /var/log/nebula-studio && ! -L /var/log/nebula-studio ]] || fail "/var/log/nebula-studio already exists"
}

check_disk_space() {
    local var_needed var_available var_device usr_needed usr_available usr_device config_size database_size
    config_size=$(du -Pk "${CONFIG_FILE}" | awk '{print $1}')
    database_size=0
    [[ ${DATABASE_DIALECT} == sqlite3 && ${DATABASE_ENABLE} == true ]] \
        && database_size=$(du -Pk "${SQLITE_PATH}" | awk '{print $1}')
    var_needed=$(( (config_size + database_size) * 3 + 102400 ))
    var_available=$(df -Pk /var | awk 'NR == 2 {print $4}')
    var_device=$(df -Pk /var | awk 'NR == 2 {print $1}')
    usr_needed=$(( PACKAGE_SIZE_KIB + 51200 ))
    usr_available=$(df -Pk /usr | awk 'NR == 2 {print $4}')
    usr_device=$(df -Pk /usr | awk 'NR == 2 {print $1}')
    if [[ ${var_device} == "${usr_device}" ]]; then
        (( var_available >= var_needed + usr_needed )) \
            || fail "migration needs $((var_needed + usr_needed)) KiB on ${var_device}, but only ${var_available} KiB is available"
    else
        (( var_available >= var_needed )) \
            || fail "migration needs ${var_needed} KiB under /var, but only ${var_available} KiB is available"
        (( usr_available >= usr_needed )) \
            || fail "migration needs ${usr_needed} KiB under /usr, but only ${usr_available} KiB is available"
    fi
}

run_check() {
    [[ -n ${PACKAGE_FILE} && -n ${CHECKSUM_FILE} ]] || fail "--package and --checksum are required"
    [[ ${PACKAGE_FILE} != *$'\n'* && ${CHECKSUM_FILE} != *$'\n'* && ${LEGACY_ROOT} != *$'\n'* ]] \
        || fail "paths must not contain newlines"
    local command
    for command in awk basename chmod grep install mktemp realpath rm sha256sum tar; do
        require_command "${command}"
    done
    PACKAGE_FILE=$(realpath "${PACKAGE_FILE}")
    CHECKSUM_FILE=$(realpath "${CHECKSUM_FILE}")
    LEGACY_ROOT=$(realpath "${LEGACY_ROOT}")
    verify_checksum
    extract_helper
    validate_architecture
    validate_install_environment
    check_target_is_empty
    legacy_package_installed || fail "package ${LEGACY_PACKAGE} is not installed"
    validate_legacy_architecture
    check_legacy_script_requirements
    check_legacy_wrapper
    capture_service_state
    check_legacy_service
    inspect_legacy_config
    check_disk_space
    echo "Upgrade preflight passed for ${LEGACY_PACKAGE} -> ${NEW_PACKAGE} ${PACKAGE_VERSION} (${PACKAGE_ARCH})."
}

capture_service_state() {
    LEGACY_SERVICE_STATE=$(systemctl is-enabled "${LEGACY_SERVICE}" 2>/dev/null || true)
    case "${LEGACY_SERVICE_STATE}" in
        enabled | enabled-runtime | masked | masked-runtime) ;;
        *) LEGACY_SERVICE_STATE=disabled ;;
    esac
}

prepare_backup() {
    if [[ -d ${BACKUP_DIR} ]]; then
        validate_backup
        PHASE=backed_up
        write_state
        return
    fi
    local backup_temp
    backup_temp=$(mktemp -d "${BACKUP_DIR}.partial.XXXXXX")
    chmod 0700 "${backup_temp}"
    install -m 0600 -o root -g root "${CONFIG_FILE}" "${backup_temp}/config.yaml"
    "${HELPER}" rewrite-config --input "${CONFIG_FILE}" --output "${backup_temp}/config.migrated.yaml"
    chmod 0600 "${backup_temp}/config.migrated.yaml"
    install -m 0600 -o root -g root "${LEGACY_UNIT_PATH}" "${backup_temp}/legacy-service.txt"
    if [[ ${PACKAGE_KIND} == deb ]]; then
        dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\n' "${LEGACY_PACKAGE}" > "${backup_temp}/legacy-package.txt"
    else
        rpm -q --queryformat '%{NAME}\t%{VERSION}-%{RELEASE}\t%{ARCH}\n' "${LEGACY_PACKAGE}" > "${backup_temp}/legacy-package.txt"
    fi
    if [[ ${DATABASE_ENABLE} == true && ${DATABASE_DIALECT} == sqlite3 ]]; then
        "${HELPER}" sqlite-backup --source "${SQLITE_PATH}" --destination "${backup_temp}/studio.db"
        chmod 0600 "${backup_temp}/studio.db"
    fi
    local backup_files=(config.yaml config.migrated.yaml legacy-service.txt legacy-package.txt)
    [[ -f ${backup_temp}/studio.db ]] && backup_files+=(studio.db)
    (cd "${backup_temp}" && sha256sum "${backup_files[@]}" > SHA256SUMS)
    chmod 0600 "${backup_temp}"/*
    mv -- "${backup_temp}" "${BACKUP_DIR}"
    validate_backup
    PHASE=backed_up
    write_state
}

validate_backup() {
    [[ ! -L ${BACKUP_DIR} && -d ${BACKUP_DIR} ]] || fail "migration backup ${BACKUP_DIR} is missing or unsafe"
    [[ $(stat -c '%u:%a' "${BACKUP_DIR}") == 0:700 ]] || fail "migration backup has unsafe ownership or permissions"
    local required=(config.yaml config.migrated.yaml legacy-service.txt legacy-package.txt SHA256SUMS)
    [[ ${DATABASE_ENABLE} == true && ${DATABASE_DIALECT} == sqlite3 ]] && required+=(studio.db)
    local item
    for item in "${required[@]}"; do
        [[ ! -L ${BACKUP_DIR}/${item} && -f ${BACKUP_DIR}/${item} ]] || fail "migration backup is missing safe ${item}"
    done
    (cd "${BACKUP_DIR}" && sha256sum --check SHA256SUMS >/dev/null) || fail "migration backup checksum verification failed"
}

remove_legacy_package() {
    validate_backup
    systemctl disable "${LEGACY_SERVICE}" >/dev/null 2>&1 || true
    systemctl unmask "${LEGACY_SERVICE}" >/dev/null 2>&1 || true
    if legacy_package_installed; then
        if [[ ${PACKAGE_KIND} == deb ]]; then
            dpkg --remove "${LEGACY_PACKAGE}"
        else
            rpm -e "${LEGACY_PACKAGE}"
        fi
    fi
    legacy_package_installed && fail "the previous package is still installed"
    PHASE=legacy_removed
    write_state
}

install_new_package() {
    if new_package_installed; then
        new_package_matches || fail "an unexpected ${NEW_PACKAGE} version is installed"
    else
        if [[ ${PACKAGE_KIND} == deb ]]; then
            dpkg --install "${PACKAGE_FILE}"
        else
            rpm -U "${PACKAGE_FILE}"
        fi
    fi
    new_package_matches || fail "new package installation did not complete with the expected version and architecture"
    [[ -x /usr/lib/nebula-studio/bin/studio && -x /usr/lib/nebula-studio/bin/studio-migrate-helper ]] \
        || fail "new package binaries are incomplete"
    [[ -f ${NEW_CONFIG} ]] || fail "new package configuration is missing"
    getent passwd nebula-studio >/dev/null 2>&1 || fail "new package service account is missing"
    PACKAGE_CONFIG_SHA256=$(sha256sum "${NEW_CONFIG}" | awk '{print $1}')
    PHASE=new_installed
    write_state
}

deploy_migrated_state() {
    local config_temp data_temp current_config_sha expected_config_sha current_data_sha expected_data_sha
    validate_backup
    expected_config_sha=$(sha256sum "${BACKUP_DIR}/config.migrated.yaml" | awk '{print $1}')
    current_config_sha=$(sha256sum "${NEW_CONFIG}" | awk '{print $1}')
    if [[ ${current_config_sha} != "${expected_config_sha}" && ${current_config_sha} != "${PACKAGE_CONFIG_SHA256}" ]]; then
        fail "new configuration changed during migration; refusing to overwrite it"
    fi
    config_temp=/etc/nebula-studio/.config.migrating.$$
    if [[ ${current_config_sha} != "${expected_config_sha}" ]]; then
        install -m 0640 -o root -g nebula-studio "${BACKUP_DIR}/config.migrated.yaml" "${config_temp}"
        mv -f "${config_temp}" "${NEW_CONFIG}"
    fi
    if [[ ${DATABASE_ENABLE} == true && ${DATABASE_DIALECT} == sqlite3 ]]; then
        expected_data_sha=$(sha256sum "${BACKUP_DIR}/studio.db" | awk '{print $1}')
        if [[ -e ${NEW_DATA} || -L ${NEW_DATA} ]]; then
            [[ ! -L ${NEW_DATA} && -f ${NEW_DATA} ]] || fail "new database path is unsafe"
            current_data_sha=$(sha256sum "${NEW_DATA}" | awk '{print $1}')
            [[ ${current_data_sha} == "${expected_data_sha}" ]] \
                || fail "new database changed during migration; refusing to overwrite it"
        else
            data_temp=/var/lib/nebula-studio/.studio.migrating.$$
            install -m 0600 -o nebula-studio -g nebula-studio "${BACKUP_DIR}/studio.db" "${data_temp}"
            mv -f "${data_temp}" "${NEW_DATA}"
        fi
    fi
    systemctl daemon-reload
    systemctl stop "${NEW_SERVICE}" >/dev/null 2>&1 || true
    case "${LEGACY_SERVICE_STATE}" in
        enabled)
            systemctl unmask "${NEW_SERVICE}" >/dev/null 2>&1 || true
            systemctl enable "${NEW_SERVICE}" >/dev/null
            ;;
        enabled-runtime)
            systemctl unmask "${NEW_SERVICE}" >/dev/null 2>&1 || true
            systemctl enable --runtime "${NEW_SERVICE}" >/dev/null
            ;;
        masked)
            systemctl disable "${NEW_SERVICE}" >/dev/null 2>&1 || true
            systemctl mask "${NEW_SERVICE}" >/dev/null
            ;;
        masked-runtime)
            systemctl disable "${NEW_SERVICE}" >/dev/null 2>&1 || true
            systemctl mask --runtime "${NEW_SERVICE}" >/dev/null
            ;;
        *)
            systemctl disable "${NEW_SERVICE}" >/dev/null 2>&1 || true
            ;;
    esac
    systemctl is-active --quiet "${NEW_SERVICE}" && fail "new service started unexpectedly"
    PHASE=deployed
    write_state
}

run_migrate() {
    [[ ${EUID} -eq 0 ]] || fail "migrate must run as root"
    acquire_lock
    if [[ -f ${STATE_FILE} ]]; then
        local requested_package=${PACKAGE_FILE}
        local expected_kind expected_arch expected_version expected_sha256
        [[ -n ${requested_package} && -n ${CHECKSUM_FILE} ]] || fail "--package and --checksum are required to resume"
        requested_package=$(realpath "${requested_package}")
        CHECKSUM_FILE=$(realpath "${CHECKSUM_FILE}")
        load_state
        [[ ${requested_package} == "${PACKAGE_FILE}" ]] \
            || fail "the existing migration uses package ${PACKAGE_FILE}"
        [[ -f ${PACKAGE_FILE} ]] || fail "original package ${PACKAGE_FILE} is required to resume"
        expected_kind=${PACKAGE_KIND}
        expected_arch=${PACKAGE_ARCH}
        expected_version=${PACKAGE_VERSION}
        expected_sha256=${PACKAGE_SHA256}
        verify_checksum
        [[ ${PACKAGE_SHA256} == "${expected_sha256}" ]] \
            || fail "package content changed after migration started"
        extract_helper
        [[ ${PACKAGE_KIND} == "${expected_kind}" \
            && ${PACKAGE_ARCH} == "${expected_arch}" \
            && ${PACKAGE_VERSION} == "${expected_version}" ]] \
            || fail "package metadata changed after migration started"
        validate_install_environment
    else
        run_check
        install -d -m 0700 -o root -g root /var/backups/nebula-studio
        BACKUP_DIR=/var/backups/nebula-studio/legacy-$(date -u +%Y%m%dT%H%M%SZ)-${PACKAGE_SHA256:0:12}
        [[ ! -e ${BACKUP_DIR} && ! -L ${BACKUP_DIR} ]] || fail "migration backup path ${BACKUP_DIR} already exists"
        PHASE=preflight_complete
        write_state
    fi

    case "${PHASE}" in
        preflight_complete)
            legacy_package_installed || fail "the previous package disappeared after preflight"
            new_package_installed && fail "new package appeared after preflight"
            if systemctl is-active --quiet "${LEGACY_SERVICE}"; then
                systemctl stop "${LEGACY_SERVICE}"
                systemctl is-active --quiet "${LEGACY_SERVICE}" && fail "the previous service did not stop"
            fi
            PHASE=service_stopped
            write_state
            ;;
    esac
    case "${PHASE}" in
        service_stopped)
            legacy_package_installed || fail "the previous package disappeared before backup completed"
            systemctl is-active --quiet "${LEGACY_SERVICE}" && fail "the previous service restarted during the upgrade"
            prepare_backup
            ;;
    esac
    case "${PHASE}" in
        backed_up)
            validate_backup
            remove_legacy_package
            ;;
    esac
    case "${PHASE}" in
        legacy_removed)
            legacy_package_installed && fail "the previous package reappeared during the upgrade"
            install_new_package
            ;;
    esac
    case "${PHASE}" in
        new_installed)
            new_package_matches || fail "installed new package changed during migration"
            deploy_migrated_state
            ;;
    esac
    [[ ${PHASE} == deployed || ${PHASE} == verified ]] || fail "migration stopped in unexpected phase ${PHASE}"
    if systemctl is-active --quiet "${NEW_SERVICE}"; then
        echo "Migration already completed. The new service remains running."
    else
        echo "Migration completed. The new service is stopped."
    fi
    echo "Backup: ${BACKUP_DIR}"
    echo "Start and verify with:"
    echo "  systemctl start ${NEW_SERVICE}"
    echo "  $0 verify"
}

run_verify() {
    [[ ${EUID} -eq 0 ]] || fail "verify must run as root"
    HELPER=/usr/lib/nebula-studio/bin/studio-migrate-helper
    acquire_lock
    load_state
    [[ ${PHASE} == deployed || ${PHASE} == verified ]] || fail "migration is not ready for verification"
    systemctl is-active --quiet "${NEW_SERVICE}" || fail "${NEW_SERVICE} is not running; start it manually first"
    local helper=${HELPER}
    local studio=/usr/lib/nebula-studio/bin/studio
    [[ -x ${helper} && -x ${studio} ]] || fail "installed Studio binaries are missing"
    local host port health_host
    host=$("${helper}" inspect-config --config "${NEW_CONFIG}" --field host)
    port=$("${helper}" inspect-config --config "${NEW_CONFIG}" --field port)
    case "${host}" in 0.0.0.0 | :: | '') host=127.0.0.1 ;; esac
    health_host=${host}
    if [[ ${host} == *:* ]]; then
        health_host="[${host}]"
    fi
    "${studio}" -healthcheck "http://${health_host}:${port}/api-studio/health"
    "${studio}" -healthcheck "http://${health_host}:${port}/api-studio/health/ready"
    PHASE=verified
    write_state
    echo "Migration verification passed. Backup retained at ${BACKUP_DIR}."
}

parse_arguments "$@"
case "${COMMAND}" in
    check) run_check ;;
    migrate) run_migrate ;;
    verify) run_verify ;;
esac
