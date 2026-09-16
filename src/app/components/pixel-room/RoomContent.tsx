import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, BookOpen, Bookmark, FlaskConical, Coffee, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { listArticles } from '../../content/repository';
import { useDemos } from '../../content/useDemos';
import { useBookmarkLibrary } from '../../content/useBookmarkLibrary';
import { PROFILE } from '../../data/profile';
import type { Post } from '../../data/posts';
import { ZONES, type ZoneId } from './navigation';

export const ZONE_ICONS = { articles: BookOpen, lab: FlaskConical, collections: Bookmark, about: Coffee };
function Message({ children, retry }: { children: React.ReactNode; retry?: () => void }) {
  return <div className="room-empty"><p>{children}</p>{retry && <button onClick={retry}>重新加载</button>}</div>;
}
function Articles() {
  const [posts, setPosts] = useState<Post[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [category, setCategory] = useState('全部'), [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true; setLoading(true); setError(false);
    listArticles().then(items => { if (live) setPosts(items); }).catch(() => { if (live) setError(true); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [revision]);
  if (loading) return <Message>正在翻开文章…</Message>;
  if (error) return <Message retry={() => setRevision(r => r + 1)}>文章暂时无法加载。</Message>;
  const categories = ['全部', ...new Set(posts.map(p => p.category))];
  const filtered = posts.filter(p => category === '全部' || p.category === category);
  return <><div className="room-filters" aria-label="文章分类">{categories.map(c => <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="room-content-list">{filtered.map((p, i) => <Link key={p.id} to={`/post/${encodeURIComponent(p.slug)}`} className="room-content-row"><span className="room-row-index">{String(i + 1).padStart(2, '0')}</span><div><small>{p.category} · {p.readTime} 分钟</small><h3>{p.title}</h3><p>{p.excerpt}</p></div><ArrowUpRight size={19} /></Link>)}</div>
    {!filtered.length && <Message>这个书架还没有文章，稍后再来坐坐。</Message>}
    <Link className="room-all-link" to="/blog">查看全部文章 <ArrowUpRight size={15} /></Link></>;
}
function Projects() {
  const { demos, loading, error, refresh } = useDemos();
  if (loading) return <Message>正在打开妙妙屋…</Message>;
  if (error) return <Message retry={refresh}>{error}</Message>;
  return <><div className="room-content-list">{demos.map((d, i) => <Link to={`/lab?demo=${encodeURIComponent(d.slug)}`} className="room-content-row" key={d.id}><span className="room-row-index">{String(i + 1).padStart(2, '0')}</span><div><small>{d.category} · {d.status === 'live' ? '已上线' : d.status === 'wip' ? '制作中' : '计划中'}</small><h3>{d.title}</h3><p>{d.description}</p></div><ArrowUpRight size={19} /></Link>)}</div>{!demos.length && <Message>新的小实验正在酝酿中。</Message>}<Link to="/lab" className="room-all-link">进入妙妙屋 <ArrowUpRight size={15} /></Link></>;
}
function Collections() {
  const { collections, bookmarks, loading, error, refresh } = useBookmarkLibrary();
  if (loading) return <Message>正在整理收藏柜…</Message>;
  if (error) return <Message retry={refresh}>{error}</Message>;
  return <><div className="room-content-list">{collections.map((c, i) => <Link key={c.id} to={`/collections/${encodeURIComponent(c.id)}`} className="room-content-row"><span className="room-row-index">{String(i + 1).padStart(2, '0')}</span><div><small>{bookmarks.filter(b => b.collection_id === c.id).length} 件收藏</small><h3>{c.name}</h3><p>{c.description || '留住那些值得再看一次的灵感。'}</p></div><ArrowUpRight size={19} /></Link>)}</div>{!collections.length && <Message>收藏柜正在等待新的灵感。</Message>}<Link to="/collections" className="room-all-link">查看全部收藏 <ArrowUpRight size={15} /></Link></>;
}
function About() {
  return <div className="room-about"><img src={PROFILE.portrait} alt="Octopus" /><small>THE PERSON BEHIND THE ROOM</small><h3>嗨，我是 Octopus。</h3><p>开发者，也是生活的观察者。<br />在这里，记录技术、设计和日常里的小小发现。</p><p>写一点代码，做一些有趣的东西。<br />偶尔停下来，让灵感慢慢发生。</p><Link to="/about" className="room-all-link">多了解我一点 <ArrowUpRight size={15} /></Link></div>;
}
export function RoomContent({ active, onClose, onSelect, night, onReturnFocus }: { active: ZoneId | null; onClose: () => void; onSelect: (id: ZoneId) => void; night: boolean; onReturnFocus: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const zone = ZONES.find(z => z.id === active);
  return <Dialog.Root open={!!active} onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="room-dialog-overlay" />
    <Dialog.Content ref={dialogRef} className={`room-dialog ${night ? 'is-night' : 'is-day'}`} onOpenAutoFocus={e => { e.preventDefault(); dialogRef.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={e => { e.preventDefault(); onReturnFocus(); }}>
      <div className="room-dialog-sidebar"><span className="room-mono">ROOM DIRECTORY</span><nav aria-label="房间内容">{ZONES.map(z => { const Icon = ZONE_ICONS[z.id]; return <button key={z.id} aria-current={active === z.id ? 'page' : undefined} onClick={() => onSelect(z.id)}><Icon size={17} /><span>{z.label}</span><small>{z.number}</small></button>; })}</nav><span className="room-sidebar-note">一些记录，<br />一些想法，<br />和一些正在发生的事。</span></div>
      <div className="room-dialog-main"><header><small className="room-mono">{zone?.number} / OCTOPUS'S ROOM</small><Dialog.Title>{zone?.label}</Dialog.Title><Dialog.Description>{zone?.subtitle}，都放在这里。</Dialog.Description></header><div className="room-dialog-scroll" key={active}>{active === 'articles' ? <Articles /> : active === 'lab' ? <Projects /> : active === 'collections' ? <Collections /> : active === 'about' ? <About /> : null}</div></div>
      <Dialog.Close className="room-dialog-close" aria-label="关闭内容，返回小屋"><span>ESC</span><X size={18} /></Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
