import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { loadEnv, type Plugin } from "vite";

/** Run the same Web Request/Response handlers locally that Vercel runs in production. */
export function localApi(): Plugin {
  return {
    name: "local-server-api",
    apply: "serve",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir, "");
      for (const key of ["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_MEDIA_SIGNING_SECRET",
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "BOOKMARK_CHROME_EXECUTABLE_PATH"]) {
        if (process.env[key] === undefined && env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
        if (!url.pathname.startsWith("/api/")) return next();
        const reply = (status: number, message: string) => {
          res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          res.end(JSON.stringify({ success: false, message }));
        };
        try {
          // Discover entry points per request so adding/removing a function during
          // development works without restarting; _lib and source URLs stay hidden.
          const routes = new Set(readdirSync(resolve(server.config.root, "api"))
            .filter(file => file.endsWith(".ts")).map(file => `/api/${file.slice(0, -3)}`));
          if (!routes.has(url.pathname)) return reply(404, "API 不存在。");
          const module = await server.ssrLoadModule(`${url.pathname}.ts`);
          const method = req.method ?? "GET";
          const handler = module[method];
          if (typeof handler !== "function") return reply(405, "请求方法不支持。");
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) for (const entry of value) headers.append(name, entry);
            else if (value !== undefined) headers.set(name, value);
          }
          const controller = new AbortController();
          res.on("close", () => { if (!res.writableFinished) controller.abort(); });
          const request = new Request(url, {
            method, headers, signal: controller.signal,
            ...(!["GET", "HEAD"].includes(method)
              ? { body: Readable.toWeb(req) as ReadableStream<Uint8Array>, duplex: "half" } : {}),
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, name) => {
            if (name !== "set-cookie") res.setHeader(name, value);
          });
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader("Set-Cookie", cookies);
          if (!response.body || method === "HEAD") res.end();
          else await pipeline(Readable.fromWeb(response.body as never), res);
        } catch (error) {
          server.config.logger.error(`[local API] ${url.pathname}: ${error instanceof Error ? error.message : "failed"}`);
          if (!res.headersSent) reply(500, "本地 API 执行失败，请查看终端日志。");
          else res.destroy();
        }
      });
    },
  };
}
