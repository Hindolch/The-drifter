/** 8-bit pixel UI helpers — flat palette, chunky borders, no blur/gradients */
//src/ui/ArcadeUI.ts

export const HI_SCORE_KEY = "Drifter";

/** High-contrast 8-bit palette — tuned for readability on dark backgrounds */
export const COLORS = {
  bg: "#0a0a18",
  panel: "#242448",
  panelHi: "#323264",
  ink: "#ffffff",
  shadow: "#000000",
  yellow: "#ffe566",
  cyan: "#66e8ff",
  green: "#66ff88",
  red: "#ff6688",
  purple: "#dda0ee",
  magenta: "#ff99dd",
  orange: "#ffcc44",
  muted: "#d8e4ff",
};

export const FONT_LABEL = "bold 12px 'Courier New', monospace";
export const FONT_VALUE = "bold 20px 'Courier New', monospace";
export const FONT_TITLE = "bold 52px 'Courier New', monospace";
export const FONT_HEADING = "bold 26px 'Courier New', monospace";
export const FONT_SMALL = "bold 12px 'Courier New', monospace";
export const FONT_BODY = "bold 14px 'Courier New', monospace";

export function snap(value: number): number {
  return Math.floor(value);
}

export function loadHiScore(): number {
  const stored = localStorage.getItem(HI_SCORE_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

export function saveHiScore(score: number): void {
  const current = loadHiScore();
  if (score > current) {
    localStorage.setItem(HI_SCORE_KEY, String(score));
  }
}

export function formatScore(score: number): string {
  return score.toString().padStart(8, "0");
}

export function drawPixelPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = COLORS.panel,
  border: string = COLORS.cyan
): void {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  h = snap(h);

  ctx.save();
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x + 2, y + 2, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = COLORS.panelHi;
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.restore();
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string = COLORS.ink,
  font: string = FONT_VALUE,
  align: CanvasTextAlign = "left",
  outline: boolean = true
): void {
  const px = snap(x);
  const py = snap(y);

  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";

  if (outline) {
    ctx.fillStyle = COLORS.shadow;
    for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) {
      ctx.fillText(text, px + ox, py + oy);
    }
  }

  ctx.fillStyle = color;
  ctx.fillText(text, px, py);
  ctx.restore();
}

/** Dark strip behind small footer / caption lines */
export function drawPixelCaptionBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  h = snap(h);
  ctx.save();
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = COLORS.panelHi;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.restore();
}

export function drawPixelLabelValue(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  labelColor: string,
  valueColor: string = COLORS.yellow
): void {
  drawPixelText(ctx, label, x, y, labelColor, FONT_LABEL, "left");
  drawPixelText(ctx, value, x, y + 14, valueColor, FONT_VALUE, "left");
}

export function drawPixelMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number,
  segments: number = 20,
  fillColor: string = COLORS.cyan,
  emptyColor: string = COLORS.shadow
): void {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  h = snap(h);
  const filled = Math.floor(Math.max(0, Math.min(1, fill)) * segments);
  const segW = Math.floor(w / segments);

  ctx.save();
  for (let i = 0; i < segments; i++) {
    const sx = x + i * segW;
    ctx.fillStyle = i < filled ? fillColor : emptyColor;
    ctx.fillRect(sx, y, segW - 1, h);
  }
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function drawPixelStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string
): void {
  const s = Math.max(1, snap(size));
  ctx.fillStyle = color;
  ctx.fillRect(snap(x), snap(y), s, s);
}

export function drawPixelShipIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string = COLORS.red
): void {
  x = snap(x);
  y = snap(y);
  ctx.fillStyle = color;
  ctx.fillRect(x + 4, y, 4, 2);
  ctx.fillRect(x + 2, y + 2, 8, 2);
  ctx.fillRect(x, y + 4, 12, 4);
  ctx.fillRect(x + 4, y + 8, 4, 2);
}

export function drawPixelBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = COLORS.magenta
): void {
  x = snap(x);
  y = snap(y);
  w = snap(w);
  h = snap(h);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 4);
  ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillRect(x, y, 4, h);
  ctx.fillRect(x + w - 4, y, 4, h);
  ctx.restore();
}

/** Subtle CRT-ish scanlines — very light, keeps 8-bit feel */
export function drawPixelScanlines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = "#000000";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 2);
  }
  ctx.restore();
}
