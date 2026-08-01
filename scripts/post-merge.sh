#!/bin/bash
set -e

# Install / sync dependencies after any merge
npm ci --prefer-offline 2>/dev/null || npm ci
