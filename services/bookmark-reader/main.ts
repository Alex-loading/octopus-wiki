import { parseArgs } from "node:util";
import { BookmarkBrowserReader } from "./browser.ts";
import { readerBaseUrl, readerDataDirectory, readerPort, readerToken } from "./config.ts";
import { createReaderServer } from "./server.ts";

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  headed: { type: "boolean" }, platform: { type: "string", default: "xiaohongshu" },
} });
const command = positionals[0] ?? "serve";
if (!["serve", "login", "token", "status"].includes(command) || positionals.length > 1)
  throw new Error("使用 serve、login、token 或 status 命令。");

if (command === "token") {
  console.log(await readerToken(true));
} else if (command === "status") {
  const response = await fetch(new URL("/health", readerBaseUrl()), {
    headers: { Authorization: `Bearer ${await readerToken()}` },
    redirect: "error", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("读取服务状态查询失败。");
  console.log(JSON.stringify(await response.json()));
} else {
  const reader = new BookmarkBrowserReader(readerDataDirectory());
  const token = await readerToken(true);
  const server = createReaderServer(reader, token);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(readerPort(), process.env.BOOKMARK_BROWSER_READER_HOST || "127.0.0.1", resolve);
  });
  let stopping = false;
  const close = async () => {
    if (stopping) return;
    stopping = true;
    await Promise.all([
      new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
      reader.close(),
    ]);
  };
  process.once("SIGINT", () => { void close(); });
  process.once("SIGTERM", () => { void close(); });
  let started = false;
  try {
    await reader.start(command === "login" || Boolean(values.headed));
    if (command === "login") await reader.openLogin(values.platform);
    started = true;
  } finally {
    if (!started) await close();
  }
  console.log(`平台内容读取服务已启动，端口 ${readerPort()}，浏览器数据目录 ${reader.directory}`);
  if (command === "login")
    console.log("请在独立 Chrome 窗口中完成平台登录，完成后保持此进程运行。");
}
