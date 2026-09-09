#!/usr/bin/env sh
set -eu

trap 'exit 0' TERM INT

while :; do
  started_at=$(date +%s)
  php bin/console app:development-feedback:cleanup --no-interaction

  # Measure from the start of the run so execution time does not extend the interval.
  elapsed=$(($(date +%s) - started_at))
  delay=$((3600 - elapsed))
  if [ "$delay" -gt 0 ]; then
    sleep "$delay" &
    wait "$!"
  fi
done
