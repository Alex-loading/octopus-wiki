import { writeFileSync } from "node:fs";
import { loadEnv } from "vite";
import { bookmarkServerClient } from "../../api/_lib/bookmark-save.ts";
import { archiveBookmarkCover } from "../../api/_lib/bookmark-cover.ts";

const env = loadEnv("development", process.cwd(), "");
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BOOKMARK_CHROME_EXECUTABLE_PATH"])
  if (!process.env[key] && env[key]) process.env[key] = env[key];
const apply = process.argv.includes("--apply");
const reportIndex = process.argv.indexOf("--report");
const reportPath = reportIndex >= 0 ? process.argv[reportIndex + 1] : undefined;
if (reportIndex >= 0 && !reportPath) throw new Error("--report requires a file path");
const client = bookmarkServerClient();
const report: Record<string, unknown>[] = [];
let offset = 0;
for (;;) {
  const { data, error } = await client.from("bookmarks")
    .select("id,url,cover_url,cover_storage_path,platform,updated_at")
    .order("id").range(offset, offset + 499);
  if (error) throw new Error("读取收藏失败，请先应用 010 迁移。");
  for (const row of data ?? []) {
    if (!row.cover_url || row.cover_storage_path) {
      report.push({ id: row.id, platform: row.platform, status: row.cover_storage_path ? "already-stored" : "no-cover" });
      continue;
    }
    try {
      // Dry runs download/validate the same images but never upload or change records.
      const storage = apply ? client : { storage: { from: () => ({ upload: async () => ({ error: null }) }) } } as typeof client;
      const path = await archiveBookmarkCover(storage, row.cover_url, row.url);
      if (apply) {
        const { data: changed, error: updateError } = await client.from("bookmarks")
          .update({ cover_storage_path: path }).eq("id", row.id).eq("updated_at", row.updated_at)
          .eq("cover_url", row.cover_url).eq("cover_storage_path", "").select("id");
        if (updateError) throw new Error("写入封面路径失败。");
        if (!changed?.length) throw new Error("收藏已被其他操作修改，本次跳过，重新运行即可。");
      }
      const result = { id: row.id, platform: row.platform, status: apply ? "stored" : "ready", path };
      report.push(result); console.log(JSON.stringify(result));
    } catch (error) {
      const result = { id: row.id, platform: row.platform, status: "unavailable", error: error instanceof Error ? error.message : "封面不可用" };
      report.push(result); console.log(JSON.stringify(result));
    }
  }
  if (!data || data.length < 500) break;
  offset += 500;
}
const summary: Record<string, number> = {};
for (const row of report) summary[String(row.status)] = (summary[String(row.status)] ?? 0) + 1;
console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", summary }));
if (reportPath) writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), apply, summary, records: report }, null, 2));
