// No runtime caching: administrator sessions and private resources stay on the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate" || event.request.method !== "GET")
    return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>暂时离线 · Octopus 收藏箱</title><style>body{font-family:system-ui;background:#f7f8fc;color:#192033;max-width:440px;margin:18vh auto;padding:24px;line-height:1.8}h1{font-size:28px;font-weight:400}p{color:#737b8f}button{background:#6366f1;color:white;border:0;border-radius:9px;padding:12px 20px;cursor:pointer}</style></head><body><h1>暂时离线</h1><p>收藏尚未保存。恢复网络后重新加载，即可继续接收当前分享。</p><button onclick="location.reload()">重新加载</button></body></html>`,
          {
            status: 503,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          },
        ),
    ),
  );
});
