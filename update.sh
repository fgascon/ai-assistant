#!/usr/bin/env bash

set -eo pipefail

git pull
pnpm install
pnpm build
pnpm reload
