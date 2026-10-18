#!/usr/bin/env bash
# Rebuild the image, upload it to the private Object Storage bucket, and hard-reset the VM
# (the app is stateless; a soft reset can hang in STOPPING for 15+ minutes).
# On boot the VM's not-wasted.service downloads the tarball with its instance principal
# (no registry credentials on the VM) and runs it behind Caddy (automatic HTTPS).
# Usage: scripts/deploy-oci.sh            (build, upload, restart VM)
#        SKIP_BUILD=1 scripts/deploy-oci.sh
set -euo pipefail
export PATH="$HOME/bin:$PATH"

IMAGE=us-chicago-1.ocir.io/axmy5kvwwsi6/not-wasted:latest
BUCKET=not-wasted-images
INSTANCE_ID=ocid1.instance.oc1.us-chicago-1.anxxeljrlshgfjac6ijdtag7kqbyunsdssjnr2uuovh3npz2af7zsvdkjtaa
URL=https://147-224-193-213.sslip.io

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

if [ -z "${SKIP_BUILD:-}" ]; then
  docker build -t "$IMAGE" "$ROOT"
fi
docker save "$IMAGE" | gzip -1 > "$TMP/not-wasted.tar.gz"
oci os object put -bn "$BUCKET" --name not-wasted.tar.gz --file "$TMP/not-wasted.tar.gz" --force >/dev/null

oci compute instance action --instance-id "$INSTANCE_ID" --action RESET \
  --wait-for-state RUNNING --max-wait-seconds 600 >/dev/null

echo "Restarted. Waiting for $URL ..."
for _ in $(seq 1 60); do
  curl -sf -o /dev/null -m 5 "$URL/" && { echo "Live: $URL"; exit 0; }
  sleep 10
done
echo "Not up yet; check the VM console (systemctl status not-wasted)" >&2
exit 1
