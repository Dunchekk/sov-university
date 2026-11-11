#!/usr/bin/env bash
set -euo pipefail
umask 077
backup_dir="${1:-.local/backups/$(date -u +%Y%m%dT%H%M%SZ)}"
mkdir -p "$backup_dir"
compose=(docker compose --env-file "${RYADOM_ENV_FILE:-.env}")
was_running="$("${compose[@]}" ps --status running -q app)"
restore_app() { if [[ -n "$was_running" ]]; then "${compose[@]}" start app >/dev/null; fi; }
trap restore_app EXIT
"${compose[@]}" stop app
"${compose[@]}" exec -T db pg_dump -U ryadom -d ryadom -Fc > "$backup_dir/database.dump"
"${compose[@]}" run --rm -T --no-deps --entrypoint tar app -C /app/storage -cf - . > "$backup_dir/files.tar"
printf '%s\n' 'Database and files saved. Store the environment secrets separately.' > "$backup_dir/README.txt"
printf 'Резервная копия: %s\n' "$backup_dir"
