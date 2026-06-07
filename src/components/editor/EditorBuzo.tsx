'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { guardarVariante } from '@/lib/firestore';

// ═══════════════════════════════════════════════════════════
// TIPOS Y CONSTANTES — Portado de hoodie-editor.html
// ═══════════════════════════════════════════════════════════

type ModelType = 'pullover' | 'cierre';
type ViewType = 'f' | 'e' | 'b'; // frente, espalda, ambos

interface PieceDef {
  id: string;
  n: string;
  c: string;
  icon: string;
  opt?: boolean;
}

interface OverlayElement {
  id: string;
  type: 'text' | 'image';
  face: 'f' | 'e';
  name: string;
  icon: string;
  x: number;
  y: number;
  // Propiedades de texto
  content?: string;
  font?: string;
  fontSize?: number;
  color?: string;
  // Propiedades de imagen
  src?: string;
  imgWidth?: number;
  // Comunes
  opacity: number;
  rotation: number;
}

// ── Definición de piezas por modelo ──────────────────────────
const PIECES: Record<ModelType, PieceDef[]> = {
  pullover: [
    { id: 'cuerpo',  n: 'Cuerpo',           c: '#e0e0e0', icon: '👕' },
    { id: 'manga_l', n: 'Manga izquierda',  c: '#d0d0d0', icon: '💪' },
    { id: 'manga_r', n: 'Manga derecha',    c: '#d0d0d0', icon: '💪' },
    { id: 'cuff_l',  n: 'Puño izquierdo',   c: '#b0b0b0', icon: '🔘' },
    { id: 'cuff_r',  n: 'Puño derecho',     c: '#b0b0b0', icon: '🔘' },
    { id: 'waist',   n: 'Cinto inferior',   c: '#b0b0b0', icon: '⬛' },
    { id: 'hood_o',  n: 'Capucha exterior', c: '#c8c8c8', icon: '🎭', opt: true },
    { id: 'hood_i',  n: 'Capucha interior', c: '#a0a0a0', icon: '⬜', opt: true },
    { id: 'pocket',  n: 'Bolsillo canguro', c: '#c0c0c0', icon: '🟫', opt: true },
    { id: 'cord_l',  n: 'Cordón izquierdo', c: '#666666', icon: '〰️', opt: true },
    { id: 'cord_r',  n: 'Cordón derecho',   c: '#666666', icon: '〰️', opt: true },
  ],
  cierre: [
    { id: 'cuerpo_l', n: 'Cuerpo izq',       c: '#e0e0e0', icon: '👕' },
    { id: 'cuerpo_r', n: 'Cuerpo der',       c: '#e0e0e0', icon: '👕' },
    { id: 'manga_l',  n: 'Manga izquierda',  c: '#d0d0d0', icon: '💪' },
    { id: 'manga_r',  n: 'Manga derecha',    c: '#d0d0d0', icon: '💪' },
    { id: 'cuff_l',   n: 'Puño izquierdo',   c: '#b0b0b0', icon: '🔘' },
    { id: 'cuff_r',   n: 'Puño derecho',     c: '#b0b0b0', icon: '🔘' },
    { id: 'waist',    n: 'Cinto inferior',   c: '#b0b0b0', icon: '⬛' },
    { id: 'hood_o',   n: 'Capucha exterior', c: '#c8c8c8', icon: '🎭', opt: true },
    { id: 'hood_i',   n: 'Capucha interior', c: '#a0a0a0', icon: '⬜', opt: true },
    { id: 'pocket',   n: 'Bolsillo',         c: '#c0c0c0', icon: '🟫', opt: true },
    { id: 'zipper',   n: 'Cremallera',       c: '#999999', icon: '⚙️' },
  ],
};

// ── Paleta de colores ─────────────────────────────────────────
const COLORS = [
  '#f5f5f5','#e0e0e0','#bdbdbd','#9e9e9e','#616161','#212121',
  '#b71c1c','#e53935','#ef9a9a','#ff8f00','#ffb300','#fdd835',
  '#558b2f','#2e7d32','#1b5e20','#0d47a1','#1565c0','#42a5f5',
  '#4a148c','#6a1b9a','#880e4f','#c2185b','#f06292','#4e342e',
  '#00695c','#00796b','#004d40','#bf360c','#d84315','#ff7043',
];

const FONTS = [
  { id: 'sans',  label: 'Sans',  font: "'Inter', sans-serif" },
  { id: 'block', label: 'Block', font: "'Impact', 'Arial Black', sans-serif" },
  { id: 'serif', label: 'Serif', font: 'Georgia, serif' },
  { id: 'mono',  label: 'Mono',  font: "'Courier New', monospace" },
];

// ── Orden de dibujado de piezas ──────────────────────────────
const DRAW_ORDER = [
  'manga_l','manga_r','cuff_l','cuff_r',
  'cuerpo','cuerpo_l','cuerpo_r',
  'hood_o','hood_i',
  'pocket','cord_l','cord_r','zipper',
  'waist',
];

// ═══════════════════════════════════════════════════════════
// FUNCIONES DE DIBUJO — Canvas 2D (portado de hoodie-editor.html)
// ═══════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getShapes(model: ModelType, face: 'f' | 'e'): Record<string, any> {
  const W = 340, H = 420;
  const cx = W / 2;
  // Cuerpo
  const bodyTop = 148, bodyBot = 340;
  const bodyL = 82, bodyR = W - 82;
  // Sisa
  const armholeL = 95, armholeR = W - 95;
  const armholeY = bodyTop + 10;
  // Mangas
  const sleeveTopL = 82, sleeveTopR = W - 82;
  const sleeveOutL = 8, sleeveOutR = W - 8;
  const sleeveMidL = 18, sleeveMidR = W - 18;
  const sleeveBotL = 32, sleeveBotR = W - 32;
  const sleeveTopY = bodyTop + 8;
  const sleeveMidY = bodyTop + 120;
  const sleeveBotY = bodyTop + 180;
  const cuffTopY = sleeveBotY, cuffBotY = sleeveBotY + 26;
  // Cuello
  const neckL = 140, neckR = W - 140;
  const neckTop = bodyTop;
  // Capucha
  const hoodTop = 12;
  const hoodL = 72, hoodR = W - 72;
  // Capucha interior
  const hiL = 135, hiR = W - 135;
  const hiTop = 68, hiBot = bodyTop + 4;
  // Bolsillo
  const pktL = 118, pktR = W - 118;
  const pktTop = 240, pktBot = 318;
  // Cinto
  const wTop = bodyBot, wBot = bodyBot + 32;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapes: Record<string, any> = {};

  if (face === 'f') {
    // Mangas
    shapes['manga_l'] = {
      type: 'poly',
      pts: [[sleeveTopL,sleeveTopY],[sleeveOutL,sleeveTopY+28],[sleeveMidL,sleeveMidY],[sleeveBotL,sleeveBotY],[sleeveBotL+22,sleeveBotY],[armholeL,armholeY]],
      stroke: '#333', sw: 2.2,
    };
    shapes['manga_r'] = {
      type: 'poly',
      pts: [[sleeveTopR,sleeveTopY],[sleeveOutR,sleeveTopY+28],[sleeveMidR,sleeveMidY],[sleeveBotR,sleeveBotY],[sleeveBotR-22,sleeveBotY],[armholeR,armholeY]],
      stroke: '#333', sw: 2.2,
    };
    // Puños
    shapes['cuff_l'] = {
      type: 'poly',
      pts: [[sleeveBotL,cuffTopY],[sleeveBotL+24,cuffTopY],[sleeveBotL+22,cuffBotY],[sleeveBotL+2,cuffBotY]],
      stroke: '#333', sw: 2, ribs: [cuffTopY+9, cuffTopY+18],
    };
    shapes['cuff_r'] = {
      type: 'poly',
      pts: [[sleeveBotR,cuffTopY],[sleeveBotR-24,cuffTopY],[sleeveBotR-22,cuffBotY],[sleeveBotR-2,cuffBotY]],
      stroke: '#333', sw: 2, ribs: [cuffTopY+9, cuffTopY+18],
    };
    // Cuerpo
    shapes['cuerpo'] = {
      type: 'body_f',
      bodyL, bodyR, bodyTop, bodyBot, armholeL, armholeR, armholeY,
      neckL, neckR, neckTop, neckBot: neckTop + 14,
      stroke: '#333', sw: 2.2,
    };
    // Capucha exterior
    shapes['hood_o'] = {
      type: 'hood_f', hoodL, hoodR, hoodBase: bodyTop, hoodTop, cx, neckL, neckR,
      stroke: '#333', sw: 2.2,
    };
    // Capucha interior
    shapes['hood_i'] = {
      type: 'hood_inner', hiL, hiR, hiTop, hiBot, cx,
      stroke: '#555', sw: 1.5,
    };
    // Bolsillo
    shapes['pocket'] = {
      type: 'pocket', pktL, pktR, pktTop, pktBot, cx,
      stroke: '#333', sw: 2,
    };
    // Cordones
    shapes['cord_l'] = {
      type: 'cord', x1: cx-28, y1: hiBot+2, x2: cx-38, y2: pktTop-10,
      stroke: '#555', sw: 4,
    };
    shapes['cord_r'] = {
      type: 'cord', x1: cx+28, y1: hiBot+2, x2: cx+38, y2: pktTop-10,
      stroke: '#555', sw: 4,
    };
    // Cinto
    shapes['waist'] = {
      type: 'waist', x: bodyL, y: wTop, w: bodyR-bodyL, h: wBot-wTop,
      stroke: '#333', sw: 2, ribs: [wTop+11, wTop+22],
    };
    // Modelo con cierre
    if (model === 'cierre') {
      shapes['cuerpo_l'] = { ...shapes['cuerpo'], type: 'body_fl' };
      shapes['cuerpo_r'] = { ...shapes['cuerpo'], type: 'body_fr' };
      delete shapes['cuerpo'];
      shapes['zipper'] = { type: 'zipper', x: cx, y: bodyTop, h: bodyBot-bodyTop, stroke: '#888', sw: 2 };
      delete shapes['cord_l'];
      delete shapes['cord_r'];
    }
  } else {
    // ── Vista espalda ──
    shapes['manga_l'] = {
      type: 'poly',
      pts: [[sleeveTopL,sleeveTopY],[sleeveOutL,sleeveTopY+28],[sleeveMidL,sleeveMidY],[sleeveBotL,sleeveBotY],[sleeveBotL+22,sleeveBotY],[armholeL,armholeY]],
      stroke: '#333', sw: 2.2,
    };
    shapes['manga_r'] = {
      type: 'poly',
      pts: [[sleeveTopR,sleeveTopY],[sleeveOutR,sleeveTopY+28],[sleeveMidR,sleeveMidY],[sleeveBotR,sleeveBotY],[sleeveBotR-22,sleeveBotY],[armholeR,armholeY]],
      stroke: '#333', sw: 2.2,
    };
    shapes['cuff_l'] = { type:'poly', pts:[[sleeveBotL,cuffTopY],[sleeveBotL+24,cuffTopY],[sleeveBotL+22,cuffBotY],[sleeveBotL+2,cuffBotY]], stroke:'#333', sw:2, ribs:[cuffTopY+9,cuffTopY+18] };
    shapes['cuff_r'] = { type:'poly', pts:[[sleeveBotR,cuffTopY],[sleeveBotR-24,cuffTopY],[sleeveBotR-22,cuffBotY],[sleeveBotR-2,cuffBotY]], stroke:'#333', sw:2, ribs:[cuffTopY+9,cuffTopY+18] };
    shapes['cuerpo'] = { type:'body_e', bodyL, bodyR, bodyTop, bodyBot, armholeL, armholeR, armholeY, stroke:'#333', sw:2.2 };
    shapes['cuerpo_l'] = shapes['cuerpo'];
    shapes['cuerpo_r'] = shapes['cuerpo'];
    shapes['hood_o'] = { type:'hood_e', hoodL, hoodR, hoodBase:bodyTop, hoodTop, cx, stroke:'#333', sw:2.2 };
    shapes['waist'] = { type:'waist', x:bodyL, y:wTop, w:bodyR-bodyL, h:wBot-wTop, stroke:'#333', sw:2, ribs:[wTop+11,wTop+22] };
  }
  return shapes;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawShape(ctx: CanvasRenderingContext2D, shape: any, color: string, selected: boolean) {
  if (!shape || !color) return;
  ctx.save();
  if (selected) { ctx.shadowColor = 'rgba(192,160,96,0.7)'; ctx.shadowBlur = 14; }

  if (shape.type === 'poly') {
    ctx.beginPath();
    ctx.moveTo(shape.pts[0][0], shape.pts[0][1]);
    for (let i = 1; i < shape.pts.length; i++) ctx.lineTo(shape.pts[i][0], shape.pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke || '#333'; ctx.lineWidth = shape.sw || 2;
    ctx.lineJoin = 'round'; ctx.stroke();
    if (shape.ribs) {
      ctx.save(); ctx.clip();
      shape.ribs.forEach((y: number) => {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(400, y);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      });
      ctx.restore();
    }
  }
  else if (shape.type === 'body_f') {
    const { bodyL, bodyR, bodyBot, armholeL, armholeR, armholeY, neckL, neckR, neckTop } = shape;
    ctx.beginPath();
    ctx.moveTo(armholeL, armholeY); ctx.lineTo(bodyL, bodyBot); ctx.lineTo(bodyR, bodyBot);
    ctx.lineTo(armholeR, armholeY); ctx.lineTo(neckR, neckTop);
    ctx.bezierCurveTo(neckR, neckTop+10, neckL, neckTop+10, neckL, neckTop);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.lineJoin = 'round'; ctx.stroke();
    // Costuras laterales
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bodyL, shape.bodyTop+30); ctx.lineTo(bodyL, bodyBot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bodyR, shape.bodyTop+30); ctx.lineTo(bodyR, bodyBot); ctx.stroke();
    ctx.restore();
  }
  else if (shape.type === 'body_fl') {
    const { bodyL, bodyR, bodyBot, armholeL, armholeY, neckL, neckTop } = shape;
    const ccx = bodyL + (bodyR - bodyL) / 2;
    ctx.beginPath();
    ctx.moveTo(armholeL, armholeY); ctx.lineTo(bodyL, bodyBot); ctx.lineTo(ccx, bodyBot);
    ctx.lineTo(ccx, neckTop); ctx.lineTo(neckL, neckTop);
    ctx.bezierCurveTo(neckL, neckTop+10, armholeL, armholeY+4, armholeL, armholeY);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.lineJoin = 'round'; ctx.stroke();
  }
  else if (shape.type === 'body_fr') {
    const { bodyL, bodyR, bodyBot, armholeR, armholeY, neckR, neckTop } = shape;
    const ccx = bodyL + (bodyR - bodyL) / 2;
    ctx.beginPath();
    ctx.moveTo(armholeR, armholeY); ctx.lineTo(bodyR, bodyBot); ctx.lineTo(ccx, bodyBot);
    ctx.lineTo(ccx, neckTop); ctx.lineTo(neckR, neckTop);
    ctx.bezierCurveTo(neckR, neckTop+10, armholeR, armholeY+4, armholeR, armholeY);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.lineJoin = 'round'; ctx.stroke();
  }
  else if (shape.type === 'body_e') {
    const { bodyL, bodyR, bodyBot, armholeL, armholeR, armholeY } = shape;
    ctx.beginPath();
    ctx.moveTo(armholeL, armholeY); ctx.lineTo(bodyL, bodyBot); ctx.lineTo(bodyR, bodyBot);
    ctx.lineTo(armholeR, armholeY); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.lineJoin = 'round'; ctx.stroke();
    // Costura central espalda
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo((armholeL+armholeR)/2, armholeY); ctx.lineTo((bodyL+bodyR)/2, bodyBot); ctx.stroke();
    ctx.restore();
  }
  else if (shape.type === 'hood_f') {
    const { hoodL, hoodR, hoodBase, hoodTop: ht, cx, neckL, neckR } = shape;
    ctx.beginPath();
    ctx.moveTo(neckL, hoodBase);
    ctx.bezierCurveTo(hoodL, hoodBase-20, hoodL-10, ht+40, cx-60, ht+12);
    ctx.bezierCurveTo(cx-20, ht, cx+20, ht, cx+60, ht+12);
    ctx.bezierCurveTo(hoodR+10, ht+40, hoodR, hoodBase-20, neckR, hoodBase);
    ctx.bezierCurveTo(neckR, hoodBase+8, neckL, hoodBase+8, neckL, hoodBase);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.lineJoin = 'round'; ctx.stroke();
    // Costura central capucha
    ctx.save(); ctx.setLineDash([5,4]); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, ht+4); ctx.lineTo(cx, hoodBase+6); ctx.stroke();
    ctx.restore();
  }
  else if (shape.type === 'hood_inner') {
    const { hiL, hiR, hiTop: ht, hiBot, cx } = shape;
    ctx.beginPath();
    ctx.moveTo(hiL, hiBot);
    ctx.bezierCurveTo(hiL, hiBot-12, cx-20, ht+2, cx, ht);
    ctx.bezierCurveTo(cx+20, ht+2, hiR, hiBot-12, hiR, hiBot);
    ctx.bezierCurveTo(hiR, hiBot+8, hiL, hiBot+8, hiL, hiBot);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.stroke();
  }
  else if (shape.type === 'hood_e') {
    const { hoodL, hoodR, hoodBase, hoodTop: ht, cx } = shape;
    ctx.beginPath();
    ctx.moveTo(hoodL, hoodBase);
    ctx.bezierCurveTo(hoodL, hoodBase-20, hoodL-10, ht+40, cx-60, ht+12);
    ctx.bezierCurveTo(cx-20, ht, cx+20, ht, cx+60, ht+12);
    ctx.bezierCurveTo(hoodR+10, ht+40, hoodR, hoodBase-20, hoodR, hoodBase);
    ctx.bezierCurveTo(hoodR, hoodBase+8, hoodL, hoodBase+8, hoodL, hoodBase);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.stroke();
    // Pliegues capucha espalda
    ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    [[cx, ht+4, cx, hoodBase], [cx-30, ht+22, cx-20, hoodBase], [cx+30, ht+22, cx+20, hoodBase]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
    ctx.restore();
  }
  else if (shape.type === 'pocket') {
    const { pktL, pktR, pktTop, pktBot, cx } = shape;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(pktL+r, pktTop); ctx.lineTo(pktR-r, pktTop);
    ctx.quadraticCurveTo(pktR, pktTop, pktR, pktTop+r);
    ctx.lineTo(pktR, pktBot-r); ctx.quadraticCurveTo(pktR, pktBot, pktR-r, pktBot);
    ctx.lineTo(pktL+r, pktBot); ctx.quadraticCurveTo(pktL, pktBot, pktL, pktBot-r);
    ctx.lineTo(pktL, pktTop+r); ctx.quadraticCurveTo(pktL, pktTop, pktL+r, pktTop);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.stroke();
    // Costuras bolsillo
    ctx.save(); ctx.setLineDash([5,3]); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
    const m = 5;
    ctx.beginPath(); ctx.roundRect(pktL+m, pktTop+m, pktR-pktL-m*2, pktBot-pktTop-m*2, 4); ctx.stroke();
    ctx.restore();
    // División central
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, pktTop+2); ctx.lineTo(cx, pktBot-2); ctx.stroke();
    ctx.restore();
  }
  else if (shape.type === 'cord') {
    const { x1, y1, x2, y2 } = shape;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(x1-6, y1+40, x2-4, y2-30, x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = shape.sw || 4;
    ctx.lineCap = 'round'; ctx.stroke();
    // Agujeta metálica
    ctx.fillStyle = '#c0c0c0';
    ctx.beginPath(); ctx.roundRect(x2-4, y2, 8, 14, 4); ctx.fill();
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.stroke();
  }
  else if (shape.type === 'waist') {
    const { x, y, w, h } = shape;
    ctx.beginPath();
    ctx.moveTo(x,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.sw; ctx.stroke();
    if (shape.ribs) shape.ribs.forEach((ry: number) => {
      ctx.save(); ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
      ctx.beginPath(); ctx.moveTo(x,ry); ctx.lineTo(x+w,ry);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
  }
  else if (shape.type === 'zipper') {
    const { x, y, h } = shape;
    ctx.fillStyle = color; ctx.fillRect(x-3, y, 6, h);
    ctx.strokeStyle = '#777'; ctx.lineWidth = 1; ctx.strokeRect(x-3, y, 6, h);
    ctx.save(); ctx.setLineDash([3,2]); ctx.strokeStyle = 'rgba(100,100,100,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y+8); ctx.lineTo(x, y+h-10); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#ccc'; ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x-5, y+h-24, 10, 18, 3); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

// ── Hit test para detectar qué pieza se hizo clic ──────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hitTest(shapes: Record<string, any>, x: number, y: number, ctx: CanvasRenderingContext2D): string | null {
  const keys = Object.keys(shapes).reverse();
  for (const key of keys) {
    const sh = shapes[key];
    if (!sh) continue;
    if (sh.type === 'poly') {
      ctx.beginPath(); ctx.moveTo(sh.pts[0][0], sh.pts[0][1]);
      for (let i = 1; i < sh.pts.length; i++) ctx.lineTo(sh.pts[i][0], sh.pts[i][1]);
      ctx.closePath(); if (ctx.isPointInPath(x, y)) return key;
    } else if (sh.type === 'waist') {
      if (x >= sh.x && x <= sh.x+sh.w && y >= sh.y && y <= sh.y+sh.h) return key;
    } else if (sh.type === 'cord') {
      const mnx = Math.min(sh.x1,sh.x2)-8, mxx = Math.max(sh.x1,sh.x2)+8;
      const mny = Math.min(sh.y1,sh.y2),    mxy = Math.max(sh.y1,sh.y2)+16;
      if (x >= mnx && x <= mxx && y >= mny && y <= mxy) return key;
    } else if (sh.type === 'zipper') {
      if (Math.abs(x-sh.x) < 8 && y >= sh.y && y <= sh.y+sh.h) return key;
    } else {
      // Bounding box aproximado para formas bezier
      const bb = getApproxBBox(sh);
      if (bb && x >= bb.x && x <= bb.x+bb.w && y >= bb.y && y <= bb.y+bb.h) return key;
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getApproxBBox(sh: any) {
  if (sh.type === 'body_f' || sh.type === 'body_fl' || sh.type === 'body_fr' || sh.type === 'body_e')
    return { x: sh.bodyL, y: sh.bodyTop, w: sh.bodyR-sh.bodyL, h: sh.bodyBot-sh.bodyTop };
  if (sh.type === 'hood_f' || sh.type === 'hood_e')
    return { x: sh.hoodL-20, y: sh.hoodTop, w: (sh.hoodR-sh.hoodL)+40, h: sh.hoodBase-sh.hoodTop+10 };
  if (sh.type === 'hood_inner')
    return { x: sh.hiL, y: sh.hiTop, w: sh.hiR-sh.hiL, h: sh.hiBot-sh.hiTop+10 };
  if (sh.type === 'pocket')
    return { x: sh.pktL, y: sh.pktTop, w: sh.pktR-sh.pktL, h: sh.pktBot-sh.pktTop };
  return null;
}

// ═══════════════════════════════════════════════════════════
// COMPONENTE REACT
// ═══════════════════════════════════════════════════════════

interface EditorBuzoProps {
  cursoId: string;
  variantId: string | null;
  autorUid: string;
  autorNombre: string;
  canvasInicial?: string;
  cantidadVariantes: number;
  onGuardado?: (nuevoId: string) => void;
}

export default function EditorBuzo({
  cursoId, variantId, autorUid, autorNombre, canvasInicial,
  cantidadVariantes, onGuardado,
}: EditorBuzoProps) {
  const canvasFRef = useRef<HTMLCanvasElement>(null);
  const canvasERef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const variantIdRef = useRef<string | null>(variantId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shapesRef = useRef<{ f: Record<string, any>; e: Record<string, any> }>({ f: {}, e: {} });

  const [model, setModel]         = useState<ModelType>('pullover');
  const [view, setView]           = useState<ViewType>('f');
  const [selPiece, setSelPiece]   = useState<string | null>(null);
  const [pc, setPc]               = useState<Record<string, string>>({});
  const [pon, setPon]             = useState<Record<string, boolean>>({});
  const [elements, setElements]   = useState<OverlayElement[]>([]);
  const [activeEl, setActiveEl]   = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);

  // Texto
  const [textoInput, setTextoInput]   = useState('');
  const [fontSel, setFontSel]         = useState(FONTS[0].font);
  const [fontSize, setFontSize]       = useState(24);
  const [textColor, setTextColor]     = useState('#ffffff');
  const [customColor, setCustomColor] = useState('#222222');

  // ── Inicializar colores por defecto de las piezas ──────────
  const initColors = useCallback((m: ModelType) => {
    const newPc: Record<string, string> = {};
    const newPon: Record<string, boolean> = {};
    PIECES[m].forEach(p => {
      newPc[p.id] = p.c;
      newPon[p.id] = true;
    });
    setPc(newPc);
    setPon(newPon);
  }, []);

  // ── Renderizar Canvas ──────────────────────────────────────
  const render = useCallback(() => {
    const faces: ('f' | 'e')[] = ['f', 'e'];
    faces.forEach(face => {
      const cv = face === 'f' ? canvasFRef.current : canvasERef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Sombra bajo el buzo
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
      ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(60, 100, 220, 300); ctx.restore();

      const shapes = getShapes(model, face);
      if (face === 'f') shapesRef.current.f = shapes;
      else shapesRef.current.e = shapes;

      const pieces = PIECES[model];
      DRAW_ORDER.forEach(pid => {
        const pdef = pieces.find(p => p.id === pid);
        if (!pdef) return;
        if (pon[pid] === false) return;
        const shape = shapes[pid];
        if (!shape) return;
        const col = pc[pid] || pdef.c;
        drawShape(ctx, shape, col, selPiece === pid);
      });
    });
  }, [model, pc, pon, selPiece]);

  // ── Inicializar ────────────────────────────────────────────
  useEffect(() => {
    if (canvasInicial) {
      try {
        const saved = JSON.parse(canvasInicial);
        if (saved.model) setModel(saved.model);
        if (saved.pc) setPc(saved.pc);
        if (saved.pon) setPon(saved.pon);
        if (saved.elements) setElements(saved.elements);
        return;
      } catch { /* si falla, usar colores por defecto */ }
    }
    initColors(model);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-renderizar al cambiar el estado ─────────────────────
  useEffect(() => { render(); }, [render]);

  // ── Configurar clic en canvas para seleccionar piezas ──────
  useEffect(() => {
    const handleClick = (face: 'f' | 'e') => (e: MouseEvent) => {
      const cv = face === 'f' ? canvasFRef.current : canvasERef.current;
      if (!cv) return;
      const rect = cv.getBoundingClientRect();
      const scaleX = cv.width / rect.width, scaleY = cv.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX, y = (e.clientY - rect.top) * scaleY;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const shapes = face === 'f' ? shapesRef.current.f : shapesRef.current.e;
      const hit = hitTest(shapes, x, y, ctx);
      if (hit) setSelPiece(hit);
    };

    const hf = handleClick('f');
    const he = handleClick('e');
    canvasFRef.current?.addEventListener('click', hf);
    canvasERef.current?.addEventListener('click', he);
    return () => {
      canvasFRef.current?.removeEventListener('click', hf);
      canvasERef.current?.removeEventListener('click', he);
    };
  }, []);

  // ── Guardado automático ────────────────────────────────────
  const triggerGuardadoAuto = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const json = JSON.stringify({ model, pc, pon, elements });
        const id = await guardarVariante(cursoId, variantIdRef.current, json, autorUid, autorNombre);
        variantIdRef.current = id;
        onGuardado?.(id);
      } catch { /* silencioso */ }
    }, 2000);
  }, [model, pc, pon, elements, cursoId, autorUid, autorNombre, onGuardado]);

  useEffect(() => { triggerGuardadoAuto(); }, [pc, pon, elements, triggerGuardadoAuto]);

  // ── Acciones ───────────────────────────────────────────────
  const applyColor = (col: string) => {
    if (!selPiece) { toast.error('Seleccioná una pieza primero'); return; }
    setPc(prev => ({ ...prev, [selPiece]: col }));
  };

  const togglePiece = (pid: string) => {
    setPon(prev => ({ ...prev, [pid]: !prev[pid] }));
  };

  const switchModel = (m: ModelType) => {
    setModel(m); setSelPiece(null);
    initColors(m);
  };

  const addText = () => {
    if (!textoInput.trim()) { toast.error('Escribí el texto'); return; }
    const face = view === 'e' ? 'e' : 'f';
    const el: OverlayElement = {
      id: `el${Date.now()}`, type: 'text', face,
      name: textoInput.slice(0, 16), icon: '✏️',
      x: 90, y: 160,
      content: textoInput, font: fontSel, fontSize, color: textColor,
      opacity: 1, rotation: 0,
    };
    setElements(prev => [...prev, el]);
    setActiveEl(el.id);
    setTextoInput('');
  };

  const handleImgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error('El logo no puede superar 500KB'); return; }
    setSubiendoLogo(true);
    try {
      const logoRef = storageRef(storage, `logos/${cursoId}/${autorUid}/${file.name}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      const face = view === 'e' ? 'e' : 'f';
      const el: OverlayElement = {
        id: `el${Date.now()}`, type: 'image', face,
        name: file.name.slice(0, 16), icon: '🖼',
        x: 110, y: 190, src: url, imgWidth: 70,
        opacity: 1, rotation: 0,
      };
      setElements(prev => [...prev, el]);
      setActiveEl(el.id);
      toast.success('Logo subido exitosamente');
    } catch { toast.error('Error al subir el logo'); }
    finally { setSubiendoLogo(false); }
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (activeEl === id) setActiveEl(null);
  };

  const guardarManual = async () => {
    if (!variantIdRef.current && cantidadVariantes >= 3) {
      toast.error('Podés guardar máximo 3 variantes propias'); return;
    }
    setGuardando(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      const json = JSON.stringify({ model, pc, pon, elements });
      const id = await guardarVariante(cursoId, variantIdRef.current, json, autorUid, autorNombre);
      variantIdRef.current = id;
      onGuardado?.(id);
      toast.success('¡Variante guardada!');
    } catch { toast.error('Error al guardar la variante'); }
    finally { setGuardando(false); }
  };

  const exportFicha = () => {
    const ps = PIECES[model].filter(p => pon[p.id] !== false);
    let f = `=== FICHA TÉCNICA ===\nModelo: ${model === 'pullover' ? 'Pullover' : 'Con cierre'}\n\nCOLORES:\n`;
    ps.forEach(p => { f += `  · ${p.n}: ${pc[p.id] || p.c}\n`; });
    f += `\nELEMENTOS:\n`;
    elements.forEach(el => { f += `  · ${el.type === 'text' ? 'Texto' : 'Imagen'}: "${el.name}" (${el.face === 'f' ? 'frente' : 'espalda'})\n`; });
    f += `\n${new Date().toLocaleDateString('es-AR')}`;
    // Copiar al portapapeles
    navigator.clipboard.writeText(f).then(() => toast.success('Ficha copiada al portapapeles'));
  };

  // ── Drag para elementos overlay ────────────────────────────
  const handleDragStart = (id: string, startX: number, startY: number) => {
    const el = elements.find(e => e.id === id);
    if (!el) return;
    setActiveEl(id);
    const origX = el.x, origY = el.y;
    const onMove = (ev: MouseEvent) => {
      setElements(prev => prev.map(e => e.id === id ? { ...e, x: origX + ev.clientX - startX, y: origY + ev.clientY - startY } : e));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const selectedPieceDef = selPiece ? PIECES[model].find(p => p.id === selPiece) : null;

  // ═══════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col xl:flex-row gap-4 w-full">

      {/* ═══ PANEL IZQUIERDO ═══════════════════════════════ */}
      <div className="xl:w-[260px] w-full space-y-3 flex-shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>

        {/* ── Modelo ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Modelo
          </h3>
          <div className="flex gap-2">
            {(['pullover', 'cierre'] as ModelType[]).map(m => (
              <button key={m} onClick={() => switchModel(m)}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  model === m ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)] text-[#C0A060]' : 'border-[rgba(192,160,96,0.2)]'
                }`}>
                {m === 'pullover' ? '👕 Pullover' : '🧥 Con cierre'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Vista ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Vista
          </h3>
          <div className="flex gap-2">
            {([['f','Frente'],['e','Espalda'],['b','Ambos']] as [ViewType,string][]).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-all ${
                  view === v ? 'border-[#C0A060] bg-[rgba(192,160,96,0.1)] text-[#C0A060]' : 'border-[rgba(192,160,96,0.2)]'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Piezas ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Piezas
          </h3>
          <div className="space-y-1">
            {PIECES[model].map(p => (
              <div key={p.id}
                onClick={() => setSelPiece(p.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer transition-all text-sm ${
                  selPiece === p.id ? 'border-[#C0A060] bg-[rgba(192,160,96,0.08)]'
                  : pon[p.id] === false ? 'border-transparent opacity-30' : 'border-transparent hover:border-[rgba(192,160,96,0.3)]'
                }`}>
                <span className="w-4 h-4 rounded-full border flex-shrink-0"
                  style={{ backgroundColor: pc[p.id] || p.c, borderColor: 'rgba(0,0,0,0.15)' }} />
                <span className="flex-1 text-xs">{p.icon} {p.n}</span>
                {p.opt && (
                  <button onClick={(e) => { e.stopPropagation(); togglePiece(p.id); }}
                    className={`w-7 h-4 rounded-full relative transition-colors flex-shrink-0 ${
                      pon[p.id] !== false ? 'bg-[#C0A060]' : 'bg-gray-600'
                    }`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                      pon[p.id] !== false ? 'left-3.5' : 'left-0.5'
                    }`} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Color ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Color — <span className="text-[#C0A060] normal-case tracking-normal">{selectedPieceDef?.n ?? 'seleccioná una pieza'}</span>
          </h3>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {COLORS.map(c => (
              <button key={c} onClick={() => applyColor(c)}
                className="w-full aspect-square rounded border-2 transition-all hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: selPiece && pc[selPiece] === c ? '#fff' : 'transparent',
                  transform: selPiece && pc[selPiece] === c ? 'scale(1.13)' : undefined,
                }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={customColor} onChange={e => { setCustomColor(e.target.value); applyColor(e.target.value); }}
              className="w-7 h-7 rounded cursor-pointer border-none p-0" />
            <span className="text-xs" style={{ color: 'var(--texto-muted)' }}>Personalizado</span>
          </div>
        </div>

        {/* ── Texto ── */}
        <div className="card space-y-2">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--texto-secondary)' }}>
            ✏️ Texto
          </h3>
          <input className="input text-sm w-full" placeholder="Promo 2025, tu nombre..."
            value={textoInput} onChange={e => setTextoInput(e.target.value)} />
          <div className="flex gap-1 flex-wrap">
            {FONTS.map(f => (
              <button key={f.id} onClick={() => setFontSel(f.font)}
                className={`px-2 py-1 rounded border text-xs transition-all ${
                  fontSel === f.font ? 'border-[#C0A060] text-[#C0A060]' : 'border-[rgba(192,160,96,0.2)]'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--texto-muted)' }}>Tamaño</label>
            <input type="range" min="8" max="80" value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
              className="flex-1" style={{ accentColor: '#C0A060' }} />
            <span className="text-xs text-[#C0A060] min-w-[30px] text-right">{fontSize}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-none p-0" />
            <span className="text-xs" style={{ color: 'var(--texto-muted)' }}>Color texto</span>
          </div>
          <button onClick={addText} className="btn-primary w-full text-xs py-2">＋ Agregar texto</button>
        </div>

        {/* ── Logo ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            🖼️ Imagen / Logo
          </h3>
          <label className={`btn-secondary w-full cursor-pointer text-center text-xs block ${subiendoLogo ? 'opacity-50' : ''}`}
            htmlFor="logo-upload-v2">
            {subiendoLogo ? 'Subiendo...' : '📎 Click para subir (PNG/SVG/JPG, máx 500KB)'}
          </label>
          <input id="logo-upload-v2" type="file" accept=".png,.svg,.jpg,.jpeg"
            className="hidden" onChange={handleImgUpload} disabled={subiendoLogo} />
        </div>

        {/* ── Acciones ── */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={exportFicha} className="btn-secondary flex-1 text-xs py-2">📋 Ficha técnica</button>
            <button onClick={() => { if (confirm('¿Resetear todo?')) { initColors(model); setElements([]); setSelPiece(null); setActiveEl(null); } }}
              className="btn-secondary flex-1 text-xs py-2">↺ Reset</button>
          </div>
          <button onClick={guardarManual} disabled={guardando}
            className="btn-primary w-full" id="btn-guardar-variante">
            {guardando
              ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Guardando...</>
              : variantIdRef.current ? '💾 Guardar cambios' : '💾 Guardar nueva variante'}
          </button>
          {!variantIdRef.current && (
            <p className="text-xs text-center" style={{ color: 'var(--texto-muted)' }}>
              {3 - cantidadVariantes} variante(s) disponible(s)
            </p>
          )}
        </div>
      </div>

      {/* ═══ CANVAS CENTRAL ════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center">
        <div className="flex gap-10 items-end justify-center">

          {/* Canvas Frente */}
          {view !== 'e' && (
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--texto-muted)' }}>Frente</span>
              <div className="relative">
                <canvas ref={canvasFRef} width={340} height={420}
                  className="rounded-xl shadow-xl cursor-crosshair"
                  style={{ background: '#0e0e0e', maxWidth: view === 'b' ? '280px' : '380px', height: 'auto' }} />
                {/* Overlay de elementos del frente */}
                <div className="absolute inset-0 pointer-events-none" style={{ pointerEvents: 'auto' }}>
                  {elements.filter(el => el.face === 'f').map(el => (
                    <div key={el.id}
                      className={`absolute cursor-move select-none rounded px-1 border-2 border-dashed transition-colors ${
                        activeEl === el.id ? 'border-[#C0A060]' : 'border-transparent hover:border-[rgba(192,160,96,0.4)]'
                      }`}
                      style={{
                        left: el.x, top: el.y,
                        opacity: el.opacity,
                        transform: `rotate(${el.rotation}deg)`,
                      }}
                      onMouseDown={(e) => { e.preventDefault(); handleDragStart(el.id, e.clientX, e.clientY); }}
                      onClick={() => setActiveEl(el.id)}>
                      {el.type === 'text' ? (
                        <span style={{ fontFamily: el.font, fontSize: el.fontSize, color: el.color, fontWeight: 700,
                          textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
                          {el.content}
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={el.src} alt={el.name} style={{ width: el.imgWidth, height: 'auto' }} draggable={false} />
                      )}
                      <button onClick={(ev) => { ev.stopPropagation(); removeElement(el.id); }}
                        className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 rounded-full text-white text-[9px] flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Canvas Espalda */}
          {view !== 'f' && (
            <div className="flex flex-col items-center">
              <span className="text-xs uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--texto-muted)' }}>Espalda</span>
              <div className="relative">
                <canvas ref={canvasERef} width={340} height={420}
                  className="rounded-xl shadow-xl cursor-crosshair"
                  style={{ background: '#0e0e0e', maxWidth: view === 'b' ? '280px' : '380px', height: 'auto' }} />
                {/* Overlay de elementos de espalda */}
                <div className="absolute inset-0 pointer-events-none" style={{ pointerEvents: 'auto' }}>
                  {elements.filter(el => el.face === 'e').map(el => (
                    <div key={el.id}
                      className={`absolute cursor-move select-none rounded px-1 border-2 border-dashed transition-colors ${
                        activeEl === el.id ? 'border-[#C0A060]' : 'border-transparent hover:border-[rgba(192,160,96,0.4)]'
                      }`}
                      style={{
                        left: el.x, top: el.y,
                        opacity: el.opacity,
                        transform: `rotate(${el.rotation}deg)`,
                      }}
                      onMouseDown={(e) => { e.preventDefault(); handleDragStart(el.id, e.clientX, e.clientY); }}
                      onClick={() => setActiveEl(el.id)}>
                      {el.type === 'text' ? (
                        <span style={{ fontFamily: el.font, fontSize: el.fontSize, color: el.color, fontWeight: 700,
                          textShadow: '0 1px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
                          {el.content}
                        </span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={el.src} alt={el.name} style={{ width: el.imgWidth, height: 'auto' }} draggable={false} />
                      )}
                      <button onClick={(ev) => { ev.stopPropagation(); removeElement(el.id); }}
                        className="absolute -top-2 -right-2 w-4 h-4 bg-red-600 rounded-full text-white text-[9px] flex items-center justify-center hover:bg-red-500">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de info inferior */}
        <div className="mt-3 px-4 py-2 rounded-lg text-xs flex gap-4" style={{ background: 'var(--card-bg)', color: 'var(--texto-muted)' }}>
          <span>Pieza: <span className="text-[#C0A060]">{selectedPieceDef?.n ?? '—'}</span></span>
          <span>Elementos: <span className="text-[#C0A060]">{elements.length}</span></span>
          <span>{model === 'pullover' ? 'Pullover' : 'Con cierre'}</span>
          <span>💾 Guardado automático</span>
        </div>
      </div>

      {/* ═══ PANEL DERECHO ═════════════════════════════════ */}
      <div className="xl:w-[230px] w-full space-y-3 flex-shrink-0 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}>

        {/* ── Capas ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Capas
          </h3>
          {elements.length === 0 ? (
            <p className="text-xs text-center py-2" style={{ color: 'var(--texto-muted)' }}>Sin elementos</p>
          ) : (
            <div className="space-y-1">
              {[...elements].reverse().map(el => (
                <div key={el.id}
                  onClick={() => setActiveEl(el.id)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-pointer text-xs transition-all ${
                    activeEl === el.id ? 'border-[#C0A060] bg-[rgba(192,160,96,0.08)]' : 'border-transparent hover:border-[rgba(192,160,96,0.2)]'
                  }`}>
                  <span>{el.icon}</span>
                  <span className="flex-1 truncate">{el.name}</span>
                  <span style={{ color: 'var(--texto-muted)' }}>{el.face === 'f' ? 'frente' : 'espalda'}</span>
                  <button onClick={(ev) => { ev.stopPropagation(); removeElement(el.id); }}
                    className="text-red-400 hover:text-red-300 px-1">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Propiedades del elemento activo ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Propiedades
          </h3>
          {!activeEl ? (
            <p className="text-xs" style={{ color: 'var(--texto-muted)' }}>Seleccioná un elemento</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--texto-muted)' }}>Opacidad</span>
                <input type="range" min="10" max="100"
                  value={(elements.find(e => e.id === activeEl)?.opacity ?? 1) * 100}
                  onChange={e => {
                    const v = Number(e.target.value) / 100;
                    setElements(prev => prev.map(el => el.id === activeEl ? { ...el, opacity: v } : el));
                  }}
                  className="flex-1" style={{ accentColor: '#C0A060' }} />
                <span className="text-xs text-[#C0A060] min-w-[28px] text-right">
                  {Math.round((elements.find(e => e.id === activeEl)?.opacity ?? 1) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: 'var(--texto-muted)' }}>Rotación</span>
                <input type="range" min="-180" max="180"
                  value={elements.find(e => e.id === activeEl)?.rotation ?? 0}
                  onChange={e => {
                    const v = Number(e.target.value);
                    setElements(prev => prev.map(el => el.id === activeEl ? { ...el, rotation: v } : el));
                  }}
                  className="flex-1" style={{ accentColor: '#C0A060' }} />
                <span className="text-xs text-[#C0A060] min-w-[28px] text-right">
                  {elements.find(e => e.id === activeEl)?.rotation ?? 0}°
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { if (activeEl) removeElement(activeEl); }}
                  className="flex-1 py-1.5 rounded-lg border border-red-800 text-red-400 text-xs hover:bg-red-900/20">
                  🗑 Eliminar
                </button>
                <button onClick={() => {
                  const orig = elements.find(e => e.id === activeEl);
                  if (!orig) return;
                  const dup: OverlayElement = { ...orig, id: `el${Date.now()}`, x: orig.x + 14, y: orig.y + 14 };
                  setElements(prev => [...prev, dup]);
                  setActiveEl(dup.id);
                }} className="flex-1 py-1.5 rounded-lg border text-xs hover:border-[#C0A060] hover:text-[#C0A060]"
                  style={{ borderColor: 'rgba(192,160,96,0.3)' }}>
                  ⧉ Duplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Resumen ── */}
        <div className="card">
          <h3 className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--texto-secondary)' }}>
            Resumen
          </h3>
          <div className="text-xs space-y-1" style={{ color: 'var(--texto-muted)' }}>
            <p>Modelo: <b className="text-[#C0A060]">{model === 'pullover' ? 'Pullover' : 'Con cierre'}</b></p>
            <p>Piezas activas: <b className="text-[#C0A060]">{PIECES[model].filter(p => pon[p.id] !== false).length}</b></p>
            <p>Elementos: <b className="text-[#C0A060]">{elements.length}</b></p>
            <p>Colores únicos: <b className="text-[#C0A060]">{new Set(Object.values(pc)).size}</b></p>
          </div>
        </div>
      </div>
    </div>
  );
}
