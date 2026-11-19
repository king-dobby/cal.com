#!/bin/sh
# SILENT_PATCH for an image built before the source made Google's events.patch calls silent
# (packages/app-store/googlecalendar/lib/CalendarService.ts). Makes the same change in the built server code under
# $1, then fails unless every events.patch call in every bundle holding the Google calendar code is silent. An image
# built from the fixed source is silent already, and this changes nothing in it.
set -euf
root="$1"
files=$(grep -rl --include='*.js' 'patch-hangout-link' "$root" || true)
if [ -z "$files" ]; then
  echo "SILENT_PATCH: no bundle under $root holds the Google calendar code" >&2
  exit 1
fi
for f in $files; do
  sed -i -E 's/\.events\.patch\(\{calendarId:([^,{}]+),eventId:([^,{}]+),requestBody:/.events.patch({calendarId:\1,eventId:\2,sendUpdates:"none",requestBody:/g' "$f"
  total=$(grep -oE '\.events\.patch\(' "$f" | wc -l)
  silent=$(grep -oE '\.events\.patch\(\{[^{}]*sendUpdates:"none"' "$f" | wc -l)
  if [ "$total" -eq 0 ] || [ "$total" -ne "$silent" ]; then
    echo "SILENT_PATCH: $f has $total Google patch calls, $silent of them silent" >&2
    exit 1
  fi
  echo "SILENT_PATCH: $f: $silent of $total silent"
done
