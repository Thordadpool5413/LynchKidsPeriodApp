#!/bin/bash
set -e

# Serialize concurrent npm ci runs with a lock file.
# Multiple task merges landing at the same time each trigger this script; without
# the lock they race on node_modules and corrupt it (expo-router/entry goes missing).
exec flock -x /tmp/glitter-post-merge.lock \
  npm ci --prefer-offline 2>/dev/null || npm ci
