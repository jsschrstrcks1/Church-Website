#!/bin/bash
# Installs (or updates) the Church Stream Helper on a Mac, for Live Studio at https://lakeviewfellowshipchurch.com/admin/live.
#
#   Install or update:  curl -fsSL https://lakeviewfellowshipchurch.com/stream-helper/install.sh | bash
#   Remove:             curl -fsSL https://lakeviewfellowshipchurch.com/stream-helper/install.sh | bash -s -- --uninstall
#
# What it does (no administrator password needed, nothing outside your user folder):
#   - downloads Node.js and ffmpeg (fixed versions, checked against known checksums)
#     into ~/Library/Application Support/Church Stream Helper
#   - downloads helper.mjs from the church website
#   - sets the helper to start automatically when you log in, and starts it now
#
# EDIT: default SITE is the church website; override anytime with STREAM_HELPER_SITE.
set -euo pipefail

SITE="${STREAM_HELPER_SITE:-https://lakeviewfellowshipchurch.com}"
APP_DIR="$HOME/Library/Application Support/Church Stream Helper"
LABEL="org.example.streamhelper"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT=51735

NODE_VERSION="v24.22.2"
NODE_SHA_arm64="aa9549349e47dffaa42dcf95d6e06ade8c4bdafc980979883b88767670df385a"
NODE_SHA_x64="d5e336d588c45be0c37dbd52cc29895593009ca4997a77a1fd02815131ed0e52"
FFMPEG_RELEASE="b6.1.1"
FFMPEG_SHA_arm64="8923876afa8db5585022d7860ec7e589af192f441c56793971276d450ed3bbfa"
FFMPEG_SHA_x64="929b375c1182d956c51f7ac25e0b2b0411fb01f6f407aa15c9758efeb4242106"

say() { printf '\n==> %s\n' "$1"; }

stop_agent() {
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
}

if [ "${1:-}" = "--uninstall" ]; then
  say "Removing the Church Stream Helper"
  stop_agent
  rm -f "$PLIST"
  rm -rf "$APP_DIR"
  echo "Done. The helper is removed."
  exit 0
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This installer is for Mac computers." >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) ARCH="arm64"; NODE_SHA="$NODE_SHA_arm64"; FFMPEG_SHA="$FFMPEG_SHA_arm64" ;;
  x86_64) ARCH="x64"; NODE_SHA="$NODE_SHA_x64"; FFMPEG_SHA="$FFMPEG_SHA_x64" ;;
  *) echo "Unsupported Mac processor: $(uname -m)" >&2; exit 1 ;;
esac

check_sha() {
  local file="$1" expected="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  if [ "$actual" != "$expected" ]; then
    echo "Download check failed for $(basename "$file"). Nothing was installed. Try again later." >&2
    exit 1
  fi
}

mkdir -p "$APP_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ ! -x "$APP_DIR/node" ] || [ "$("$APP_DIR/node" --version 2>/dev/null)" != "$NODE_VERSION" ]; then
  say "Downloading Node.js $NODE_VERSION"
  NODE_TGZ="node-$NODE_VERSION-darwin-$ARCH.tar.gz"
  curl -fL --progress-bar -o "$TMP/$NODE_TGZ" "https://nodejs.org/dist/$NODE_VERSION/$NODE_TGZ"
  check_sha "$TMP/$NODE_TGZ" "$NODE_SHA"
  tar -xzf "$TMP/$NODE_TGZ" -C "$TMP" "node-$NODE_VERSION-darwin-$ARCH/bin/node"
  mv -f "$TMP/node-$NODE_VERSION-darwin-$ARCH/bin/node" "$APP_DIR/node"
  chmod +x "$APP_DIR/node"
fi

if [ ! -f "$APP_DIR/ffmpeg.version" ] || [ "$(cat "$APP_DIR/ffmpeg.version")" != "$FFMPEG_RELEASE-$ARCH" ]; then
  say "Downloading ffmpeg ($FFMPEG_RELEASE)"
  curl -fL --progress-bar -o "$TMP/ffmpeg.gz" "https://github.com/eugeneware/ffmpeg-static/releases/download/$FFMPEG_RELEASE/ffmpeg-darwin-$ARCH.gz"
  check_sha "$TMP/ffmpeg.gz" "$FFMPEG_SHA"
  gunzip -c "$TMP/ffmpeg.gz" > "$APP_DIR/ffmpeg"
  chmod +x "$APP_DIR/ffmpeg"
  echo "$FFMPEG_RELEASE-$ARCH" > "$APP_DIR/ffmpeg.version"
fi

say "Downloading the helper from $SITE"
curl -fsSL -o "$TMP/helper.mjs" "$SITE/stream-helper/helper.mjs"
mv -f "$TMP/helper.mjs" "$APP_DIR/helper.mjs"

say "Setting it to start automatically"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$APP_DIR/node</string>
    <string>$APP_DIR/helper.mjs</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$APP_DIR/helper.log</string>
  <key>StandardErrorPath</key><string>$APP_DIR/helper.log</string>
</dict>
</plist>
PLIST

stop_agent
launchctl bootstrap "gui/$(id -u)" "$PLIST"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fs "http://127.0.0.1:$PORT/status" >/dev/null 2>&1; then
    say "The Church Stream Helper is running."
    echo "Open Live Studio in Chrome: $SITE/admin/live"
    echo "If Chrome asks to allow access to devices on your local network, click Allow."
    exit 0
  fi
  sleep 1
done

echo "The helper was installed but didn't answer. Details are in: $APP_DIR/helper.log" >&2
exit 1
