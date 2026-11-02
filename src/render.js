// 탑뷰 공장 바닥 렌더 (캔버스). 시뮬 상태를 읽기만 한다.
import * as D from './data.js?v=1.3.0';
import { DX, DY, tile, machineDef, machinePerMin, inputPerMin } from './sim.js?v=1.3.0';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const R = {
    canvas, ctx, T: 40, ox: 0, oy: 0, scrollY: 0, panX: 0, zoom: 1, w: 0, h: 0, dpr: 1, t: 0,
    sprites: new Map(), spriteT: 0,
    floats: [], smokes: [], shakes: new Map(),
    hover: null, ghost: null,
  };

  R.resize = () => {
    const rect = canvas.getBoundingClientRect();
    R.dpr = Math.min(3, window.devicePixelRatio || 1);
    R.w = rect.width; R.h = rect.height;
    canvas.width = Math.round(rect.width * R.dpr);
    canvas.height = Math.round(rect.height * R.dpr);
  };

  R.layout = (s) => {
    const pad = 14;
    const base = Math.min((R.w - pad * 2) / s.floor.cols, 64);
    const T = Math.max(12, Math.floor(base * R.zoom));
    if (T !== R.T) { R.T = T; R.sprites.clear(); }
    const contentW = T * s.floor.cols + pad * 2;
    R.maxPanX = Math.max(0, contentW - R.w);
    R.panX = Math.max(0, Math.min(R.maxPanX, R.panX));
    R.ox = contentW <= R.w ? Math.round((R.w - T * s.floor.cols) / 2) : pad - R.panX;
    const top = R.topInset || 0;
    const avail = R.h - top;
    const contentH = T * s.floor.rows + pad * 2;
    R.maxScroll = Math.max(0, contentH - avail);
    R.scrollY = Math.max(0, Math.min(R.maxScroll, R.scrollY));
    R.oy = top + (contentH < avail ? Math.round((avail - T * s.floor.rows) / 2) : pad - R.scrollY);
  };

  /** (px,py) 화면 지점을 고정한 채로 확대/축소 */
  R.zoomAt = (s, factor, px, py) => {
    R.layout(s);
    const wx = (px - R.ox) / R.T, wy = (py - R.oy) / R.T;
    R.zoom = Math.max(1, Math.min(3, R.zoom * factor));
    R.layout(s);
    R.panX += R.ox + wx * R.T - px;
    R.scrollY += R.oy + wy * R.T - py;
    R.layout(s);
  };
  R.pan = (dx, dy) => { R.panX -= dx; R.scrollY -= dy; };
  R.fit = () => { R.zoom = 1; R.panX = 0; R.scrollY = 0; };

  R.toTile = (s, px, py) => {
    const x = Math.floor((px - R.ox) / R.T);
    const y = Math.floor((py - R.oy) / R.T);
    if (x < 0 || y < 0 || x >= s.floor.cols || y >= s.floor.rows) return null;
    return { x, y };
  };

  R.tileCenter = (x, y) => ({ cx: R.ox + (x + 0.5) * R.T, cy: R.oy + (y + 0.5) * R.T });

  // ---------- 연출 이벤트 소비 ----------
  R.consumeFx = (s) => {
    for (const f of s.fx) {
      if (f.type === 'deliver') {
        const { cx, cy } = R.tileCenter(f.x, f.y);
        R.floats.push({ x: cx, y: cy - R.T * 0.3, text: '+1', color: '#2E9E6B', life: 0.8, max: 0.8, small: true });
      } else if (f.type === 'defect') {
        const { cx, cy } = R.tileCenter(f.x, f.y);
        R.floats.push({ x: cx, y: cy - R.T * 0.4, text: '불량', color: '#D9534F', life: 1.1, max: 1.1, small: true });
      } else if (f.type === 'break') {
        R.shakes.set(`${f.x},${f.y}`, 0.6);
      } else if (f.type === 'truck') {
        R.floats.push({ banner: true, text: `🚚 ${D.ITEMS[f.item].name} 출하 +${Math.round(f.value / 10000).toLocaleString('ko-KR')}만`, life: 2.4, max: 2.4, color: f.late ? '#E9B44C' : '#2E9E6B' });
      }
    }
    s.fx.length = 0;
  };

  // ---------- 스프라이트 ----------
  function itemSprite(it) {
    const key = it;
    if (R.sprites.has(key)) return R.sprites.get(key);
    const size = Math.round(R.T * 0.42 * R.dpr);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const def = D.ITEMS[it];
    g.fillStyle = def.color;
    roundRect(g, 0.5, 0.5, size - 1, size - 1, size * 0.22); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = Math.max(1, size * 0.06); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(size * 0.15, size * 0.14, size * 0.7, size * 0.1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (def.final) { g.font = `${Math.round(size * 0.62)}px sans-serif`; g.fillText(def.icon, size / 2, size / 2 + size * 0.04); }
    else { g.fillStyle = 'rgba(20,24,30,.75)'; g.font = `bold ${Math.round(size * 0.6)}px sans-serif`; g.fillText(def.icon, size / 2, size / 2 + size * 0.03); }
    R.sprites.set(key, c);
    return c;
  }

  // ---------- 그리기 ----------
  R.draw = (s, dt, ui) => {
    R.t += dt;
    R.topInset = ui.buildMode ? 44 : (s.quest != null && s.quest < D.QUESTS.length ? 52 : 0);
    R.layout(s);
    const { T } = R;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    ctx.clearRect(0, 0, R.w, R.h);

    // 벽·바닥
    const fx0 = R.ox, fy0 = R.oy, fw = T * s.floor.cols, fh = T * s.floor.rows;
    ctx.fillStyle = '#2B2F36';
    roundRect(ctx, fx0 - 8, fy0 - 8, fw + 16, fh + 16, 10); ctx.fill();
    ctx.fillStyle = '#D8D4CB';
    ctx.fillRect(fx0, fy0, fw, fh);
    // 바닥 무늬
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= s.floor.cols; x++) { ctx.moveTo(fx0 + x * T + 0.5, fy0); ctx.lineTo(fx0 + x * T + 0.5, fy0 + fh); }
    for (let y = 0; y <= s.floor.rows; y++) { ctx.moveTo(fx0, fy0 + y * T + 0.5); ctx.lineTo(fx0 + fw, fy0 + y * T + 0.5); }
    ctx.stroke();
    // 안전선 (테두리 노랑)
    ctx.strokeStyle = 'rgba(233,180,76,.55)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
    ctx.strokeRect(fx0 + 3, fy0 + 3, fw - 6, fh - 6); ctx.setLineDash([]);

    const buildMode = ui.buildMode;
    if (buildMode) {
      ctx.strokeStyle = 'rgba(42,157,143,.25)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= s.floor.cols; x++) { ctx.moveTo(fx0 + x * T + 0.5, fy0); ctx.lineTo(fx0 + x * T + 0.5, fy0 + fh); }
      for (let y = 0; y <= s.floor.rows; y++) { ctx.moveTo(fx0, fy0 + y * T + 0.5); ctx.lineTo(fx0 + fw, fy0 + y * T + 0.5); }
      ctx.stroke();
    }

    // 1패스: 벨트·분배기 바탕
    for (let y = 0; y < s.floor.rows; y++) for (let x = 0; x < s.floor.cols; x++) {
      const t = tile(s, x, y);
      if (!t) continue;
      if (t.k === 'belt') drawBelt(x, y, t, s);
      else if (t.k === 'split') drawSplitter(x, y, t);
    }
    // 2패스: 벨트 위 상자
    for (let y = 0; y < s.floor.rows; y++) for (let x = 0; x < s.floor.cols; x++) {
      const t = tile(s, x, y);
      if (!t) continue;
      if (t.k === 'belt') for (const it of t.items) drawItemOnBelt(x, y, t.dir, it.p, it.it);
      else if (t.k === 'split' && t.hold) {
        const d = t.hold.p < 0.5 ? (t.hold.from ?? t.dir) : t.dir;
        drawItemOnBelt(x, y, d, 0.15 + t.hold.p * 0.35, t.hold.it);
      }
    }
    // 3패스: 건물
    for (let y = 0; y < s.floor.rows; y++) for (let x = 0; x < s.floor.cols; x++) {
      const t = tile(s, x, y);
      if (!t) continue;
      if (t.k === 'machine') drawMachine(x, y, t, s);
      else if (t.k === 'input') drawInput(x, y, t);
      else if (t.k === 'output') drawOutput(x, y, s);
    }

    // 선택 · 고스트
    if (ui.selected) {
      const { x, y } = ui.selected;
      ctx.strokeStyle = '#2A9D8F'; ctx.lineWidth = 3;
      roundRect(ctx, R.ox + x * T + 1.5, R.oy + y * T + 1.5, T - 3, T - 3, 6); ctx.stroke();
    }
    if (buildMode && R.ghost) drawGhost(R.ghost, s);

    // 연기
    updateSmoke(dt);

    // 밤
    if (s.phase === 'night') {
      const k = Math.min(1, (D.TIME.nightRealSec - s.nightLeft) / 0.35, s.nightLeft / 0.35);
      ctx.fillStyle = `rgba(12,18,34,${0.55 * Math.max(0, k)})`;
      ctx.fillRect(0, 0, R.w, R.h);
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Jua, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('🌙 퇴근', R.w / 2, R.h / 2);
      ctx.globalAlpha = 1;
    }

    // 떠오르는 글자
    drawFloats(dt);
  };

  function drawBelt(x, y, t, s) {
    const { T } = R;
    const px = R.ox + x * T, py = R.oy + y * T;
    const inset = T * 0.14;
    const horiz = t.dir === 0 || t.dir === 2;
    ctx.fillStyle = '#3A3F47';
    if (horiz) ctx.fillRect(px, py + inset, T, T - inset * 2);
    else ctx.fillRect(px + inset, py, T - inset * 2, T);
    // 레일
    ctx.fillStyle = '#5A616B';
    if (horiz) { ctx.fillRect(px, py + inset, T, 2); ctx.fillRect(px, py + T - inset - 2, T, 2); }
    else { ctx.fillRect(px + inset, py, 2, T); ctx.fillRect(px + T - inset - 2, py, 2, T); }
    // 연결: 앞 칸이 벨트가 아니면 끝을 살짝 표시
    // 화살표 무늬 (움직임)
    const moving = !t.jam && s.phase === 'work';
    const off = moving ? (R.t * D.LOGISTICS.beltSpeed) % 1 : 0.5;
    ctx.save();
    ctx.beginPath();
    if (horiz) ctx.rect(px, py + inset, T, T - inset * 2); else ctx.rect(px + inset, py, T - inset * 2, T);
    ctx.clip();
    ctx.strokeStyle = t.jam ? 'rgba(217,83,79,.55)' : 'rgba(255,255,255,.18)';
    ctx.lineWidth = Math.max(1.5, T * 0.05);
    for (let k = -1; k < 2; k++) {
      const f = (k + off) / 1.0; // 칸당 1개
      const a = f * T;
      ctx.beginPath();
      const cx = px + T / 2, cy = py + T / 2, w = T * 0.18;
      if (t.dir === 0) { const xx = px + a; ctx.moveTo(xx - w, cy - w); ctx.lineTo(xx, cy); ctx.lineTo(xx - w, cy + w); }
      if (t.dir === 2) { const xx = px + T - a; ctx.moveTo(xx + w, cy - w); ctx.lineTo(xx, cy); ctx.lineTo(xx + w, cy + w); }
      if (t.dir === 1) { const yy = py + a; ctx.moveTo(cx - w, yy - w); ctx.lineTo(cx, yy); ctx.lineTo(cx + w, yy - w); }
      if (t.dir === 3) { const yy = py + T - a; ctx.moveTo(cx - w, yy + w); ctx.lineTo(cx, yy); ctx.lineTo(cx + w, yy + w); }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSplitter(x, y, t) {
    const { T } = R;
    const px = R.ox + x * T, py = R.oy + y * T;
    ctx.fillStyle = '#3A3F47';
    roundRect(ctx, px + T * 0.1, py + T * 0.1, T * 0.8, T * 0.8, T * 0.12); ctx.fill();
    ctx.fillStyle = '#E9B44C';
    const outs = [t.dir, (t.dir + 1) % 4, (t.dir + 3) % 4];
    for (const d of outs) {
      const cx = px + T / 2 + DX[d] * T * 0.3, cy = py + T / 2 + DY[d] * T * 0.3;
      tri(cx, cy, d, T * 0.11);
    }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `bold ${Math.round(T * 0.22)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('분배', px + T / 2, py + T / 2);
  }

  function drawItemOnBelt(x, y, dir, p, it) {
    const { T } = R;
    const cx = R.ox + (x + 0.5) * T + DX[dir] * (p - 0.5) * T;
    const cy = R.oy + (y + 0.5) * T + DY[dir] * (p - 0.5) * T;
    const sp = itemSprite(it);
    const sz = T * 0.42;
    ctx.drawImage(sp, cx - sz / 2, cy - sz / 2, sz, sz);
  }

  function drawMachine(x, y, m, s) {
    const { T } = R;
    const def = machineDef(m);
    const type = D.MACHINE_TYPES[def.type];
    let px = R.ox + x * T, py = R.oy + y * T;
    const sk = R.shakes.get(`${x},${y}`);
    if (sk > 0) { px += Math.sin(R.t * 60) * 2; R.shakes.set(`${x},${y}`, sk - 1 / 60); }
    const pad = T * 0.06;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    roundRect(ctx, px + pad + 1, py + pad + 3, T - pad * 2, T - pad * 2, T * 0.16); ctx.fill();
    // 몸체
    const working = m.status === 'work' && s.phase === 'work';
    ctx.fillStyle = m.broken ? '#8B4A47' : type.color;
    roundRect(ctx, px + pad, py + pad, T - pad * 2, T - pad * 2, T * 0.16); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    roundRect(ctx, px + pad, py + pad, T - pad * 2, (T - pad * 2) * 0.35, T * 0.16); ctx.fill();
    if (def.auto) { ctx.strokeStyle = '#E9B44C'; ctx.lineWidth = 2; roundRect(ctx, px + pad + 1, py + pad + 1, T - pad * 2 - 2, T - pad * 2 - 2, T * 0.15); ctx.stroke(); }
    // 출구 표시
    ctx.fillStyle = '#F6F5F2';
    tri(px + T / 2 + DX[m.dir] * T * 0.36, py + T / 2 + DY[m.dir] * T * 0.36, m.dir, T * 0.09);
    // 아이콘 (작동 중이면 살짝 흔들림)
    const bob = working ? Math.sin(R.t * 14 + x * 3 + y) * T * 0.025 : 0;
    ctx.font = `${Math.round(T * 0.42)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = ['starved', 'no_worker', 'no_recipe', 'off'].includes(m.status) ? 0.55 : 1;
    ctx.fillText(type.icon, px + T / 2, py + T / 2 - T * 0.04 + bob);
    ctx.globalAlpha = 1;
    // 분당 처리량
    if (m.recipe && !m.broken) {
      const pm = machinePerMin(s, m);
      ctx.font = `bold ${Math.max(8, Math.round(T * 0.19))}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const txt = pm > 0 ? `${pm < 10 ? pm.toFixed(1) : Math.round(pm)}/분` : '';
      if (txt) {
        const tw = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, px + pad + 1, py + pad + 1, tw + 6, T * 0.23, 4); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(txt, px + pad + 4, py + pad + 2);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    }
    // 생산 진행
    if (m.crafting && !m.broken) {
      ctx.strokeStyle = '#7CE0C3'; ctx.lineWidth = Math.max(2, T * 0.06);
      ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2 - T * 0.04, T * 0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * m.prog); ctx.stroke();
    }
    // 용접·열처리 불꽃
    if (working && (def.type === 'weld' || def.type === 'heat') && Math.random() < 0.35) {
      R.smokes.push({ x: px + T * (0.3 + Math.random() * 0.4), y: py + T * 0.4, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, life: 0.35, max: 0.35, spark: true, color: def.type === 'weld' ? '#FFE08A' : '#FF9A5A' });
    }
    // 상태 바 (아래)
    const bw = T - pad * 4, bh = Math.max(2, T * 0.06);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + pad * 2, py + T - pad * 2 - bh, bw, bh);
    ctx.fillStyle = m.cond > 60 ? '#7CD992' : m.cond > 40 ? '#E9B44C' : '#FF6B5E';
    ctx.fillRect(px + pad * 2, py + T - pad * 2 - bh, bw * m.cond / 100, bh);
    // 작업자
    if (!def.auto && m.worker) {
      const wx = px + T * 0.82, wy = py + T * 0.2 + (working ? Math.sin(R.t * 8 + x) * 1.2 : 0);
      ctx.fillStyle = '#F2C9A4'; ctx.beginPath(); ctx.arc(wx, wy + T * 0.04, T * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F2B632'; ctx.beginPath(); ctx.arc(wx, wy, T * 0.1, Math.PI, 0); ctx.fill();
      ctx.fillRect(wx - T * 0.12, wy - 1, T * 0.24, T * 0.035);
    }
    // 배지
    const badge = m.broken ? (m.repairLeft > 0 ? '🛠️' : '⚠️') : m.serviceLeft > 0 ? '🛠️' : m.status === 'off' ? '⏹' : m.status === 'no_worker' ? '👷' : m.status === 'no_recipe' ? '❔' : m.status === 'blocked' ? '⏸' : null;
    if (badge) {
      const bx = px + T * 0.8, by = py + T * 0.18;
      ctx.fillStyle = m.broken ? '#D9534F' : 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.arc(bx, by, T * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${Math.round(T * 0.2)}px sans-serif`; ctx.fillStyle = '#000';
      ctx.fillText(badge, bx, by + 1);
      if (m.broken && m.repairLeft <= 0 && Math.random() < 0.25) {
        R.smokes.push({ x: px + T * 0.5 + (Math.random() - 0.5) * T * 0.3, y: py + T * 0.3, vx: (Math.random() - 0.5) * 8, vy: -14, life: 1.4, max: 1.4, r: T * 0.12 });
      }
    }
    // 부족한 재료 표시 (작게)
    if (m.status === 'starved' && m.recipe) {
      const need = Object.keys(D.RECIPES[m.recipe].in).find((it) => (m.inBuf[it] || 0) < D.RECIPES[m.recipe].in[it]);
      if (need) {
        const sp = itemSprite(need); const sz = T * 0.26;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(R.t * 4);
        ctx.drawImage(sp, px + T * 0.1, py + T * 0.56, sz, sz);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawInput(x, y, t) {
    const { T } = R;
    const px = R.ox + x * T, py = R.oy + y * T;
    ctx.fillStyle = t.on ? '#2F6F9E' : '#6B7785';
    roundRect(ctx, px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, T * 0.14); ctx.fill();
    ctx.fillStyle = '#F6F5F2'; tri(px + T / 2 + DX[t.dir] * T * 0.36, py + T / 2 + DY[t.dir] * T * 0.36, t.dir, T * 0.09);
    if (t.item) { const sp = itemSprite(t.item); const sz = T * 0.38; ctx.drawImage(sp, px + T / 2 - sz / 2, py + T * 0.18, sz, sz); }
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(T * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.starved ? '돈 없음' : t.on ? `${Math.round(inputPerMin())}/분` : '꺼짐', px + T / 2, py + T * 0.76);
  }

  function drawOutput(x, y, s) {
    const { T } = R;
    const px = R.ox + x * T, py = R.oy + y * T;
    ctx.fillStyle = '#2E8B5E';
    roundRect(ctx, px + T * 0.06, py + T * 0.06, T * 0.88, T * 0.88, T * 0.14); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(px + T * 0.18, py + T * 0.2, T * 0.64, T * 0.06);
    ctx.font = `${Math.round(T * 0.34)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('📦', px + T / 2, py + T * 0.42);
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(T * 0.2)}px sans-serif`;
    ctx.fillText('출하', px + T / 2, py + T * 0.78);
  }

  function drawGhost(g, s) {
    const { T } = R;
    const px = R.ox + g.x * T, py = R.oy + g.y * T;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = g.valid ? '#2A9D8F' : '#D9534F';
    roundRect(ctx, px + 2, py + 2, T - 4, T - 4, 6); ctx.fill();
    ctx.globalAlpha = 1;
    if (g.dir != null) { ctx.fillStyle = '#fff'; tri(px + T / 2 + DX[g.dir] * T * 0.25, py + T / 2 + DY[g.dir] * T * 0.25, g.dir, T * 0.14); }
  }

  function updateSmoke(dt) {
    for (const p of R.smokes) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = Math.max(0, p.life / p.max);
      if (p.spark) { ctx.fillStyle = p.color; ctx.globalAlpha = a; ctx.fillRect(p.x, p.y, 2, 2); }
      else { ctx.fillStyle = `rgba(90,90,95,${0.45 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - a), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    R.smokes = R.smokes.filter((p) => p.life > 0);
    if (R.smokes.length > 220) R.smokes.splice(0, R.smokes.length - 220);
  }

  function drawFloats(dt) {
    let bannerY = 12;
    for (const f of R.floats) {
      f.life -= dt;
      const a = Math.max(0, Math.min(1, f.life / f.max * 2));
      ctx.globalAlpha = a;
      if (f.banner) {
        ctx.font = 'bold 14px Jua, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(f.text).width + 24;
        ctx.fillStyle = 'rgba(255,255,255,.95)';
        roundRect(ctx, R.w / 2 - w / 2, bannerY, w, 28, 14); ctx.fill();
        ctx.fillStyle = f.color; ctx.fillText(f.text, R.w / 2, bannerY + 15);
        bannerY += 34;
      } else {
        f.y -= dt * 22;
        ctx.font = `bold ${f.small ? 11 : 14}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
    R.floats = R.floats.filter((f) => f.life > 0);
  }

  function tri(cx, cy, dir, r) {
    ctx.beginPath();
    const a = [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a + 2.4) * r, cy + Math.sin(a + 2.4) * r);
    ctx.lineTo(cx + Math.cos(a - 2.4) * r, cy + Math.sin(a - 2.4) * r);
    ctx.closePath(); ctx.fill();
  }

  return R;
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
