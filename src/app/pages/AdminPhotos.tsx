import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Plus, Upload, X } from "lucide-react";
import { Link } from "react-router";
import { BookmarkAdminGate, BookmarkLayout } from "../components/BookmarkUI";
import { PhotoImage } from "../components/PhotoImage";
import { savePhotoEntry, uploadPhoto } from "../content/photoRepository";
import {
  formatPhotoTime, PHOTO_CAPTION_LIMIT, photoEntryValues, photoLocalTime, photoPaths,
  type Photo, type PhotoEntry,
} from "../content/photos";
import { PHOTO_ACCEPT, preparePhoto, type PreparedPhoto } from "../content/preparePhoto";
import { usePhotoEntries } from "../content/usePhotoEntries";
import "../../styles/photos.css";

type EditorPhoto = { photo: Photo; file?: PreparedPhoto };

function PhotoEditor({ entry, onCancel, onSaved }: {
  entry: PhotoEntry | null;
  onCancel(): void;
  onSaved(message: string): void;
}) {
  const [id] = useState(() => entry?.id ?? crypto.randomUUID());
  const [caption, setCaption] = useState(entry?.caption ?? "");
  const [time, setTime] = useState(() => photoLocalTime(entry ? new Date(entry.occurred_at) : undefined));
  const [isPublic, setIsPublic] = useState(entry?.is_public ?? true);
  const [images, setImages] = useState<EditorPhoto[]>(() => entry?.photos.map(photo => ({ photo })) ?? []);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const running = useRef(false);
  const uploaded = useRef(new Set<string>());

  async function addPhotos(files: File[]) {
    if (running.current || !files.length) return;
    running.current = true;
    setError("");
    const failures: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        setBusy(`正在处理照片 ${index + 1} / ${files.length}…`);
        try {
          const prepared = await preparePhoto(file);
          setImages(current => [...current, { photo: prepared.photo, file: prepared }]);
        } catch (failure) {
          failures.push(`${file.name} · ${failure instanceof Error ? failure.message : "无法读取照片。"}`);
        }
      }
      if (failures.length) setError(failures.join("\n"));
    } finally {
      running.current = false;
      setBusy("");
    }
  }

  function dropPhotos(event: DragEvent<HTMLLabelElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(false);
    void addPhotos(Array.from(event.dataTransfer.files));
  }

  function movePhoto(index: number, offset: number) {
    setImages(current => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current) return;
    running.current = true;
    setError("");
    try {
      const values = photoEntryValues(caption, time, images.map(image => image.photo), isPublic);
      const pending = images.flatMap(image => image.file && !uploaded.current.has(image.photo.id) ? [image.file] : []);
      for (const [index, file] of pending.entries()) {
        setBusy(`正在上传照片 ${index + 1} / ${pending.length}…`);
        await uploadPhoto(id, file);
        uploaded.current.add(file.photo.id);
      }
      setBusy("正在保存记录…");
      await savePhotoEntry(id, values, entry?.revision);
      onSaved(entry ? "修改已保存。" : isPublic ? "记录已发布。" : "私密记录已保存。");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "无法保存照片记录。");
    } finally {
      running.current = false;
      setBusy("");
    }
  }

  return (
    <form className="photo-editor" onSubmit={submit}>
      <h2>{entry ? "编辑记录" : "新建记录"}</h2>
      <div className="photo-editor-fields">
        <label>
          <span>配文</span>
          <textarea placeholder="记下当时的片段" value={caption} maxLength={PHOTO_CAPTION_LIMIT} rows={3}
            onChange={event => setCaption(event.target.value)} disabled={Boolean(busy)} />
        </label>
        <label>
          <span>记录时间</span>
          <input type="datetime-local" value={time} required onChange={event => setTime(event.target.value)} disabled={Boolean(busy)} />
        </label>
        <label>
          <span>可见性</span>
          <select value={isPublic ? "public" : "private"} onChange={event => setIsPublic(event.target.value === "public")}
            disabled={Boolean(busy)}>
            <option value="public">公开</option>
            <option value="private">仅管理员可见</option>
          </select>
        </label>
      </div>
      <label className="photo-dropzone" data-dragging={dragging} aria-disabled={Boolean(busy)}
        onDragOver={event => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = busy ? "none" : "copy";
          if (!busy) setDragging(true);
        }}
        onDragLeave={event => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false);
        }}
        onDrop={dropPhotos}>
        <input type="file" className="sr-only" aria-label="选择照片" accept={PHOTO_ACCEPT} multiple disabled={Boolean(busy)}
          onChange={event => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            void addPhotos(files);
          }} />
        <Upload size={21} aria-hidden />
        <strong>选择照片</strong>
        <span>可以选择多张照片，也可以拖入照片</span>
      </label>
      {images.length > 0 && <ol className="photo-editor-images" aria-label="照片顺序">
        {images.map(({ photo, file }, index) => (
          <li key={photo.id} data-ordered-photo={photo.id}>
            <div className="photo-editor-preview">
              <PhotoImage source={file?.thumbnail ?? photoPaths(id, photo.id).thumbnail} alt={`第 ${index + 1} 张照片`} />
              {index === 0 && <span>首图</span>}
            </div>
            <div className="photo-editor-image-actions">
              <button type="button" aria-label={`将第 ${index + 1} 张照片前移`} disabled={Boolean(busy) || index === 0}
                onClick={() => movePhoto(index, -1)}><ArrowLeft size={16} /></button>
              <button type="button" aria-label={`将第 ${index + 1} 张照片后移`} disabled={Boolean(busy) || index === images.length - 1}
                onClick={() => movePhoto(index, 1)}><ArrowRight size={16} /></button>
              <button type="button" aria-label={`移除第 ${index + 1} 张照片`} disabled={Boolean(busy)}
                onClick={() => setImages(current => current.filter(image => image.photo.id !== photo.id))}><X size={16} /></button>
            </div>
          </li>
        ))}
      </ol>}
      {busy && <p role="status">{busy}</p>}
      {error && <p role="alert" className="photo-editor-error">{error}</p>}
      <div className="photo-editor-actions">
        <button type="submit" className="bookmark-button primary" disabled={Boolean(busy) || !images.length}>
          {entry ? "保存修改" : isPublic ? "发布" : "保存私密记录"}
        </button>
        <button type="button" className="bookmark-button" onClick={onCancel} disabled={Boolean(busy)}>取消</button>
      </div>
    </form>
  );
}

function PhotoManagement() {
  const records = usePhotoEntries(true);
  const [editing, setEditing] = useState<PhotoEntry | null>();
  const [notice, setNotice] = useState("");

  function edit(entry: PhotoEntry | null) {
    setNotice("");
    setEditing(entry);
  }

  return (
    <div className="photo-management">
      <header className="bookmark-heading">
        <div>
          <p className="bookmark-eyebrow">OCTOPUS / ADMIN</p>
          <h1>照片管理</h1>
          {records.total !== null && <p>共 {records.total} 条日常记录</p>}
        </div>
        <Link to="/photos" className="bookmark-button">查看日常</Link>
      </header>
      {notice && <p role="status" className="photo-management-notice">{notice}</p>}
      {editing !== undefined ? <PhotoEditor entry={editing} onCancel={() => {
        setEditing(undefined);
        void records.reload();
      }} onSaved={message => {
        setEditing(undefined);
        setNotice(message);
        void records.reload();
      }} /> : <>
        <button type="button" className="bookmark-button primary" onClick={() => edit(null)} disabled={records.loading || Boolean(records.error)}>
          <Plus size={17} aria-hidden />新建记录
        </button>
        <ul className="photo-records" aria-label="日常记录列表">
          {records.entries.map(entry => (
            <li key={entry.id}>
              {entry.photos[0] && <PhotoImage alt="" source={photoPaths(entry.id, entry.photos[0].id).thumbnail} lazy />}
              <div className="photo-record-copy">
                {entry.caption && <p>{entry.caption}</p>}
                <time dateTime={entry.occurred_at}>{formatPhotoTime(entry.occurred_at)}</time>
              </div>
              <span className="photo-record-visibility" data-public={entry.is_public}>{entry.is_public ? "公开" : "私密"}</span>
              <button type="button" className="bookmark-button" onClick={() => edit(entry)} disabled={records.loading}>编辑</button>
            </li>
          ))}
        </ul>
        {records.loading && <p role="status">正在加载记录…</p>}
        {records.error && <p role="alert">记录读取失败。{records.error}</p>}
        {!records.loading && !records.error && !records.entries.length && <p>还没有日常记录。</p>}
        {!records.loading && (records.hasMore || records.error) && <button type="button" className="bookmark-button"
          onClick={records.error ? records.retry : records.loadMore}>{records.error ? "重试" : "查看更多"}</button>}
      </>}
    </div>
  );
}

export function AdminPhotos({ darkMode }: { darkMode: boolean }) {
  return <BookmarkLayout darkMode={darkMode}>
    <BookmarkAdminGate managementPath="/admin/photos" label="照片"><PhotoManagement /></BookmarkAdminGate>
  </BookmarkLayout>;
}
