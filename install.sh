#!/usr/bin/env bash
# install.sh — Install or update the BabyPanda binary on Ubuntu / WSL.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ArmaanAmoli/BabyPanda/main/install.sh | bash
#   BABY_PANDA_VERSION=v0.1.0 bash install.sh
#
# If BabyPanda is already installed, this script replaces it with the latest
# release (or the version requested via BABY_PANDA_VERSION).

set -euo pipefail

repo="ArmaanAmoli/BabyPanda"
asset="babypanda-linux-x64"
install_dir="${BABY_PANDA_BIN_DIR:-$HOME/.local/bin}"
version="${BABY_PANDA_VERSION:-latest}"
binary_path="$install_dir/babypanda"

# --- platform guard ----------------------------------------------------------
if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" ]]; then
  echo "BabyPanda currently supports Ubuntu/WSL on x86_64 only." >&2
  echo "Detected: $(uname -s) $(uname -m)" >&2
  exit 1
fi

# --- resolve download URL ----------------------------------------------------
if [[ "$version" == "latest" ]]; then
  base_url="https://github.com/$repo/releases/latest/download"
else
  base_url="https://github.com/$repo/releases/download/$version"
fi

binary_url="$base_url/$asset"
checksum_url="$base_url/$asset.sha256"

# --- download ----------------------------------------------------------------
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "Downloading BabyPanda $version ..."
curl -fsSL "$binary_url" -o "$tmp_dir/$asset"

echo "Downloading checksum ..."
curl -fsSL "$checksum_url" -o "$tmp_dir/$asset.sha256"

# --- verify checksum ---------------------------------------------------------
echo "Verifying checksum ..."
(
  cd "$tmp_dir"
  sha256sum -c "$asset.sha256"
)

# --- install / update --------------------------------------------------------
mkdir -p "$install_dir"

if [[ -e "$binary_path" ]]; then
  echo "BabyPanda already installed at $binary_path — updating ..."
fi

install -m 0755 "$tmp_dir/$asset" "$binary_path"

echo "Installed BabyPanda to $binary_path"

# --- Add BabyPanda to PATH automatically -------------------------------------
shell_rc=""
case "$(basename "$SHELL")" in
  bash) shell_rc="$HOME/.bashrc" ;;
  zsh)  shell_rc="$HOME/.zshrc" ;;
  *)    shell_rc="$HOME/.profile" ;;
esac

# $PATH is kept literal so it expands at login time, not now.
path_line="export PATH=\"$install_dir:\$PATH\""

if [[ -f "$shell_rc" ]] && grep -qF "export PATH=\"$install_dir" "$shell_rc"; then
  echo "BabyPanda is already on PATH in $shell_rc"
else
  {
    echo ""
    echo "# BabyPanda"
    echo "$path_line"
  } >> "$shell_rc"
  echo "Added BabyPanda to PATH in $shell_rc"
fi

echo
echo "Run: babypanda help"
echo "(You may need to restart your terminal or run: source $shell_rc)"
