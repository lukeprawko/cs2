import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import {
  BOMBSITE_ZONES,
  BUY_ZONES,
  CT_SPAWNS,
  DUST_ALLEY_BOXES,
  DUST_ALLEY_PROPS,
  MAP_HALF_SIZE,
  T_SPAWNS,
} from '../src/world/DustAlleyMap';

// CRC32 table for PNG chunk checksums
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(width: number, height: number, rgba: Uint8Array): Buffer {
  const rowSize = 1 + width * 4;
  const raw = Buffer.alloc(height * rowSize);

  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0; // Filter byte: None
    const srcStart = y * width * 4;
    const dstStart = y * rowSize + 1;
    raw.set(rgba.subarray(srcStart, srcStart + width * 4), dstStart);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Minimal pixel drawing canvas
class PixelCanvas {
  public width: number;
  public height: number;
  public data: Uint8Array;

  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.data = new Uint8Array(w * h * 4);
  }

  setPixel(x: number, y: number, r: number, g: number, b: number, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a >= 255) {
      this.data[idx] = r;
      this.data[idx + 1] = g;
      this.data[idx + 2] = b;
      this.data[idx + 3] = 255;
    } else {
      const alpha = a / 255;
      const inv = 1 - alpha;
      this.data[idx] = Math.round(this.data[idx] * inv + r * alpha);
      this.data[idx + 1] = Math.round(this.data[idx + 1] * inv + g * alpha);
      this.data[idx + 2] = Math.round(this.data[idx + 2] * inv + b * alpha);
      this.data[idx + 3] = 255;
    }
  }

  fillRect(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    r: number,
    g: number,
    b: number,
    a = 255
  ) {
    const x0 = Math.max(0, Math.round(rx));
    const y0 = Math.max(0, Math.round(ry));
    const x1 = Math.min(this.width, Math.round(rx + rw));
    const y1 = Math.min(this.height, Math.round(ry + rh));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        this.setPixel(x, y, r, g, b, a);
      }
    }
  }

  strokeRect(
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    a = 255
  ) {
    this.fillRect(rx, ry, rw, thickness, r, g, b, a);
    this.fillRect(rx, ry + rh - thickness, rw, thickness, r, g, b, a);
    this.fillRect(rx, ry, thickness, rh, r, g, b, a);
    this.fillRect(rx + rw - thickness, ry, thickness, rh, r, g, b, a);
  }

  fillCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number, a = 255) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const x1 = Math.min(this.width, Math.ceil(cx + radius));
    const y1 = Math.min(this.height, Math.ceil(cy + radius));
    const rSq = radius * radius;

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= rSq) {
          this.setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  strokeCircle(
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    a = 255
  ) {
    const rIn = radius - thickness;
    const rOut = radius;
    const rInSq = rIn * rIn;
    const rOutSq = rOut * rOut;
    const x0 = Math.max(0, Math.floor(cx - rOut));
    const y0 = Math.max(0, Math.floor(cy - rOut));
    const x1 = Math.min(this.width, Math.ceil(cx + rOut));
    const y1 = Math.min(this.height, Math.ceil(cy + rOut));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const dSq = (x - cx) ** 2 + (y - cy) ** 2;
        if (dSq <= rOutSq && dSq >= rInSq) {
          this.setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    r: number,
    g: number,
    b: number,
    a = 255
  ) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const steps = Math.ceil(dist * 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + dx * t;
      const cy = y0 + dy * t;
      this.fillCircle(cx, cy, thickness * 0.5, r, g, b, a);
    }
  }

  // Draw simple 5x7 bitmap characters
  drawText5x7(
    text: string,
    x: number,
    y: number,
    scale: number,
    r: number,
    g: number,
    b: number
  ) {
    const FONT: Record<string, number[]> = {
      A: [0x70, 0x88, 0x88, 0xf8, 0x88, 0x88, 0x88],
      B: [0xf0, 0x88, 0x88, 0xf0, 0x88, 0x88, 0xf0],
      C: [0x70, 0x88, 0x80, 0x80, 0x80, 0x88, 0x70],
      D: [0xf0, 0x88, 0x88, 0x88, 0x88, 0x88, 0xf0],
      E: [0xf8, 0x80, 0x80, 0xf0, 0x80, 0x80, 0xf8],
      G: [0x70, 0x88, 0x80, 0xb8, 0x88, 0x88, 0x78],
      I: [0x70, 0x20, 0x20, 0x20, 0x20, 0x20, 0x70],
      L: [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xf8],
      M: [0x88, 0xd8, 0xa8, 0x88, 0x88, 0x88, 0x88],
      N: [0x88, 0xc8, 0xa8, 0x98, 0x88, 0x88, 0x88],
      O: [0x70, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70],
      P: [0xf0, 0x88, 0x88, 0xf0, 0x80, 0x80, 0x80],
      R: [0xf0, 0x88, 0x88, 0xf0, 0xa0, 0x90, 0x88],
      S: [0x70, 0x88, 0x80, 0x70, 0x08, 0x88, 0x70],
      T: [0xf8, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20],
      U: [0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x70],
      W: [0x88, 0x88, 0x88, 0x88, 0xa8, 0xd8, 0x88],
      Y: [0x88, 0x88, 0x50, 0x20, 0x20, 0x20, 0x20],
      ' ': [0, 0, 0, 0, 0, 0, 0],
      '-': [0, 0, 0, 0x70, 0, 0, 0],
      '.': [0, 0, 0, 0, 0, 0x30, 0x30],
      '1': [0x20, 0x60, 0x20, 0x20, 0x20, 0x20, 0x70],
      '2': [0x70, 0x88, 0x08, 0x30, 0x40, 0x80, 0xf8],
      '5': [0xf8, 0x80, 0xf0, 0x08, 0x08, 0x88, 0x70],
      '0': [0x70, 0x88, 0x98, 0xa8, 0xc8, 0x88, 0x70],
    };

    let curX = x;
    for (const char of text.toUpperCase()) {
      const bitmap = FONT[char] || FONT[' '];
      for (let rIdx = 0; rIdx < 7; rIdx++) {
        const row = bitmap[rIdx];
        for (let cIdx = 0; cIdx < 5; cIdx++) {
          if ((row >> (7 - cIdx)) & 1) {
            this.fillRect(
              curX + cIdx * scale,
              y + rIdx * scale,
              scale,
              scale,
              r,
              g,
              b
            );
          }
        }
      }
      curX += 6 * scale;
    }
  }
}

export function renderDustAlleyTopDown(): Buffer {
  const SIZE = 1200;
  const MARGIN = 70;
  const mapWidthMeters = MAP_HALF_SIZE * 2; // ~62.4m
  const scale = (SIZE - MARGIN * 2) / mapWidthMeters; // px per meter (~17.2 px/m)

  const toPxX = (worldX: number) => MARGIN + (worldX + MAP_HALF_SIZE) * scale;
  const toPxY = (worldZ: number) => MARGIN + (worldZ + MAP_HALF_SIZE) * scale;

  const cv = new PixelCanvas(SIZE, SIZE);

  // 1. Tactical Blueprint Dark Background
  cv.fillRect(0, 0, SIZE, SIZE, 10, 14, 20);

  // Weathered dark granite and slate stone fortress floor
  const minX = toPxX(-MAP_HALF_SIZE);
  const minY = toPxY(-MAP_HALF_SIZE);
  const mapPx = (MAP_HALF_SIZE * 2) * scale;
  cv.fillRect(minX, minY, mapPx, mapPx, 68, 63, 57);

  // Subtle 10m grid lines across the stone arena
  for (let m = -30; m <= 30; m += 10) {
    const px = toPxX(m);
    const py = toPxY(m);
    cv.drawLine(px, minY, px, minY + mapPx, 1, 48, 44, 40, 110);
    cv.drawLine(minX, py, minX + mapPx, py, 1, 48, 44, 40, 110);
  }

  // 2. Buy Zones
  // CT Buy Zone (Cyan/Blue tint)
  const ctBz = BUY_ZONES.CT;
  cv.fillRect(
    toPxX(ctBz.minX),
    toPxY(ctBz.minZ),
    (ctBz.maxX - ctBz.minX) * scale,
    (ctBz.maxZ - ctBz.minZ) * scale,
    2,
    132,
    199,
    70
  );
  cv.strokeRect(
    toPxX(ctBz.minX),
    toPxY(ctBz.minZ),
    (ctBz.maxX - ctBz.minX) * scale,
    (ctBz.maxZ - ctBz.minZ) * scale,
    3,
    56,
    189,
    248,
    220
  );

  // T Buy Zone (Orange/Amber tint)
  const tBz = BUY_ZONES.T;
  cv.fillRect(
    toPxX(tBz.minX),
    toPxY(tBz.minZ),
    (tBz.maxX - tBz.minX) * scale,
    (tBz.maxZ - tBz.minZ) * scale,
    217,
    119,
    6,
    70
  );
  cv.strokeRect(
    toPxX(tBz.minX),
    toPxY(tBz.minZ),
    (tBz.maxX - tBz.minX) * scale,
    (tBz.maxZ - tBz.minZ) * scale,
    3,
    245,
    158,
    11,
    220
  );

  // 3. Bombsite A & B Zones (Glowing Crimson / Red)
  const bzA = BOMBSITE_ZONES.A;
  cv.fillRect(
    toPxX(bzA.minX),
    toPxY(bzA.minZ),
    (bzA.maxX - bzA.minX) * scale,
    (bzA.maxZ - bzA.minZ) * scale,
    220,
    38,
    38,
    95
  );
  cv.strokeRect(
    toPxX(bzA.minX),
    toPxY(bzA.minZ),
    (bzA.maxX - bzA.minX) * scale,
    (bzA.maxZ - bzA.minZ) * scale,
    4,
    239,
    68,
    68,
    240
  );

  const bzB = BOMBSITE_ZONES.B;
  cv.fillRect(
    toPxX(bzB.minX),
    toPxY(bzB.minZ),
    (bzB.maxX - bzB.minX) * scale,
    (bzB.maxZ - bzB.minZ) * scale,
    220,
    38,
    38,
    95
  );
  cv.strokeRect(
    toPxX(bzB.minX),
    toPxY(bzB.minZ),
    (bzB.maxX - bzB.minX) * scale,
    (bzB.maxZ - bzB.minZ) * scale,
    4,
    239,
    68,
    68,
    240
  );

  // 4. Render All Map Boxes (Walls, Containers, Crates, Barriers)
  // First pass: ambient drop shadows for 3D depth
  for (const b of DUST_ALLEY_BOXES) {
    if (b.noCollide) continue;
    const px = toPxX(b.x - b.w * 0.5);
    const py = toPxY(b.z - b.d * 0.5);
    const pw = b.w * scale;
    const ph = b.d * scale;
    cv.fillRect(px + 6, py + 6, pw, ph, 0, 0, 0, 85);
  }

  // Second pass: actual box geometry
  for (const b of DUST_ALLEY_BOXES) {
    if (b.noCollide) continue;
    const px = toPxX(b.x - b.w * 0.5);
    const py = toPxY(b.z - b.d * 0.5);
    const pw = b.w * scale;
    const ph = b.d * scale;

    if (b.material === 'concrete') {
      // Perimeter and fortified fortress stone walls
      cv.fillRect(px, py, pw, ph, 52, 57, 65);
      cv.strokeRect(px, py, pw, ph, 2, 78, 86, 96);
    } else if (b.material === 'asphalt') {
      // Dark Charcoal Fortress Ashlar Divider Walls (exact blueprint look)
      cv.fillRect(px, py, pw, ph, 28, 32, 38);
      cv.strokeRect(px, py, pw, ph, 2, 16, 18, 22);
    } else if (b.material === 'metal_container') {
      // Shipping Containers (Industrial Cobalt Blue with corrugated ridges)
      cv.fillRect(px, py, pw, ph, 23, 60, 102);
      cv.strokeRect(px, py, pw, ph, 3, 14, 38, 68);
      for (let ridge = 6; ridge < pw - 6; ridge += 8) {
        cv.drawLine(px + ridge, py + 2, px + ridge, py + ph - 2, 1, 45, 98, 162, 160);
      }
    } else if (b.material === 'wood_crate') {
      // Tactical Wooden Cover Crates
      cv.fillRect(px, py, pw, ph, 143, 99, 57);
      cv.strokeRect(px, py, pw, ph, 2, 95, 62, 32);
      // Cross-bracing on crates
      cv.drawLine(px + 2, py + 2, px + pw - 2, py + ph - 2, 1, 110, 74, 40);
      cv.drawLine(px + pw - 2, py + 2, px + 2, py + ph - 2, 1, 110, 74, 40);
    } else if (b.material === 'dark_metal') {
      cv.fillRect(px, py, pw, ph, 32, 36, 44);
      cv.strokeRect(px, py, pw, ph, 2, 55, 62, 72);
    } else {
      cv.fillRect(px, py, pw, ph, 80, 85, 92);
      cv.strokeRect(px, py, pw, ph, 2, 110, 116, 124);
    }
  }

  // 5. Environmental Props (Barrels, Sandbags, Lantern Sconces)
  for (const prop of DUST_ALLEY_PROPS) {
    const px = toPxX(prop.position[0]);
    const py = toPxY(prop.position[2]);

    if (prop.type === 'barrel') {
      cv.fillCircle(px, py, 6, 25, 45, 75);
      cv.strokeCircle(px, py, 6, 2, 56, 189, 248);
    } else if (prop.type === 'sandbags') {
      cv.fillRect(px - 14, py - 5, 28, 10, 140, 120, 90);
      cv.strokeRect(px - 14, py - 5, 28, 10, 2, 95, 80, 58);
    } else if (prop.type === 'lamp') {
      // Warm Amber / Golden Sconce Lantern Glow Pool matching reference blueprint
      cv.fillCircle(px, py, 26, 245, 158, 11, 40);
      cv.fillCircle(px, py, 14, 251, 191, 36, 95);
      cv.fillCircle(px, py, 5, 254, 240, 138, 255);
    }
  }

  // 6. Spawn Markers
  // CT Spawns (Blue Crosshairs)
  for (const sp of CT_SPAWNS) {
    const px = toPxX(sp.x);
    const py = toPxY(sp.z);
    cv.fillCircle(px, py, 5, 2, 132, 199);
    cv.strokeCircle(px, py, 7, 2, 56, 189, 248);
  }
  // T Spawns (Amber Crosshairs)
  for (const sp of T_SPAWNS) {
    const px = toPxX(sp.x);
    const py = toPxY(sp.z);
    cv.fillCircle(px, py, 5, 217, 119, 6);
    cv.strokeCircle(px, py, 7, 2, 245, 158, 11);
  }

  // 7. Tactical Callout Labels & Sites
  // Bold "A" inside Bombsite A
  const aCenterPxX = toPxX((bzA.minX + bzA.maxX) * 0.5);
  const aCenterPxY = toPxY((bzA.minZ + bzA.maxZ) * 0.5);
  cv.drawText5x7('A', aCenterPxX - 16, aCenterPxY - 22, 6, 255, 255, 255);
  cv.drawText5x7('SITE A', aCenterPxX - 34, aCenterPxY + 28, 2, 239, 68, 68);

  // Bold "B" inside Bombsite B
  const bCenterPxX = toPxX((bzB.minX + bzB.maxX) * 0.5);
  const bCenterPxY = toPxY((bzB.minZ + bzB.maxZ) * 0.5);
  cv.drawText5x7('B', bCenterPxX - 16, bCenterPxY - 22, 6, 255, 255, 255);
  cv.drawText5x7('SITE B', bCenterPxX - 34, bCenterPxY + 28, 2, 239, 68, 68);

  // Callouts
  cv.drawText5x7('MID', toPxX(-2.5) - 16, toPxY(2.0), 3, 245, 158, 11);
  cv.drawText5x7('LONG A', toPxX(17.5), toPxY(2.0), 2, 20, 24, 30);
  cv.drawText5x7('B TUNNELS', toPxX(-20.5), toPxY(6.0), 2, 20, 24, 30);
  cv.drawText5x7('CT BASE', toPxX(-8.5), toPxY(-26.0), 2, 14, 165, 233);
  cv.drawText5x7('T BASE', toPxX(3.5), toPxY(27.0), 2, 245, 158, 11);

  // 8. Blueprint Outer Tactical Frame & Title
  cv.strokeRect(minX - 4, minY - 4, mapPx + 8, mapPx + 8, 3, 71, 85, 105);

  // Top Banner
  cv.fillRect(0, 0, SIZE, 46, 12, 17, 24);
  cv.drawText5x7(
    'DUST ALLEY - 5V5 PLANT / DEFUSE TACTICAL OVERVIEW',
    MARGIN,
    14,
    2,
    245,
    158,
    11
  );

  // Compass Rose (North Arrow)
  const nX = SIZE - 60;
  const nY = 24;
  cv.drawText5x7('N', nX - 4, nY - 14, 2, 239, 68, 68);
  cv.drawLine(nX, nY, nX, nY + 16, 2, 239, 68, 68);
  cv.drawLine(nX, nY, nX - 5, nY + 6, 2, 239, 68, 68);
  cv.drawLine(nX, nY, nX + 5, nY + 6, 2, 239, 68, 68);

  // Bottom Status Bar
  cv.fillRect(0, SIZE - 38, SIZE, 38, 12, 17, 24);
  cv.drawText5x7(
    'SKALA 1:1  ARENA 62.4M X 62.4M  CT BLUE / T ORANGE / BOMBSITES RED',
    MARGIN,
    SIZE - 26,
    1.5,
    148,
    163,
    184
  );

  return encodePNG(SIZE, SIZE, cv.data);
}

// Execute and save files
const pngBuffer = renderDustAlleyTopDown();

// Save to public/
const publicPath = path.resolve('public', 'dust_alley_topdown.png');
fs.writeFileSync(publicPath, pngBuffer);
console.log(`Saved top-down map to ${publicPath} (${pngBuffer.length} bytes)`);

// Save to conversation artifact directory if available
const artifactDir = 'C:\\Users\\zegot\\.gemini\\antigravity\\brain\\5574f45c-bf27-473c-b28c-b1394fc1ea43';
if (fs.existsSync(artifactDir)) {
  const artifactPath = path.join(artifactDir, 'dust_alley_topdown.png');
  fs.writeFileSync(artifactPath, pngBuffer);
  console.log(`Saved top-down map to artifact dir: ${artifactPath}`);
}
