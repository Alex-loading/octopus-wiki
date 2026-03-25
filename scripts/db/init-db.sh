#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/database/migrations"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [[ -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[db:init] 错误：未找到 psql，请先安装 PostgreSQL 客户端。"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db:init] 错误：请先设置 DATABASE_URL。"
  echo "可在项目根目录 .env 中设置，或在终端 export。"
  echo "示例: DATABASE_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require'"
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[db:init] 错误：迁移目录不存在: $MIGRATIONS_DIR"
  exit 1
fi

MIGRATION_FILES=("$MIGRATIONS_DIR"/*.sql)
if [[ ! -f "${MIGRATION_FILES[0]}" ]]; then
  echo "[db:init] 错误：未找到迁移文件（$MIGRATIONS_DIR/*.sql）"
  exit 1
fi

for migration in "${MIGRATION_FILES[@]}"; do
  echo "[db:init] 开始执行迁移: $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done

echo "[db:init] 迁移完成。"
