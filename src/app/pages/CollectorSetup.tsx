import { useRef, useEffect, useState } from "react";
import { Link } from "react-router";
import { Bookmark, Smartphone, Copy } from "lucide-react";
import { BookmarkLayout } from "../components/BookmarkUI";
import { createBookmarklet } from "../content/bookmarks";
import { CollectorAuthorization } from "../components/CollectorAuthorization";
import { useCollectorAccess } from "../content/useCollectorAccess";

export function CollectorSetup({ darkMode }: { darkMode: boolean }) {
  const device = useCollectorAccess();
  const anchor = useRef<HTMLAnchorElement>(null);
  const [copied, setCopied] = useState("");
  const bookmarklet = createBookmarklet(window.location.origin);
  // This is a user-installable bookmarklet, not a script executed by a React click.
  useEffect(() => {
    anchor.current?.setAttribute("href", bookmarklet);
  }, [bookmarklet]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      setCopied("已复制。创建浏览器书签后，将代码粘贴到网址栏。");
    } catch {
      setCopied("无法自动复制，请选中下方代码手动复制。");
    }
  };
  return (
    <BookmarkLayout darkMode={darkMode}>
      <div className="bookmark-collector">
        <header className="bookmark-heading">
          <div>
            <p className="bookmark-eyebrow">COLLECT FROM ANYWHERE</p>
            <h1>让收藏顺手一点。</h1>
            <p>电脑点一下，手机分享过来，再选一个收藏箱。</p>
          </div>
        </header>
        <CollectorAuthorization device={device} />
        <section className="bookmark-setup-section">
          <h2>电脑 · 书签栏快捷收藏</h2>
          <p>
            把下面的按钮拖到浏览器书签栏。浏览网页时点击它，即可带着原链接、标题和可读取的封面打开收藏表单。
          </p>
          <div className="bookmark-form-actions">
            <a
              ref={anchor}
              draggable
              className="bookmark-button primary"
              onClick={(event) => {
                event.preventDefault();
                setCopied("请将按钮拖到书签栏；或复制代码手动创建书签。");
              }}
            >
              <Bookmark size={15} />
              收藏到 Octopus
            </a>
            <button onClick={copy} className="bookmark-button">
              <Copy size={14} />
              复制书签代码
            </button>
          </div>
          {copied && (
            <p role="status" className="bookmark-hint">
              {copied}
            </p>
          )}
          <details>
            <summary className="bookmark-text-button">查看书签代码</summary>
            <textarea
              aria-label="书签代码"
              readOnly
              rows={5}
              value={bookmarklet}
              onFocus={(event) => event.target.select()}
            />
          </details>
          <p className="bookmark-hint">
            部分页面会限制书签脚本，遇到这种情况可复制链接后打开收藏入口。
          </p>
        </section>
        <section className="bookmark-setup-section">
          <h2>Android · 分享到收藏箱</h2>
          <ol>
            <li>在支持安装网站应用的浏览器中打开本站，例如 Android Chrome。</li>
            <li>
              从浏览器菜单选择「安装应用」或相应的安装入口，安装 Octopus
              收藏箱。
            </li>
            <li>
              打开安装好的应用，在快捷收藏设置中登录管理员邮箱。去邮箱复制验证码，切回本应用输入，验证后点击「启用 90 天免登录收藏」。
            </li>
            <li>在原 App 打开系统分享菜单，选择「Octopus 收藏箱」。</li>
            <li>核对链接，选择或新建收藏箱，点击保存。</li>
          </ol>
          <p>
            需要原 App 提供系统分享入口，且浏览器支持 Web Share
            Target。若分享列表中找不到它，先复制分享文案，再打开下方收藏入口粘贴。
          </p>
          <p className="bookmark-hint">
            分享只会预填表单，保存后才会产生收藏。需要联网；手机 PWA
            和浏览器若不共享站点数据，需要分别启用一次免登录收藏。
          </p>
        </section>
        <section className="bookmark-setup-section">
          <h2>iPhone · 预留快捷指令入口</h2>
          <p>
            现有粘贴入口可以直接使用。若希望从系统分享菜单打开，可在「快捷指令」中创建以下流程：
          </p>
          <ol>
            <li>启用「在共享表单中显示」，接收 URL 和文本。</li>
            <li>将接收到的内容转为文本，使用「URL 编码」。</li>
            <li>
              拼接 <code>{window.location.origin}/collect?text=</code>{" "}
              和编码后的文本。
            </li>
            <li>使用「打开 URL」打开结果，在网页中选择收藏箱后保存。</li>
          </ol>
          <p className="bookmark-hint">
            这是接入步骤，未提供已安装或经真机验证的快捷指令。没有系统分享入口的
            App 可以复制链接后粘贴。
          </p>
        </section>
        <section className="bookmark-setup-section">
          <h2>随时可用 · 粘贴收藏</h2>
          <p>
            支持原链接，也支持
            bilibili、抖音、小红书、牛客等平台的整段分享文案。封面和标题读取失败时，可手动填写。
          </p>
          <div className="bookmark-form-actions">
            <Link to="/collect" className="bookmark-button primary">
              <Smartphone size={16} />
              打开收藏入口
            </Link>
            <Link to="/collections" className="bookmark-button">
              浏览收藏箱
            </Link>
          </div>
        </section>
      </div>
    </BookmarkLayout>
  );
}
