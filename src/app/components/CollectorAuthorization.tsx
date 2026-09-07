import { Link, useLocation } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";
import { safeAdminReturnPath } from "../auth/adminSession";
import type { useCollectorAccess } from "../content/useCollectorAccess";

export function CollectorAuthorization({
  device,
}: {
  device: ReturnType<typeof useCollectorAccess>;
}) {
  const { isAdmin, checking } = useAdminAuth();
  const location = useLocation();
  const next = safeAdminReturnPath(
    location.pathname + location.search + location.hash,
  );
  return (
    <section className="bookmark-device-access" aria-label="设备收藏授权">
      <h2>
        {device.access.authorized
          ? "本设备已启用免登录收藏"
          : "在本设备免登录收藏"}
      </h2>
      {device.loading ? (
        <p role="status">正在检查设备授权…</p>
      ) : (
        <>
          <p>
            {device.access.authorized
              ? `有效至 ${new Date(device.access.expiresAt).toLocaleDateString("zh-CN")}。关闭窗口后仍可直接收藏。`
              : "首次登录后启用一次，90 天内点击书签按钮即可收藏。"}
          </p>
          <p className="bookmark-hint">
            授权允许选择收藏箱、新建收藏箱和保存资源。编辑或删除仍需管理员登录；退出管理员账号后，此授权继续有效。
          </p>
          <div className="bookmark-form-actions">
            {isAdmin ? (
              <button
                className="bookmark-button primary"
                disabled={device.busy}
                onClick={device.authorize}
              >
                {device.busy
                  ? "处理中…"
                  : device.access.authorized
                    ? "续期 90 天"
                    : "启用 90 天免登录收藏"}
              </button>
            ) : !checking && !device.access.authorized ? (
              <Link
                className="bookmark-button primary"
                to={`/admin/login?next=${encodeURIComponent(next)}`}
              >
                首次登录并授权
              </Link>
            ) : null}
            {device.access.authorized && (
              <button
                className="bookmark-button"
                disabled={device.busy}
                onClick={() => device.revoke()}
              >
                关闭本设备免登录
              </button>
            )}
            {isAdmin && (
              <button
                className="bookmark-text-button"
                disabled={device.busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "撤销此账号所有设备的免登录收藏授权？其他设备下次收藏时需要重新授权。",
                    )
                  )
                    device.revoke(true);
                }}
              >
                撤销所有设备授权
              </button>
            )}
            {device.error && (
              <button
                className="bookmark-text-button"
                disabled={device.busy}
                onClick={device.refresh}
              >
                重试检查
              </button>
            )}
          </div>
        </>
      )}
      {device.error && (
        <p role="alert" className="bookmark-error">
          {device.error}
        </p>
      )}
      {device.notice && (
        <p role="status" className="bookmark-hint">
          {device.notice}
        </p>
      )}
    </section>
  );
}
