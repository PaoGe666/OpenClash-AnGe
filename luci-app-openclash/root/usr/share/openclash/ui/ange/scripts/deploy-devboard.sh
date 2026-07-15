#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
devboard_url="http://192.168.3.22:2048"

cd "$project_dir"
corepack pnpm run build

entry_asset=$(sed -n 's/.*src="\.\/\(assets\/[^\"]*\.js\)".*/\1/p' dist/index.html)

if [ -z "$entry_asset" ]; then
  echo "Unable to determine the built entry asset."
  exit 1
fi

if ! curl -fsS --max-time 10 "$devboard_url/" | grep -Fq "$entry_asset"; then
  echo "Development board did not serve the newly built asset: $entry_asset"
  exit 1
fi

echo "Development board updated: $devboard_url ($entry_asset)"
