#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VERIFY_SQL="$ROOT_DIR/scripts/db/verify-admin-rls.sql"
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
  echo "[db:verify-admin] 错误：未找到 psql，请先安装 PostgreSQL 客户端。"
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[db:verify-admin] 错误：请先设置 DATABASE_URL。"
  exit 1
fi

if [[ ! -f "$VERIFY_SQL" ]]; then
  echo "[db:verify-admin] 错误：校验脚本不存在: $VERIFY_SQL"
  exit 1
fi

echo "[db:verify-admin] 执行管理员权限与写入流程校验..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"
echo "[db:verify-admin] 校验通过。"
