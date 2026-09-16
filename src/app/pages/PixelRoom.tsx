import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownLeft, RotateCcw } from 'lucide-react';
import { useBlog } from '../context/BlogContext';
import { RoomContent } from '../components/pixel-room/RoomContent';
import { createRoomEngine, type RoomEngine, type CatInteractionState } from '../components/pixel-room/engine';
import { ROOM, ZONES, type Point, type ZoneId } from '../components/pixel-room/navigation';
import '../../styles/pixel-room.css';

export default function PixelRoom() {
  const host = useRef<HTMLDivElement>(null), engine = useRef<RoomEngine | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [revision, setRevision] = useState(0), [active, setActive] = useState<ZoneId | null>(null), [near, setNear] = useState<ZoneId | null>(null);
  const [visited, setVisited] = useState<Set<ZoneId>>(new Set());
  const [position, setPosition] = useState<Point>(ROOM.spawn);
  const [cat, setCat] = useState<CatInteractionState | null>(null);
  const [labels, setLabels] = useState<{ id: ZoneId; x: number; y: number }[]>([]);
  const { searchOpen, darkMode } = useBlog();
  const openRef = useRef<(id: ZoneId) => void>(() => { });
  const open = (id: ZoneId) => { engine.current?.pause(true); setActive(id); setVisited(v => new Set(v).add(id)); };
  openRef.current = open;
  const pausedRef = useRef(false); pausedRef.current = !!active || searchOpen;
  // The asynchronous model load must apply the latest shared theme.
  const themeRef = useRef(darkMode); themeRef.current = darkMode;
  useEffect(() => {
    const abort = new AbortController(); let owned: RoomEngine | null = null;
    setStatus('loading'); setLabels([]); setNear(null); setCat(null); setPosition(ROOM.spawn);
    createRoomEngine({
      host: host.current!, signal: abort.signal, onZone: setNear, onOpen: id => openRef.current(id), onPosition: setPosition, onLabels: setLabels, onCat: setCat,
      onFailure: () => { setStatus('error'); engine.current?.pause(true); },
    }).then(instance => {
      if (abort.signal.aborted) { instance.dispose(); return; }
      owned = instance; engine.current = instance; instance.setNight(themeRef.current); instance.pause(pausedRef.current); setStatus('ready');
    }).catch(error => { if (!abort.signal.aborted && error.name !== 'AbortError') setStatus('error'); });
    return () => { abort.abort(); owned?.dispose(); if (engine.current === owned) engine.current = null; };
  }, [revision]);
  useEffect(() => { engine.current?.setNight(darkMode); }, [darkMode]);
  useEffect(() => { engine.current?.pause(!!active || searchOpen); }, [active, searchOpen]);
  const nearby = ZONES.find(z => z.id === near);
  const go = (id: ZoneId) => { if (status === 'ready') engine.current?.goTo(id); else open(id); };
  return <main className={`pixel-room ${darkMode ? 'is-night' : 'is-day'}`}>
    <div className="room-topline"><div className="room-mono"><span className="room-live-dot" /> A LITTLE PLACE ON THE INTERNET</div></div>
    <div className="room-heading"><div></div><p className="room-intro">我是 Octopus。<br />关于技术、灵感与生活，<br />随便走走，总能发现一点什么。</p></div>
    <section className="room-stage" aria-label="可探索的像素房间">
      <div ref={host} className="room-canvas-host" data-testid="room-scene" data-player-x={position.x.toFixed(2)} data-player-z={position.z.toFixed(2)} data-cat-x={cat?.worldX.toFixed(2)} data-cat-z={cat?.worldZ.toFixed(2)} data-cat-action={cat?.phase} data-cat-activity={cat?.activity} data-status={status} />
      {cat?.phase === 'petting' && <span className="room-cat-heart" style={{ left: Math.round(cat.x), top: Math.round(cat.y) }} aria-hidden="true"><PixelHeart /></span>}
      {status === 'ready' && <div className="room-world-labels">{labels.map(label => { const zone = ZONES.find(z => z.id === label.id)!; return <button className={`room-world-label ${near === zone.id ? 'is-near' : ''}`} style={{ left: label.x, top: label.y }} key={zone.id} onClick={() => go(zone.id)} aria-label={`走到${zone.label}`}><span>{zone.number}</span>{zone.label}<i /></button>; })}</div>}
      {status !== 'ready' && <div className="room-loading" role="status">{status === 'loading' ? <><span className="room-loading-pixel" /><h2>正在点亮小屋</h2><p>摆好书本，泡一杯咖啡…</p></> : <><h2>小屋暂时没能打开</h2><p>请重试，或通过顶栏继续浏览内容。</p><div><button onClick={() => setRevision(r => r + 1)}>重新进入</button></div></>}</div>}
      <div className="room-scene-caption"><span className="room-mono">OCTOPUS'S ROOM</span><span>{darkMode ? '夜深了，灯还亮着。' : '阳光刚好，坐一会儿吧。'}</span></div>
      <div className="room-scene-tools"><button onClick={() => engine.current?.reset()} disabled={status !== 'ready'} aria-label="回到房间中央" title="回到房间中央"><RotateCcw size={16} /></button></div>
      <div className="room-explored room-mono">EXPLORED <strong>{String(visited.size).padStart(2, '0')}</strong> / 04</div>
      <div className="room-interact" aria-live="polite">
        {cat?.phase === 'petting' ? <span className="room-cat-response">小黑舒服地眯起了眼睛 · 移动或 Esc 起身</span>
          : cat?.phase === 'approaching' ? <span>走到小黑身边…</span>
          : <>{cat?.near && status === 'ready' && <button onClick={() => engine.current?.petCat()}><kbd>E</kbd><span>蹲下摸摸小黑</span><PixelHeart /></button>}
            {nearby && status === 'ready' && <button onClick={() => open(nearby.id)}>{!cat?.near && <kbd>E</kbd>}<span>浏览{nearby.label}</span><CornerDownLeft size={15} /></button>}
            {!cat?.near && !nearby && <span>点击地面或家具探索 · 点击小黑，走过去摸摸它</span>}</>}
      </div>
      <div className="room-dpad" aria-label="触屏方向控制">{[['w', ArrowUp, '向上走'], ['a', ArrowLeft, '向左走'], ['s', ArrowDown, '向下走'], ['d', ArrowRight, '向右走']].map(([key, Icon, label]) => { const DirectionIcon = Icon as typeof ArrowUp; return <button key={String(key)} className={`room-direction-${key}`} aria-label={String(label)} disabled={status !== 'ready'} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.direction(String(key), true); }} onPointerUp={() => engine.current?.direction(String(key), false)} onPointerCancel={() => engine.current?.direction(String(key), false)} onLostPointerCapture={() => engine.current?.direction(String(key), false)} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); engine.current?.direction(String(key), true); } }} onKeyUp={() => engine.current?.direction(String(key), false)} onBlur={() => engine.current?.direction(String(key), false)}><DirectionIcon size={18} /></button>; })}</div>
    </section>
    <footer className="room-bottom"><div className="room-keyboard-help"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 方向键移动</span><span><kbd>E</kbd> 浏览 / 摸猫</span><span><kbd>ESC</kbd> 返回</span></div><span>慢慢探索，不必着急。</span><Link to="/about">by Octopus <span>✳</span></Link></footer>
    <RoomContent active={active} onSelect={open} onClose={() => setActive(null)} night={darkMode} onReturnFocus={() => host.current?.querySelector('canvas')?.focus({ preventScroll: true })} />
  </main>;
}
function PixelHeart() {
  return <svg className="room-pixel-heart" viewBox="0 0 12 11" width="24" height="22" shapeRendering="crispEdges" aria-hidden="true">
    <path fill="#542b3b" d="M2 0h3v1h2V0h3v1h1v1h1v4h-1v1h-1v1H9v1H8v1H7v1H5v-1H4V9H3V8H2V7H1V6H0V2h1V1h1Z" />
    <path fill="#ef718d" d="M2 1h3v1h2V1h3v1h1v4h-1v1H9v1H8v1H7v1H5V9H4V8H3V7H2V6H1V2h1Z" />
    <path fill="#c84b70" d="M10 3h1v3h-1v1H9v1H8v1H7v1H5V9h2V8h1V7h1V6h1Z" />
    <path fill="#ffd9df" d="M2 2h2v1H3v2H2Z" />
  </svg>;
}
