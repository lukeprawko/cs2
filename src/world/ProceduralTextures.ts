import * as THREE from 'three';
import { SurfaceMaterialType } from './DustAlleyMap';

export interface MaterialBundle {
  materials: Record<SurfaceMaterialType, THREE.MeshStandardMaterial>;
  decalBulletMat: THREE.MeshBasicMaterial;
  smokeSpriteMat: THREE.SpriteMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  skyTexture: THREE.CanvasTexture;
  createSignMaterial: (text: string, color: string) => THREE.MeshBasicMaterial;
  createBombsiteFloorMaterial: (site: 'A' | 'B') => THREE.MeshStandardMaterial;
  dispose: () => void;
}

function createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function addNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha = 0.06
): void {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const delta = (Math.random() - 0.5) * 255 * alpha;
    data[i] = Math.max(0, Math.min(255, data[i] + delta));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + delta));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + delta));
  }
  ctx.putImageData(img, 0, 0);
}

export function createProceduralMaterials(maxAnisotropy = 8): MaterialBundle {
  const texturesToDispose: THREE.Texture[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const registerTex = (
    canvas: HTMLCanvasElement,
    isColor: boolean,
    repeatX = 2,
    repeatY = 2
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAnisotropy;
    texturesToDispose.push(tex);
    return tex;
  };

  // High-frequency micro-surface bump map for concrete, stone, and metal
  const [bumpCanvas, bumpCtx] = createCanvas(512, 512);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, 512, 512);
  // Subtle panel bevel lines in bump map
  bumpCtx.strokeStyle = '#505050';
  bumpCtx.lineWidth = 3;
  for (let i = 0; i < 512; i += 128) {
    bumpCtx.beginPath();
    bumpCtx.moveTo(i, 0);
    bumpCtx.lineTo(i, 512);
    bumpCtx.moveTo(0, i);
    bumpCtx.lineTo(512, i);
    bumpCtx.stroke();
  }
  addNoise(bumpCtx, 512, 512, 0.36);
  const genericBump = registerTex(bumpCanvas, false, 4, 2);

  // 1. TACTICAL ASHLAR STONE INNER WALL (`asphalt` in map data)
  // Weathered dark fortress stone masonry blocks with combat battle scars, bullet gouges & tactical markings
  const [darkWallCanvas, darkWallCtx] = createCanvas(512, 512);
  darkWallCtx.fillStyle = '#101318'; // Dark stone mortar
  darkWallCtx.fillRect(0, 0, 512, 512);

  const wallRowH = 512 / 6;
  for (let row = 0; row < 6; row++) {
    const rowY = row * wallRowH;
    const offset = (row % 2) * 64;
    for (let col = -1; col < 5; col++) {
      const colX = col * 128 + offset;
      const bw = 124;
      const bh = wallRowH - 4;
      const hash = Math.abs(Math.sin(colX * 17.1 + rowY * 31.7) * 43758.5);
      const shade = 32 + Math.floor(hash * 18);
      darkWallCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      darkWallCtx.fillRect(colX + 2, rowY + 2, bw, bh);

      // Chiseled block highlights & shadows
      darkWallCtx.fillStyle = 'rgba(255, 255, 255, 0.09)';
      darkWallCtx.fillRect(colX + 2, rowY + 2, bw, 2);
      darkWallCtx.fillRect(colX + 2, rowY + 2, 2, bh);
      darkWallCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      darkWallCtx.fillRect(colX + 2, rowY + bh, bw, 2);
      darkWallCtx.fillRect(colX + bw, rowY + 2, 2, bh);

      // Battle gouges & bullet chips in stone
      if ((hash * 7) % 1 > 0.6) {
        darkWallCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        darkWallCtx.beginPath();
        darkWallCtx.arc(colX + 25 + (hash * 50) % 70, rowY + 12 + (hash * 30) % 40, 3.5, 0, Math.PI * 2);
        darkWallCtx.fill();
        darkWallCtx.fillStyle = 'rgba(180, 180, 185, 0.4)';
        darkWallCtx.beginPath();
        darkWallCtx.arc(colX + 25 + (hash * 50) % 70, rowY + 12 + (hash * 30) % 40, 1.5, 0, Math.PI * 2);
        darkWallCtx.fill();
      }
    }
  }

  // Dark stone / iron parapet coping band at top
  darkWallCtx.fillStyle = '#15171d';
  darkWallCtx.fillRect(0, 0, 512, 26);
  darkWallCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  darkWallCtx.fillRect(0, 0, 512, 3);
  darkWallCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  darkWallCtx.fillRect(0, 24, 512, 2);

  // Tactical spray-painted military directional arrow & zone text
  darkWallCtx.fillStyle = 'rgba(245, 158, 11, 0.75)'; // Amber military stencil
  darkWallCtx.font = 'bold 16px monospace';
  darkWallCtx.fillText('◄ BOMBSITE A', 32, 260);
  darkWallCtx.fillText('BOMBSITE B ►', 340, 260);

  // Bottom subtle damp stone base & dust accumulation
  const wallDirtGrad = darkWallCtx.createLinearGradient(0, 390, 0, 512);
  wallDirtGrad.addColorStop(0, 'rgba(20, 22, 28, 0)');
  wallDirtGrad.addColorStop(0.7, 'rgba(12, 14, 18, 0.6)');
  wallDirtGrad.addColorStop(1, 'rgba(60, 48, 32, 0.5)'); // Desert dust rim
  darkWallCtx.fillStyle = wallDirtGrad;
  darkWallCtx.fillRect(0, 390, 512, 122);
  addNoise(darkWallCtx, 512, 512, 0.08);
  const darkWallMap = registerTex(darkWallCanvas, true, 4, 1);

  // 2. FORTRESS PERIMETER ASHLAR STONE WALL (`concrete`)
  // Heavy dressed medieval stone blocks with battle wear, soot, and sector stenciling
  const [concCanvas, concCtx] = createCanvas(512, 512);
  concCtx.fillStyle = '#16191f'; // Mortar
  concCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 5; row++) {
    const rowY = row * (512 / 5);
    const rowH = 512 / 5;
    const offset = (row % 2) * 80;
    for (let col = -1; col < 5; col++) {
      const colX = col * 160 + offset;
      const bw = 155;
      const bh = rowH - 5;
      const hash = Math.abs(Math.sin(colX * 23.3 + rowY * 41.9) * 43758.5);
      const shade = 52 + Math.floor(hash * 22);
      concCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 4})`;
      concCtx.fillRect(colX + 2, rowY + 2, bw, bh);

      // Chiseled stone block bevels
      concCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      concCtx.fillRect(colX + 2, rowY + 2, bw, 2);
      concCtx.fillRect(colX + 2, rowY + 2, 2, bh);
      concCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      concCtx.fillRect(colX + 2, rowY + bh, bw, 2);
      concCtx.fillRect(colX + bw, rowY + 2, 2, bh);

      // Battle bullet spalls
      if ((hash * 13) % 1 > 0.55) {
        concCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        concCtx.beginPath();
        concCtx.arc(colX + 30 + (hash * 70) % 90, rowY + 15 + (hash * 40) % 55, 4, 0, Math.PI * 2);
        concCtx.fill();
        concCtx.fillStyle = 'rgba(220, 215, 210, 0.55)';
        concCtx.beginPath();
        concCtx.arc(colX + 30 + (hash * 70) % 90, rowY + 15 + (hash * 40) % 55, 1.8, 0, Math.PI * 2);
        concCtx.fill();
      }
    }
  }

  // Heavy stone battlement coping band at top
  concCtx.fillStyle = '#222730';
  concCtx.fillRect(0, 0, 512, 30);
  concCtx.fillStyle = 'rgba(255, 255, 255, 0.20)';
  concCtx.fillRect(0, 0, 512, 4);
  concCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  concCtx.fillRect(0, 28, 512, 2);

  // Black explosive soot wash mark
  const sootGrad = concCtx.createRadialGradient(260, 210, 10, 260, 210, 95);
  sootGrad.addColorStop(0, 'rgba(10, 10, 12, 0.7)');
  sootGrad.addColorStop(0.6, 'rgba(20, 20, 25, 0.35)');
  sootGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  concCtx.fillStyle = sootGrad;
  concCtx.fillRect(160, 110, 200, 200);

  // Tactical stencil on wall
  concCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  concCtx.font = 'bold 20px monospace';
  concCtx.fillText('MIL-SEC // DUST-4', 48, 160);

  const concDirt = concCtx.createLinearGradient(0, 390, 0, 512);
  concDirt.addColorStop(0, 'rgba(18, 21, 26, 0)');
  concDirt.addColorStop(0.6, 'rgba(12, 14, 18, 0.6)');
  concDirt.addColorStop(1, 'rgba(65, 52, 35, 0.55)'); // Combat dust wash
  concCtx.fillStyle = concDirt;
  concCtx.fillRect(0, 390, 512, 122);
  addNoise(concCtx, 512, 512, 0.09);
  const concreteMap = registerTex(concCanvas, true, 4, 1);

  // 3. SANDSTONE PLASTER (Sun-baked cracked desert walls)
  const [sandCanvas, sandCtx] = createCanvas(512, 512);
  sandCtx.fillStyle = '#c8b292';
  sandCtx.fillRect(0, 0, 512, 512);
  // Stucco flaking revealing raw brick undercoat
  sandCtx.fillStyle = 'rgba(140, 85, 60, 0.35)';
  sandCtx.fillRect(40, 80, 110, 60);
  sandCtx.fillRect(320, 290, 140, 75);
  // Combat cracks
  sandCtx.strokeStyle = 'rgba(70, 50, 35, 0.4)';
  sandCtx.lineWidth = 1.5;
  sandCtx.beginPath();
  sandCtx.moveTo(40, 80);
  sandCtx.lineTo(90, 110);
  sandCtx.lineTo(150, 140);
  sandCtx.moveTo(320, 290);
  sandCtx.lineTo(370, 330);
  sandCtx.lineTo(460, 365);
  sandCtx.stroke();
  addNoise(sandCtx, 512, 512, 0.12);
  const sandstoneMap = registerTex(sandCanvas, true, 2, 1);

  // 4. WEATHERED BRICK
  const [brickCanvas, brickCtx] = createCanvas(512, 512);
  brickCtx.fillStyle = '#7a5440';
  brickCtx.fillRect(0, 0, 512, 512);
  const rows = 12;
  const cols = 6;
  const bh = 512 / rows;
  const bw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const shade = 120 + Math.floor(Math.random() * 45);
      brickCtx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.60)}, ${Math.floor(shade * 0.44)})`;
      brickCtx.fillRect(c * bw + offset + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  addNoise(brickCtx, 512, 512, 0.1);
  const brickMap = registerTex(brickCanvas, true, 2, 2);

  // 5. MILITARY MUNITIONS CRATE (`wood_crate`)
  // Heavy olive-drab/khaki tactical combat supply crate with hazard markings & stencils
  const [woodCanvas, woodCtx] = createCanvas(512, 512);
  woodCtx.fillStyle = '#5c4d37'; // Military olive-drab timber
  woodCtx.fillRect(0, 0, 512, 512);

  // Horizontal wood grain & slat seams
  for (let y = 0; y < 512; y += 64) {
    woodCtx.fillStyle = y % 128 === 0 ? 'rgba(0,0,0,0.14)' : 'rgba(255,230,190,0.06)';
    woodCtx.fillRect(0, y, 512, 64);
    woodCtx.strokeStyle = '#32281a';
    woodCtx.lineWidth = 4;
    woodCtx.beginPath();
    woodCtx.moveTo(0, y);
    woodCtx.lineTo(512, y);
    woodCtx.stroke();
  }

  // Heavy outer steel reinforced framing
  woodCtx.lineWidth = 36;
  woodCtx.strokeStyle = '#433725';
  woodCtx.strokeRect(18, 18, 476, 476);
  woodCtx.lineWidth = 28;
  woodCtx.beginPath();
  woodCtx.moveTo(28, 28);
  woodCtx.lineTo(484, 484);
  woodCtx.moveTo(484, 28);
  woodCtx.lineTo(28, 484);
  woodCtx.stroke();
  woodCtx.strokeStyle = '#221a10';
  woodCtx.lineWidth = 3;
  woodCtx.strokeRect(34, 34, 444, 444);

  // Yellow & black hazard warning bars along top & bottom timber
  for (let hx = 36; hx < 470; hx += 24) {
    woodCtx.fillStyle = '#f59e0b';
    woodCtx.beginPath();
    woodCtx.moveTo(hx, 36);
    woodCtx.lineTo(hx + 12, 36);
    woodCtx.lineTo(hx + 4, 52);
    woodCtx.lineTo(hx - 8, 52);
    woodCtx.fill();
    woodCtx.beginPath();
    woodCtx.moveTo(hx, 460);
    woodCtx.lineTo(hx + 12, 460);
    woodCtx.lineTo(hx + 4, 476);
    woodCtx.lineTo(hx - 8, 476);
    woodCtx.fill();
  }

  // Military munitions stencils
  woodCtx.fillStyle = 'rgba(240, 240, 230, 0.85)';
  woodCtx.font = 'bold 22px monospace';
  woodCtx.fillText('ORDNANCE // 7.62 NATO', 70, 180);
  woodCtx.font = 'bold 16px monospace';
  woodCtx.fillText('EXPLOSIVE 1.1D - LOT 84', 70, 210);
  woodCtx.fillText('NET WT: 42.5 KG', 70, 235);

  // Riveted dark iron corner caps
  const crateCorners = [
    [0, 0],
    [452, 0],
    [0, 452],
    [452, 452],
  ];
  for (const [cx, cy] of crateCorners) {
    woodCtx.fillStyle = '#1e2126';
    woodCtx.fillRect(cx, cy, 60, 60);
    woodCtx.fillStyle = '#5f6775';
    woodCtx.beginPath();
    woodCtx.arc(cx + 18, cy + 18, 4.5, 0, Math.PI * 2);
    woodCtx.arc(cx + 42, cy + 42, 4.5, 0, Math.PI * 2);
    woodCtx.fill();
  }
  addNoise(woodCtx, 512, 512, 0.10);
  const woodCrateMap = registerTex(woodCanvas, true, 1, 1);

  // 6. INDUSTRIAL CORRUGATED SHIPPING CONTAINER (`metal_container`)
  const [contCanvas, contCtx] = createCanvas(512, 512);
  contCtx.fillStyle = '#143459'; // Deep industrial cobalt blue
  contCtx.fillRect(0, 0, 512, 512);

  const ribW = 24;
  for (let x = 0; x < 512; x += ribW) {
    // Trough shadow
    contCtx.fillStyle = '#0a1d33';
    contCtx.fillRect(x, 0, 6, 512);
    // Center face
    contCtx.fillStyle = '#173c66';
    contCtx.fillRect(x + 6, 0, 12, 512);
    // Ridge highlight
    contCtx.fillStyle = '#2b5a91';
    contCtx.fillRect(x + 18, 0, 6, 512);
  }

  // Steel top and bottom horizontal frame channels
  contCtx.fillStyle = '#0f243d';
  contCtx.fillRect(0, 0, 512, 34);
  contCtx.fillRect(0, 478, 512, 34);
  contCtx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  contCtx.fillRect(0, 0, 512, 3);
  contCtx.fillRect(0, 478, 512, 3);

  // Dripping rust streaks down rivets
  for (const rx of [64, 180, 290, 410]) {
    const rustGrad = contCtx.createLinearGradient(rx, 34, rx, 180);
    rustGrad.addColorStop(0, 'rgba(160, 75, 25, 0.7)');
    rustGrad.addColorStop(0.5, 'rgba(110, 45, 15, 0.4)');
    rustGrad.addColorStop(1, 'rgba(70, 30, 10, 0)');
    contCtx.fillStyle = rustGrad;
    contCtx.fillRect(rx - 8, 34, 16, 150);
  }

  // White industrial shipping stencils
  contCtx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  contCtx.font = 'bold 24px monospace';
  contCtx.fillText('TACTICAL LOGISTICS // 04', 36, 82);
  contCtx.font = 'bold 15px monospace';
  contCtx.fillText('HAZMAT CLASS 1 // SEC-B', 36, 114);
  contCtx.fillText('MAX PAYLOAD: 28,300 KG', 36, 136);

  addNoise(contCtx, 512, 512, 0.08);
  const containerMap = registerTex(contCanvas, true, 2, 1);

  // 7. REALISTIC WAR-TORN BATTLE-ZONE FLAGSTONE & GRIT GROUND (`sand_ground`)
  // Distressed dark stone flagstone paving with vehicle tire tracks, explosion blast marks & combat cracks
  const [groundCanvas, groundCtx] = createCanvas(1024, 1024);
  // Dark granite mortar base
  groundCtx.fillStyle = '#12100d';
  groundCtx.fillRect(0, 0, 1024, 1024);

  // Ashlar stone courses: varying row heights for authentic irregular flagstone paving
  const rowHeights = [85, 70, 95, 65, 80, 75, 90, 85, 70, 80, 95, 75, 79];
  let curY = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    const rh = rowHeights[r];
    let curX = -((r * 47) % 60);
    while (curX < 1024) {
      const sw = 75 + Math.floor(((r * 31 + curX * 17) % 85));
      const mortarGap = 3.5;
      const bx = curX + mortarGap;
      const by = curY + mortarGap;
      const bw = Math.min(sw - mortarGap * 2, 1024 - bx);
      const bh = rh - mortarGap * 2;

      if (bw > 4 && bh > 4) {
        // Natural battle-worn dark stone color palette:
        // Weathered granite, dark slate, charcoal river basalt, dusty sandstone
        const stonePalette = [
          [76, 70, 64],
          [88, 81, 74],
          [64, 59, 54],
          [82, 75, 68],
          [94, 86, 77],
          [68, 63, 58],
        ];
        const hash = Math.abs(Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453);
        const colIdx = Math.floor(hash * stonePalette.length) % stonePalette.length;
        const [baseR, baseG, baseB] = stonePalette[colIdx];
        const varJitter = ((hash * 11) % 18) - 9;
        const rVal = Math.max(0, Math.min(255, Math.floor(baseR + varJitter)));
        const gVal = Math.max(0, Math.min(255, Math.floor(baseG + varJitter)));
        const bVal = Math.max(0, Math.min(255, Math.floor(baseB + varJitter)));

        // Stone block fill
        groundCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
        groundCtx.fillRect(bx, by, bw, bh);

        // Chiseled stone block bevels
        groundCtx.fillStyle = 'rgba(255, 255, 255, 0.10)';
        groundCtx.fillRect(bx, by, bw, 2);
        groundCtx.fillRect(bx, by, 2, bh);
        groundCtx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        groundCtx.fillRect(bx, by + bh - 2, bw, 2);
        groundCtx.fillRect(bx + bw - 2, by, 2, bh);

        // Surface combat cracks
        if (hash % 1 > 0.55) {
          groundCtx.strokeStyle = 'rgba(12, 10, 8, 0.65)';
          groundCtx.lineWidth = 1.4;
          groundCtx.beginPath();
          groundCtx.moveTo(bx + bw * 0.2, by + bh * 0.2);
          groundCtx.lineTo(bx + bw * 0.5, by + bh * 0.55);
          groundCtx.lineTo(bx + bw * 0.85, by + bh * 0.8);
          groundCtx.stroke();
        }
      }
      curX += sw;
    }
    curY += rh;
  }

  // Tactical Military Vehicle Tire Tread Tracks running across the ground
  const trackCenters = [280, 460, 780, 960];
  for (const tc of trackCenters) {
    // Rubber compound dark lane
    groundCtx.fillStyle = 'rgba(15, 14, 12, 0.35)';
    groundCtx.fillRect(tc - 32, 0, 64, 1024);

    // Diagonal chevron tire tread cleats
    groundCtx.strokeStyle = 'rgba(8, 7, 6, 0.45)';
    groundCtx.lineWidth = 5;
    for (let ty = 0; ty < 1024; ty += 22) {
      groundCtx.beginPath();
      groundCtx.moveTo(tc - 26, ty);
      groundCtx.lineTo(tc, ty + 10);
      groundCtx.lineTo(tc + 26, ty);
      groundCtx.stroke();
    }
  }

  // Black explosive blast crater scorch marks
  const blastSpots: Array<[number, number, number]> = [
    [320, 260, 110],
    [740, 680, 130],
    [520, 840, 85],
  ];
  for (const [bx, by, br] of blastSpots) {
    const bGrad = groundCtx.createRadialGradient(bx, by, 8, bx, by, br);
    bGrad.addColorStop(0, 'rgba(8, 8, 10, 0.85)');
    bGrad.addColorStop(0.4, 'rgba(18, 16, 15, 0.55)');
    bGrad.addColorStop(0.8, 'rgba(35, 30, 25, 0.2)');
    bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    groundCtx.fillStyle = bGrad;
    groundCtx.fillRect(bx - br, by - br, br * 2, br * 2);

    // Radiating blast shrapnel streaks
    groundCtx.strokeStyle = 'rgba(5, 5, 5, 0.6)';
    groundCtx.lineWidth = 1.8;
    for (let a = 0; a < Math.PI * 2; a += 0.45) {
      const len = br * (0.6 + Math.random() * 0.4);
      groundCtx.beginPath();
      groundCtx.moveTo(bx, by);
      groundCtx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len);
      groundCtx.stroke();
    }
  }

  // Organic desert sand drifts and dust settling across the ground
  const wearDrift = groundCtx.createRadialGradient(512, 512, 80, 512, 512, 600);
  wearDrift.addColorStop(0, 'rgba(75, 60, 40, 0.12)');
  wearDrift.addColorStop(0.5, 'rgba(50, 40, 28, 0.22)');
  wearDrift.addColorStop(1, 'rgba(12, 10, 8, 0.48)');
  groundCtx.fillStyle = wearDrift;
  groundCtx.fillRect(0, 0, 1024, 1024);

  addNoise(groundCtx, 1024, 1024, 0.12);
  const sandGroundMap = registerTex(groundCanvas, true, 8, 8);

  // Dedicated Stone Flagstone Bump Map (with tire tracks & crater relief)
  const [stoneBumpCanvas, stoneBumpCtx] = createCanvas(1024, 1024);
  stoneBumpCtx.fillStyle = '#181818';
  stoneBumpCtx.fillRect(0, 0, 1024, 1024);
  curY = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    const rh = rowHeights[r];
    let curX = -((r * 47) % 60);
    while (curX < 1024) {
      const sw = 75 + Math.floor(((r * 31 + curX * 17) % 85));
      const mortarGap = 3.5;
      const bx = curX + mortarGap;
      const by = curY + mortarGap;
      const bw = Math.min(sw - mortarGap * 2, 1024 - bx);
      const bh = rh - mortarGap * 2;
      if (bw > 4 && bh > 4) {
        const hash = Math.abs(Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453);
        const stoneHeight = 160 + Math.floor(hash * 65);
        stoneBumpCtx.fillStyle = `rgb(${stoneHeight}, ${stoneHeight}, ${stoneHeight})`;
        stoneBumpCtx.fillRect(bx, by, bw, bh);
        stoneBumpCtx.fillStyle = '#ffffff';
        stoneBumpCtx.fillRect(bx, by, bw, 2);
        stoneBumpCtx.fillRect(bx, by, 2, bh);
        stoneBumpCtx.fillStyle = '#505050';
        stoneBumpCtx.fillRect(bx, by + bh - 2, bw, 2);
        stoneBumpCtx.fillRect(bx + bw - 2, by, 2, bh);
      }
      curX += sw;
    }
    curY += rh;
  }
  // Bump channels for tire tread ruts
  for (const tc of trackCenters) {
    stoneBumpCtx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    stoneBumpCtx.fillRect(tc - 30, 0, 60, 1024);
  }
  addNoise(stoneBumpCtx, 1024, 1024, 0.35);
  const stoneBumpMap = registerTex(stoneBumpCanvas, false, 8, 8);

  const materials: Record<SurfaceMaterialType, THREE.MeshStandardMaterial> = {
    sandstone: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sandstoneMap,
      bumpMap: genericBump,
      bumpScale: 0.03,
      roughness: 0.84,
      metalness: 0.05,
    }),
    brick: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: brickMap,
      bumpMap: genericBump,
      bumpScale: 0.04,
      roughness: 0.8,
      metalness: 0.06,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: concreteMap,
      bumpMap: genericBump,
      bumpScale: 0.04,
      roughness: 0.85,
      metalness: 0.08,
    }),
    wood_crate: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: woodCrateMap,
      bumpMap: genericBump,
      bumpScale: 0.035,
      roughness: 0.76,
      metalness: 0.08,
    }),
    metal_container: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: containerMap,
      bumpMap: genericBump,
      bumpScale: 0.045,
      roughness: 0.42,
      metalness: 0.7,
    }),
    asphalt: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: darkWallMap,
      bumpMap: genericBump,
      bumpScale: 0.035,
      roughness: 0.84,
      metalness: 0.1,
    }),
    sand_ground: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: sandGroundMap,
      bumpMap: stoneBumpMap,
      bumpScale: 0.08,
      roughness: 0.86,
      metalness: 0.04,
    }),
    plaster_trim: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.72,
      metalness: 0.06,
    }),
    dark_metal: new THREE.MeshStandardMaterial({
      color: 0x272c35,
      roughness: 0.35,
      metalness: 0.85,
    }),
  };

  Object.values(materials).forEach((m) => materialsToDispose.push(m));

  // Bullet Hole Decal Material
  const [decalCanvas, decalCtx] = createCanvas(64, 64);
  const radGrad = decalCtx.createRadialGradient(32, 32, 2, 32, 32, 26);
  radGrad.addColorStop(0, 'rgba(10, 10, 10, 0.96)');
  radGrad.addColorStop(0.35, 'rgba(35, 32, 28, 0.78)');
  radGrad.addColorStop(0.7, 'rgba(75, 68, 60, 0.25)');
  radGrad.addColorStop(1, 'rgba(75, 68, 60, 0)');
  decalCtx.fillStyle = radGrad;
  decalCtx.beginPath();
  decalCtx.arc(32, 32, 26, 0, Math.PI * 2);
  decalCtx.fill();
  const decalTex = registerTex(decalCanvas, true, 1, 1);

  const decalBulletMat = new THREE.MeshBasicMaterial({
    map: decalTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  materialsToDispose.push(decalBulletMat);

  // Dense Volumetric Smoke Cloud Sprite Material
  const [smokeCanvas, smokeCtx] = createCanvas(256, 256);
  const sGrad = smokeCtx.createRadialGradient(128, 128, 16, 128, 128, 124);
  sGrad.addColorStop(0, 'rgba(215, 220, 226, 1.0)');
  sGrad.addColorStop(0.65, 'rgba(195, 200, 208, 0.96)');
  sGrad.addColorStop(0.85, 'rgba(175, 180, 188, 0.72)');
  sGrad.addColorStop(1, 'rgba(160, 165, 172, 0)');
  smokeCtx.fillStyle = sGrad;
  smokeCtx.fillRect(0, 0, 256, 256);
  const smokeTex = registerTex(smokeCanvas, true, 1, 1);
  const smokeSpriteMat = new THREE.SpriteMaterial({
    map: smokeTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.96,
  });
  materialsToDispose.push(smokeSpriteMat);

  // Soft Contact Shadow Material
  const [shadowCanvas, shadowCtx] = createCanvas(64, 64);
  const shGrad = shadowCtx.createRadialGradient(32, 32, 4, 32, 32, 30);
  shGrad.addColorStop(0, 'rgba(0, 0, 0, 0.56)');
  shGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.24)');
  shGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  shadowCtx.fillStyle = shGrad;
  shadowCtx.fillRect(0, 0, 64, 64);
  const shadowTex = registerTex(shadowCanvas, true, 1, 1);
  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
  });
  materialsToDispose.push(contactShadowMat);

  // Atmospheric Tactical Skybox CanvasTexture (Night / Twilight Fortress Sky)
  const [skyCanvas, skyCtx] = createCanvas(512, 256);
  const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#060911');
  skyGrad.addColorStop(0.4, '#0e1420');
  skyGrad.addColorStop(0.75, '#151d2a');
  skyGrad.addColorStop(1, '#1b2434');
  skyCtx.fillStyle = skyGrad;
  skyCtx.fillRect(0, 0, 512, 256);
  const skyTexture = registerTex(skyCanvas, true, 1, 1);
  skyTexture.mapping = THREE.EquirectangularReflectionMapping;

  const createSignMaterial = (text: string, color: string): THREE.MeshBasicMaterial => {
    const [c, ctx] = createCanvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(15, 18, 24, 0.82)';
    ctx.fillRect(14, 14, 228, 228);
    ctx.strokeStyle = color;
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, 220, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 124px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 134);
    const t = registerTex(c, true, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materialsToDispose.push(mat);
    return mat;
  };

  /**
   * Creates the tactical battle-worn Bombsite A / B floor decal with hazard stripes & crosshairs
   */
  const createBombsiteFloorMaterial = (site: 'A' | 'B'): THREE.MeshStandardMaterial => {
    const [c, ctx] = createCanvas(512, 512);
    ctx.fillStyle = 'rgba(140, 24, 24, 0.58)';
    ctx.fillRect(0, 0, 512, 512);

    // Diagonal Yellow & Black tactical hazard stripes along the border
    const hazardSize = 24;
    for (let x = 0; x < 512; x += hazardSize) {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(x, 0, hazardSize * 0.5, 20);
      ctx.fillRect(x, 492, hazardSize * 0.5, 20);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(x + hazardSize * 0.5, 0, hazardSize * 0.5, 20);
      ctx.fillRect(x + hazardSize * 0.5, 492, hazardSize * 0.5, 20);
    }
    for (let y = 0; y < 512; y += hazardSize) {
      ctx.fillStyle = '#eab308';
      ctx.fillRect(0, y, 20, hazardSize * 0.5);
      ctx.fillRect(492, y, 20, hazardSize * 0.5);
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, y + hazardSize * 0.5, 20, hazardSize * 0.5);
      ctx.fillRect(492, y + hazardSize * 0.5, 20, hazardSize * 0.5);
    }

    // Inner bright red tactical perimeter
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 6;
    ctx.strokeRect(26, 26, 460, 460);

    // Targeting crosshair lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(256, 32);
    ctx.lineTo(256, 120);
    ctx.moveTo(256, 360);
    ctx.lineTo(256, 448);
    ctx.moveTo(32, 240);
    ctx.lineTo(120, 240);
    ctx.moveTo(360, 240);
    ctx.lineTo(448, 240);
    ctx.stroke();

    // Large white 'A' or 'B' with red tactical glow
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 220px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(site, 256, 236);
    ctx.shadowBlur = 0;

    // Bottom pill badge 'A SITE' / 'B SITE'
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(136, 410, 240, 56);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.strokeRect(136, 410, 240, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Rajdhani, sans-serif';
    ctx.fillText(`ZONE ${site} // C4`, 256, 440);

    // Explosive soot scorch in corner
    const bGrad = ctx.createRadialGradient(380, 360, 10, 380, 360, 120);
    bGrad.addColorStop(0, 'rgba(10, 8, 8, 0.85)');
    bGrad.addColorStop(0.5, 'rgba(20, 15, 12, 0.45)');
    bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bGrad;
    ctx.fillRect(260, 240, 240, 240);

    addNoise(ctx, 512, 512, 0.12);

    const tex = registerTex(c, true, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: stoneBumpMap,
      bumpScale: 0.05,
      transparent: true,
      roughness: 0.82,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    materialsToDispose.push(mat);
    return mat;
  };

  return {
    materials,
    decalBulletMat,
    smokeSpriteMat,
    contactShadowMat,
    skyTexture,
    createSignMaterial,
    createBombsiteFloorMaterial,
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}
