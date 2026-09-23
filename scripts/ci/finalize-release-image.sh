#!/usr/bin/env bash
set -euo pipefail

image=${IMAGE:?IMAGE is required}
version=${STUDIO_VERSION:?STUDIO_VERSION is required}
revision=${TARGET_SHA:?TARGET_SHA is required}
image_ref="${image}:${version}"
image_json="${RUNNER_TEMP}/release-image.json"
image_info="${RUNNER_TEMP}/release-image.txt"
image_error="${RUNNER_TEMP}/release-image-error.txt"

inspect_exact_image() {
  if ! docker buildx imagetools inspect "${image_ref}" > "${image_info}" 2> "${image_error}"; then
    if grep -Eqi 'unauthorized|denied|timeout|connection|TLS|rate limit|401 Unauthorized|403 Forbidden|429 Too Many Requests|5[0-9]{2} (Internal|Bad|Service|Gateway)' "${image_error}"; then
      cat "${image_error}" >&2
      exit 2
    fi
    if grep -Eqi 'not found|manifest unknown' "${image_error}"; then return 1; fi
    cat "${image_error}" >&2
    exit 2
  fi
  docker buildx imagetools inspect "${image_ref}" --raw > "${image_json}" || exit 2
  jq -e --arg version "${version}" --arg revision "${revision}" '
    .annotations["org.opencontainers.image.version"] == $version
    and .annotations["org.opencontainers.image.revision"] == $revision
    and ([.manifests[] | select(.platform.os == "linux" and .platform.architecture == "amd64")] | length) == 1
    and ([.manifests[] | select(.platform.os == "linux" and .platform.architecture == "arm64")] | length) == 1
  ' "${image_json}" >/dev/null || {
    echo "${image_ref} conflicts with the requested immutable image." >&2
    exit 2
  }
  local digest
  digest=$(awk '$1 == "Digest:" { print $2; exit }' "${image_info}")
  [[ ${digest} =~ ^sha256:[0-9a-f]{64}$ ]] || exit 2
  printf '%s\n' "${digest}"
}

if [[ ${PREPARED_EXISTING:?PREPARED_EXISTING is required} == true ]]; then
  digest=$(inspect_exact_image) || {
    inspect_status=$?
    if [[ ${inspect_status} -eq 1 ]]; then
      echo "Prepared immutable image ${image_ref} has disappeared." >&2
    fi
    exit "${inspect_status}"
  }
  test "${digest}" = "${PREPARED_DIGEST:?PREPARED_DIGEST is required}"
  echo "Reusing ${image_ref}@${digest}."
else
  if digest=$(inspect_exact_image); then
    echo "${image_ref} appeared after publish preparation; refusing to overwrite it." >&2
    exit 1
  else
    inspect_status=$?
    test "${inspect_status}" -eq 1 || exit "${inspect_status}"
  fi

  digest_root=${DIGEST_ROOT:?DIGEST_ROOT is required}
  for arch in amd64 arm64; do
    record_dir="${digest_root}/${arch}"
    (
      cd "${record_dir}"
      sha256sum --check --status record.json.sha256
    )
    jq -e --arg arch "${arch}" --arg version "${version}" --arg revision "${revision}" '
      .arch == $arch
      and .version == $version
      and .sourceSha == $revision
      and (.digest | test("^sha256:[0-9a-f]{64}$"))
      and (.runtimeDigest | test("^sha256:[0-9a-f]{64}$"))
      and (.attestationDigest | test("^sha256:[0-9a-f]{64}$"))
    ' "${record_dir}/record.json" >/dev/null
  done

  amd_record="${digest_root}/amd64/record.json"
  arm_record="${digest_root}/arm64/record.json"
  amd_digest=$(jq -r .digest "${amd_record}")
  arm_digest=$(jq -r .digest "${arm_record}")
  docker buildx imagetools create \
    --tag "${image_ref}" \
    --annotation 'index:org.opencontainers.image.title=NebulaGraph Studio' \
    --annotation "index:org.opencontainers.image.source=${SOURCE_URL:?SOURCE_URL is required}" \
    --annotation "index:org.opencontainers.image.version=${version}" \
    --annotation "index:org.opencontainers.image.revision=${revision}" \
    "${image}@${amd_digest}" "${image}@${arm_digest}"

  digest=$(inspect_exact_image)
  jq -e \
    --arg amd "$(jq -r .runtimeDigest "${amd_record}")" \
    --arg arm "$(jq -r .runtimeDigest "${arm_record}")" \
    --arg amd_attestation "$(jq -r .attestationDigest "${amd_record}")" \
    --arg arm_attestation "$(jq -r .attestationDigest "${arm_record}")" '
    ([.manifests[] | select(.digest == $amd and .platform.os == "linux" and .platform.architecture == "amd64")] | length) == 1
    and ([.manifests[] | select(.digest == $arm and .platform.os == "linux" and .platform.architecture == "arm64")] | length) == 1
    and ([.manifests[] | select(.digest == $amd_attestation
      and .annotations["vnd.docker.reference.type"] == "attestation-manifest"
      and .annotations["vnd.docker.reference.digest"] == $amd)] | length) == 1
    and ([.manifests[] | select(.digest == $arm_attestation
      and .annotations["vnd.docker.reference.type"] == "attestation-manifest"
      and .annotations["vnd.docker.reference.digest"] == $arm)] | length) == 1
  ' "${image_json}" >/dev/null || {
    echo 'Merged image does not contain the validated platform and attestation manifests.' >&2
    exit 1
  }
  echo "Published ${image_ref}@${digest}."
fi

printf 'digest=%s\n' "${digest}" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
