import { useEffect, useRef, useState, type FormEvent } from "react";
import { Image, Plus, Save, WandSparkles } from "lucide-react";
import {
  emptyBookmark,
  extractBookmarkUrls,
  identifyPlatform,
  parseBookmarkShare,
  PLATFORMS,
  type BookmarkCollection,
  type BookmarkDraft,
  type Bookmark,
} from "../content/bookmarks";
import {
  previewBookmark,
  saveBookmark,
  saveBookmarkCollection,
} from "../content/bookmarkRepository";

const adminActions = {
  save: saveBookmark,
  createCollection: saveBookmarkCollection,
  preview: previewBookmark,
};

export function BookmarkForm({
  collections,
  initial = emptyBookmark(),
  initialText = "",
  bookmarkId,
  onCollectionCreated,
  onSaved,
  onCancel,
  actions = adminActions,
}: {
  collections: BookmarkCollection[];
  initial?: BookmarkDraft;
  initialText?: string;
  bookmarkId?: string;
  onCollectionCreated: (box: BookmarkCollection) => void;
  onSaved: (bookmark: Bookmark) => void;
  onCancel?: () => void;
  actions?: typeof adminActions;
}) {
  const [draft, setDraft] = useState<BookmarkDraft>(initial);
  const [text, setText] = useState(initialText || initial.url);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newBox, setNewBox] = useState("");
  const [newBoxPublic, setNewBoxPublic] = useState(true);
  const [addingBox, setAddingBox] = useState(false);
  const live = useRef(true);
  const busy = useRef(false);
  const boxBusy = useRef(false);
  const suggestedTitle = useRef(
    !bookmarkId &&
      (!initial.title || initial.title === parseBookmarkShare(initialText).title),
  );
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const urls = extractBookmarkUrls(text);
  const set = <K extends keyof BookmarkDraft>(
    key: K,
    value: BookmarkDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const changeText = (value: string) => {
    setText(value);
    setNotice("");
    const share = parseBookmarkShare(value);
    setDraft((current) => ({
      ...current,
      url: share.urls.length === 1 ? share.urls[0] : "",
      title: suggestedTitle.current ? share.title : current.title,
    }));
  };
  const preview = async () => {
    if (!draft.url || previewing) return;
    const original = draft.url;
    setPreviewing(true);
    setError("");
    setNotice("");
    try {
      const metadata = await actions.preview(original);
      if (live.current) {
        setDraft((current) =>
          current.url !== original
            ? current
            : {
                ...current,
                title:
                  metadata.title && suggestedTitle.current
                    ? metadata.title
                    : current.title || metadata.title,
                cover_url: current.cover_url || metadata.cover_url,
              },
        );
        setNotice(
          metadata.cover_url
            ? "读取完成，已补全可读取的信息。保存前请核对。"
            : "已读取标题，未读取到封面；封面选填，可以直接保存。",
        );
      }
    } catch (error) {
      if (live.current)
        setNotice(
          error instanceof Error
            ? error.message
            : "暂时无法读取，可以手动填写后保存。",
        );
    } finally {
      if (live.current) setPreviewing(false);
    }
  };
  const createBox = async () => {
    if (boxBusy.current) return;
    boxBusy.current = true;
    setAddingBox(true);
    setError("");
    try {
      const box = await actions.createCollection({
        name: newBox,
        description: "",
        is_public: newBoxPublic,
        sort_order: 0,
      });
      if (live.current) {
        onCollectionCreated(box);
        set("collection_id", box.id);
        setNewBox("");
        setCreating(false);
      }
    } catch (error) {
      if (live.current)
        setError(error instanceof Error ? error.message : "创建失败，请重试。");
    } finally {
      boxBusy.current = false;
      if (live.current) setAddingBox(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || boxBusy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const bookmark = await actions.save(draft, bookmarkId);
      if (live.current) onSaved(bookmark);
    } catch (error) {
      if (live.current)
        setError(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      busy.current = false;
      if (live.current) setSaving(false);
    }
  };
  return (
    <form className="bookmark-form" onSubmit={submit}>
      <fieldset disabled={saving}>
        <label>
          链接或分享文案
          <textarea
            aria-label="链接或分享文案"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            placeholder="粘贴 bilibili、抖音、小红书、牛客或其他网页的链接，也可以粘贴整段分享文案。"
            rows={3}
            maxLength={6000}
            required
          />
        </label>
        <p className="bookmark-hint">
          输入链接后，点击「读取标题与封面」获取网页信息。支持短链，无需先展开。
        </p>
        {urls.length > 1 && (
          <label>
            文案中有多个链接，请选择
            <select
              aria-label="选择要收藏的链接"
              value={draft.url}
              onChange={(event) => set("url", event.target.value)}
              required
            >
              <option value="">选择一个链接</option>
              {urls.map((url) => (
                <option key={url} value={url}>
                  {url}
                </option>
              ))}
            </select>
          </label>
        )}
        {draft.url && (
          <div className="bookmark-parsed">
            <span>{PLATFORMS[identifyPlatform(draft.url)].label}</span>
            <span>{draft.url}</span>
          </div>
        )}
        <button
          type="button"
          onClick={preview}
          disabled={!draft.url || previewing}
          className="bookmark-button"
        >
          <WandSparkles size={15} />
          {previewing ? "读取中…" : "读取标题与封面"}
        </button>
        {notice && (
          <p role="status" className="bookmark-hint">
            {notice}
          </p>
        )}
        <label>
          标题
          <input
            aria-label="标题"
            value={draft.title}
            onChange={(event) => {
              suggestedTitle.current = false;
              set("title", event.target.value);
            }}
            required
            maxLength={300}
            placeholder="给这条收藏起个容易找到的名字"
          />
        </label>
        <div className="bookmark-field-heading">
          <span>收藏箱</span>
          <button
            type="button"
            onClick={() => setCreating((value) => !value)}
            className="bookmark-text-button"
          >
            <Plus size={13} />
            {creating ? "取消新建" : "新建收藏箱"}
          </button>
        </div>
        <select
          aria-label="收藏箱"
          value={draft.collection_id}
          onChange={(event) => set("collection_id", event.target.value)}
          required
        >
          <option value="">选择收藏箱</option>
          {collections.map((box) => (
            <option key={box.id} value={box.id}>
              {box.name}
              {box.is_public ? "" : "（私密）"}
            </option>
          ))}
        </select>
        {creating && (
          <div className="bookmark-inline-create">
            <input
              aria-label="新收藏箱名称"
              placeholder="新收藏箱名称"
              value={newBox}
              maxLength={80}
              onChange={(event) => setNewBox(event.target.value)}
            />
            <label className="bookmark-check">
              <input
                type="checkbox"
                checked={newBoxPublic}
                onChange={(event) => setNewBoxPublic(event.target.checked)}
              />
              公开这个收藏箱
            </label>
            <button
              type="button"
              onClick={createBox}
              disabled={addingBox || !newBox.trim()}
              className="bookmark-button"
            >
              {addingBox ? "创建中…" : "创建并选中"}
            </button>
          </div>
        )}
        <label>
          <span>
            <Image size={14} /> 封面链接 <small>选填</small>
          </span>
          <input
            aria-label="封面链接"
            value={draft.cover_url}
            onChange={(event) => set("cover_url", event.target.value)}
            maxLength={4096}
            type="url"
            placeholder="https://…"
          />
        </label>
        <label>
          备注 <small>选填</small>
          <textarea
            aria-label="备注"
            value={draft.note}
            onChange={(event) => set("note", event.target.value)}
            maxLength={2000}
            placeholder="为什么收藏它？记下以后会用到的重点。"
            rows={3}
          />
        </label>
        <label className="bookmark-check">
          <input
            type="checkbox"
            checked={draft.is_public}
            onChange={(event) => set("is_public", event.target.checked)}
          />
          在网站上公开这条收藏
        </label>
        {draft.collection_id &&
          collections.find((box) => box.id === draft.collection_id)
            ?.is_public === false && (
            <p className="bookmark-hint">
              当前收藏箱为私密，里面的资源只在管理后台可见。
            </p>
          )}
      </fieldset>
      {error && (
        <p role="alert" className="bookmark-error">
          {error}
        </p>
      )}
      <div className="bookmark-form-actions">
        <button
          disabled={saving || addingBox}
          type="submit"
          className="bookmark-button primary"
        >
          <Save size={16} />
          {saving ? "保存中…" : bookmarkId ? "保存修改" : "保存收藏"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="bookmark-button"
          >
            取消
          </button>
        )}
      </div>
    </form>
  );
}
