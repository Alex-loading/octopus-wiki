import * as Dialog from "@radix-ui/react-dialog";
import { Camera, Images, X } from "lucide-react";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { Link } from "react-router";
import { PageIntro, PageSection } from "../components/PageSection";
import { PhotoImage } from "../components/PhotoImage";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "../components/ui/carousel";
import { formatPhotoTime, photoPaths, type PhotoEntry } from "../content/photos";
import { usePhotoEntries } from "../content/usePhotoEntries";
import { useAdminAuth } from "../context/AdminAuthContext";
import "../../styles/bookmarks.css";
import "../../styles/photos.css";

function PhotoCard({ entry }: { entry: PhotoEntry }) {
  const cover = entry.photos[0];
  const time = formatPhotoTime(entry.occurred_at);
  const photos = entry.photos.map((photo, index) => (
    <CarouselItem key={photo.id} aria-label={`第 ${index + 1} 张，共 ${entry.photos.length} 张`}>
      <PhotoImage source={photoPaths(entry.id, photo.id).full} alt={`第 ${index + 1} 张照片`} lazy />
    </CarouselItem>
  ));

  return (
    <article className="photo-card" data-photo-entry={entry.id}>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button type="button" className="photo-card-button">
            <span className="photo-card-cover">
              <PhotoImage source={photoPaths(entry.id, cover.id).thumbnail} alt="" lazy
                style={{ aspectRatio: `${cover.width} / ${cover.height}` }} />
              {entry.photos.length > 1 && <span className="photo-card-count"><Images size={14} aria-hidden />{entry.photos.length} 张</span>}
            </span>
            <span className="photo-card-copy">
              {entry.caption && <span className="photo-card-caption">{entry.caption}</span>}
              <time dateTime={entry.occurred_at}>{time}</time>
            </span>
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="photo-dialog-overlay" />
          <Dialog.Content className="photo-dialog-content">
            <Dialog.Title className="sr-only">{time}的日常照片</Dialog.Title>
            <Dialog.Description className="sr-only">使用左右方向键或滑动切换照片。</Dialog.Description>
            <Dialog.Close className="photo-dialog-close" aria-label="关闭照片浏览"><X size={22} /></Dialog.Close>
            <div className="photo-dialog-body">
              <Carousel className="photo-carousel" aria-label="这条记录的照片">
                <CarouselContent>{photos}</CarouselContent>
                {entry.photos.length > 1 && <>
                  <CarouselPrevious className="photo-carousel-previous" aria-label="上一张照片" />
                  <CarouselNext className="photo-carousel-next" aria-label="下一张照片" />
                </>}
              </Carousel>
              <div className="photo-dialog-meta">
                {entry.caption && <p>{entry.caption}</p>}
                <time dateTime={entry.occurred_at}>{time}</time>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}

export function Photos({ darkMode }: { darkMode: boolean }) {
  const feed = usePhotoEntries();
  const auth = useAdminAuth();

  return (
    <PageSection darkMode={darkMode} className="bookmark-page">
      <PageIntro darkMode={darkMode} icon={Camera} label="生活片段" title="日常"
        description={<>用照片记下生活里的小事。{feed.total !== null && <> 共 {feed.total} 条日常记录。</>}</>}
        action={auth.isAdmin && <Link to="/admin/photos" className="bookmark-button">照片管理</Link>} />
      {feed.entries.length > 0 && (
        <ResponsiveMasonry columnsCountBreakPoints={{ 0: 2, 800: 3 }} gutterBreakPoints={{ 0: "12px", 640: "22px" }}>
          <Masonry sequential>{feed.entries.map(entry => <PhotoCard key={entry.id} entry={entry} />)}</Masonry>
        </ResponsiveMasonry>
      )}
      <div className="photo-feed-actions">
        {feed.loading && <p role="status">正在加载日常照片…</p>}
        {feed.error && <p role="alert">日常照片读取失败。{feed.error}</p>}
        {!feed.loading && !feed.error && !feed.entries.length && <p>还没有公开的日常记录。</p>}
        {!feed.loading && (feed.hasMore || feed.error) && (
          <button type="button" className="bookmark-button" onClick={feed.error ? feed.retry : feed.loadMore}>
            {feed.error ? "重试" : "查看更多"}
          </button>
        )}
      </div>
    </PageSection>
  );
}
