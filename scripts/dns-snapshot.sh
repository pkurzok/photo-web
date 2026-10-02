#!/usr/bin/env bash
# Writes a normalised snapshot of the peterkurzok.de records that matter, so the state
# before and after a DNS move can be compared with a plain `diff`.
#
#   scripts/dns-snapshot.sh <nameserver> <outfile>
#   scripts/dns-snapshot.sh ns.inwx.de docs/dns/2026-inwx-before.txt
#
# TTLs are stripped and the output is sorted. SOA is left out on purpose (it always
# differs between providers). Only records owned by the zone are kept, so the A records
# a resolver appends behind a CNAME to *.pages.dev do not show up as noise.
set -euo pipefail

ns="${1:?usage: dns-snapshot.sh <nameserver> <outfile>}"
out="${2:?usage: dns-snapshot.sh <nameserver> <outfile>}"
zone="peterkurzok.de"

query() {
  dig +noall +answer +nottlid "@$ns" "$1" "$2" || {
    echo "dig @$ns $1 $2 failed — nothing written" >&2
    exit 1
  }
}

mkdir -p "$(dirname "$out")"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
{
  for type in A AAAA MX TXT NS; do query "$zone" "$type"; done
  for sub in www apps blog playtales sig1._domainkey; do
    for type in A CNAME; do query "$sub.$zone" "$type"; done
  done
} | awk -v zone="$zone." '$1 == zone || $1 ~ ("\\." zone "$")' | sort -u > "$tmp"
mv "$tmp" "$out"

echo "$(wc -l < "$out" | tr -d ' ') records from $ns → $out"
