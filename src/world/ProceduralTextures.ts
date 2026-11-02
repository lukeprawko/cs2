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
  // Weathered dark fortress stone masonry blocks with dark coping trim matching reference map
  const [darkWallCanvas, darkWallCtx] = createCanvas(512, 512);
  darkWallCtx.fillStyle = '#12151b'; // Dark stone mortar
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
      const shade = 28 + Math.floor(hash * 14);
      darkWallCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      darkWallCtx.fillRect(colX + 2, rowY + 2, bw, bh);

      // Chiseled block highlights & shadows
      darkWallCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      darkWallCtx.fillRect(colX + 2, rowY + 2, bw, 2);
      darkWallCtx.fillRect(colX + 2, rowY + 2, 2, bh);
      darkWallCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      darkWallCtx.fillRect(colX + 2, rowY + bh, bw, 2);
      darkWallCtx.fillRect(colX + bw, rowY + 2, 2, bh);
    }
  }

  // Dark stone / iron parapet coping band at top
  darkWallCtx.fillStyle = '#15171d';
  darkWallCtx.fillRect(0, 0, 512, 26);
  darkWallCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  darkWallCtx.fillRect(0, 0, 512, 3);
  darkWallCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  darkWallCtx.fillRect(0, 24, 512, 2);

  // Bottom subtle damp stone base
  const wallDirtGrad = darkWallCtx.createLinearGradient(0, 420, 0, 512);
  wallDirtGrad.addColorStop(0, 'rgba(20, 22, 28, 0)');
  wallDirtGrad.addColorStop(1, 'rgba(12, 14, 18, 0.55)');
  darkWallCtx.fillStyle = wallDirtGrad;
  darkWallCtx.fillRect(0, 420, 512, 92);
  addNoise(darkWallCtx, 512, 512, 0.08);
  const darkWallMap = registerTex(darkWallCanvas, true, 4, 1);

  // 2. FORTRESS PERIMETER ASHLAR STONE WALL (`concrete`)
  // Heavy dressed medieval stone blocks with battlement coping matching reference map
  const [concCanvas, concCtx] = createCanvas(512, 512);
  concCtx.fillStyle = '#1a1e24'; // Mortar
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
      const shade = 48 + Math.floor(hash * 18);
      concCtx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 3})`;
      concCtx.fillRect(colX + 2, rowY + 2, bw, bh);

      // Chiseled stone block bevels
      concCtx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      concCtx.fillRect(colX + 2, rowY + 2, bw, 2);
      concCtx.fillRect(colX + 2, rowY + 2, 2, bh);
      concCtx.fillStyle = 'rgba(0, 0, 0, 0.48)';
      concCtx.fillRect(colX + 2, rowY + bh, bw, 2);
      concCtx.fillRect(colX + bw, rowY + 2, 2, bh);
    }
  }

  // Heavy stone battlement coping band at top
  concCtx.fillStyle = '#222730';
  concCtx.fillRect(0, 0, 512, 30);
  concCtx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  concCtx.fillRect(0, 0, 512, 4);
  concCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  concCtx.fillRect(0, 28, 512, 2);

  const concDirt = concCtx.createLinearGradient(0, 410, 0, 512);
  concDirt.addColorStop(0, 'rgba(18, 21, 26, 0)');
  concDirt.addColorStop(1, 'rgba(12, 14, 18, 0.6)');
  concCtx.fillStyle = concDirt;
  concCtx.fillRect(0, 410, 512, 102);
  addNoise(concCtx, 512, 512, 0.09);
  const concreteMap = registerTex(concCanvas, true, 4, 1);

  // 3. SANDSTONE PLASTER
  const [sandCanvas, sandCtx] = createCanvas(512, 512);
  sandCtx.fillStyle = '#c4ab89';
  sandCtx.fillRect(0, 0, 512, 512);
  addNoise(sandCtx, 512, 512, 0.1);
  const sandstoneMap = registerTex(sandCanvas, true, 2, 1);

  // 4. WEATHERED BRICK
  const [brickCanvas, brickCtx] = createCanvas(512, 512);
  brickCtx.fillStyle = '#8b6852';
  brickCtx.fillRect(0, 0, 512, 512);
  const rows = 12;
  const cols = 6;
  const bh = 512 / rows;
  const bw = 512 / cols;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const shade = 125 + Math.floor(Math.random() * 40);
      brickCtx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.64)}, ${Math.floor(shade * 0.48)})`;
      brickCtx.fillRect(c * bw + offset + 3, r * bh + 3, bw - 6, bh - 6);
    }
  }
  addNoise(brickCtx, 512, 512, 0.1);
  const brickMap = registerTex(brickCanvas, true, 2, 2);

  // 5. MILITARY WOODEN CRATE (`wood_crate`)
  const [woodCanvas, woodCtx] = createCanvas(512, 512);
  woodCtx.fillStyle = '#8f6339';
  woodCtx.fillRect(0, 0, 512, 512);
  // Horizontal wood grain & slat seams
  for (let y = 0; y < 512; y += 64) {
    woodCtx.fillStyle = y % 128 === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(255,220,180,0.05)';
    woodCtx.fillRect(0, y, 512, 64);
    woodCtx.strokeStyle = '#4a3119';
    woodCtx.lineWidth = 4;
    woodCtx.beginPath();
    woodCtx.moveTo(0, y);
    woodCtx.lineTo(512, y);
    woodCtx.stroke();
  }
  // Heavy outer timber frame + diagonal cross-beams
  woodCtx.lineWidth = 34;
  woodCtx.strokeStyle = '#6e4a28';
  woodCtx.strokeRect(17, 17, 478, 478);
  woodCtx.lineWidth = 26;
  woodCtx.beginPath();
  woodCtx.moveTo(28, 28);
  woodCtx.lineTo(484, 484);
  woodCtx.moveTo(484, 28);
  woodCtx.lineTo(28, 484);
  woodCtx.stroke();
  woodCtx.strokeStyle = '#3d2713';
  woodCtx.lineWidth = 3;
  woodCtx.strokeRect(34, 34, 444, 444);

  // Dark steel corner brackets & bolt rivets
  const corners = [
    [0, 0],
    [452, 0],
    [0, 452],
    [452, 452],
  ];
  for (const [cx, cy] of corners) {
    woodCtx.fillStyle = '#23272e';
    woodCtx.fillRect(cx, cy, 60, 60);
    woodCtx.fillStyle = '#525866';
    woodCtx.beginPath();
    woodCtx.arc(cx + 18, cy + 18, 4, 0, Math.PI * 2);
    woodCtx.arc(cx + 42, cy + 42, 4, 0, Math.PI * 2);
    woodCtx.fill();
  }
  addNoise(woodCtx, 512, 512, 0.09);
  const woodCrateMap = registerTex(woodCanvas, true, 1, 1);

  // 6. INDUSTRIAL COBALT BLUE CORRUGATED SHIPPING CONTAINER
  // Matches the blue shipping containers on B Site, Long A, and T Spawn
  const [contCanvas, contCtx] = createCanvas(512, 512);
  contCtx.fillStyle = '#173c66'; // Cobalt industrial container blue
  contCtx.fillRect(0, 0, 512, 512);

  const ribW = 24;
  for (let x = 0; x < 512; x += ribW) {
    // Trough shadow
    contCtx.fillStyle = '#0e2440';
    contCtx.fillRect(x, 0, 6, 512);
    // Center face
    contCtx.fillStyle = '#1b4576';
    contCtx.fillRect(x + 6, 0, 12, 512);
    // Ridge highlight
    contCtx.fillStyle = '#2d62a2';
    contCtx.fillRect(x + 18, 0, 6, 512);
  }

  // Steel top and bottom horizontal frame channels
  contCtx.fillStyle = '#102744';
  contCtx.fillRect(0, 0, 512, 34);
  contCtx.fillRect(0, 478, 512, 34);
  contCtx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  contCtx.fillRect(0, 0, 512, 3);
  contCtx.fillRect(0, 478, 512, 3);

  // White industrial shipping stencils
  contCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  contCtx.font = 'bold 24px monospace';
  contCtx.fillText('MSKU 841920-4', 40, 82);
  contCtx.font = 'bold 15px monospace';
  contCtx.fillText('MAX. GROSS  30,480 KG', 40, 114);
  contCtx.fillText('PAYLOAD     28,300 KG', 40, 136);

  addNoise(contCtx, 512, 512, 0.08);
  const containerMap = registerTex(contCanvas, true, 2, 1);

  // 7. REALISTIC ANCIENT ASHLAR FLAGSTONE & COBBLESTONE GROUND (`sand_ground`)
  // Recreates the exact distressed dark granite and slate stone paving from reference map
  const [groundCanvas, groundCtx] = createCanvas(1024, 1024);
  // Dark granite mortar base
  groundCtx.fillStyle = '#141210';
  groundCtx.fillRect(0, 0, 1024, 1024);

  // Ashlar stone courses: varying row heights for authentic irregular flagstone paving
  const rowHeights = [85, 70, 95, 65, 80, 75, 90, 85, 70, 80, 95, 75, 79];
  let curY = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    const rh = rowHeights[r];
    let curX = -((r * 47) % 60);
    while (curX < 1024) {
      const sw = 75 + Math.floor(((r * 31 + curX * 17) % 85));
      const mortarGap = 3;
      const bx = curX + mortarGap;
      const by = curY + mortarGap;
      const bw = Math.min(sw - mortarGap * 2, 1024 - bx);
      const bh = rh - mortarGap * 2;

      if (bw > 4 && bh > 4) {
        // Natural dark stone color palette matching reference map 1:1:
        // Weathered granite, dark ashlar slate, charcoal river stone, cool basalt
        const stonePalette = [
          [72, 67, 62],
          [84, 78, 71],
          [62, 58, 54],
          [76, 71, 65],
          [88, 81, 73],
          [65, 61, 57],
        ];
        const hash = Math.abs(Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453);
        const colIdx = Math.floor(hash * stonePalette.length) % stonePalette.length;
        const [baseR, baseG, baseB] = stonePalette[colIdx];
        const varJitter = ((hash * 11) % 16) - 8;
        const rVal = Math.max(0, Math.min(255, Math.floor(baseR + varJitter)));
        const gVal = Math.max(0, Math.min(255, Math.floor(baseG + varJitter)));
        const bVal = Math.max(0, Math.min(255, Math.floor(baseB + varJitter)));

        // Stone block fill
        groundCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
        groundCtx.fillRect(bx, by, bw, bh);

        // Chiseled stone block bevels
        groundCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        groundCtx.fillRect(bx, by, bw, 2);
        groundCtx.fillRect(bx, by, 2, bh);
        groundCtx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        groundCtx.fillRect(bx, by + bh - 2, bw, 2);
        groundCtx.fillRect(bx + bw - 2, by, 2, bh);

        // Surface micro-cracks
        if (hash % 1 > 0.65) {
          groundCtx.strokeStyle = 'rgba(15, 13, 11, 0.55)';
          groundCtx.lineWidth = 1.2;
          groundCtx.beginPath();
          groundCtx.moveTo(bx + bw * 0.25, by + bh * 0.2);
          groundCtx.lineTo(bx + bw * 0.55, by + bh * 0.5);
          groundCtx.lineTo(bx + bw * 0.8, by + bh * 0.75);
          groundCtx.stroke();
        }
      }
      curX += sw;
    }
    curY += rh;
  }

  // Organic soot, grime, and corner shadow vignette
  const wearDrift = groundCtx.createRadialGradient(512, 512, 80, 512, 512, 600);
  wearDrift.addColorStop(0, 'rgba(40, 36, 32, 0.15)');
  wearDrift.addColorStop(0.5, 'rgba(25, 22, 19, 0.25)');
  wearDrift.addColorStop(1, 'rgba(12, 10, 8, 0.45)');
  groundCtx.fillStyle = wearDrift;
  groundCtx.fillRect(0, 0, 1024, 1024);

  addNoise(groundCtx, 1024, 1024, 0.12);
  const sandGroundMap = registerTex(groundCanvas, true, 8, 8);

  // Dedicated Stone Flagstone Bump Map
  const [stoneBumpCanvas, stoneBumpCtx] = createCanvas(1024, 1024);
  stoneBumpCtx.fillStyle = '#202020';
  stoneBumpCtx.fillRect(0, 0, 1024, 1024);
  curY = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    const rh = rowHeights[r];
    let curX = -((r * 47) % 60);
    while (curX < 1024) {
      const sw = 75 + Math.floor(((r * 31 + curX * 17) % 85));
      const mortarGap = 3;
      const bx = curX + mortarGap;
      const by = curY + mortarGap;
      const bw = Math.min(sw - mortarGap * 2, 1024 - bx);
      const bh = rh - mortarGap * 2;
      if (bw > 4 && bh > 4) {
        const hash = Math.abs(Math.sin(bx * 12.9898 + by * 78.233) * 43758.5453);
        const stoneHeight = 160 + Math.floor(hash * 60);
        stoneBumpCtx.fillStyle = `rgb(${stoneHeight}, ${stoneHeight}, ${stoneHeight})`;
        stoneBumpCtx.fillRect(bx, by, bw, bh);
        stoneBumpCtx.fillStyle = '#ffffff';
        stoneBumpCtx.fillRect(bx, by, bw, 2);
        stoneBumpCtx.fillRect(bx, by, 2, bh);
        stoneBumpCtx.fillStyle = '#606060';
        stoneBumpCtx.fillRect(bx, by + bh - 2, bw, 2);
        stoneBumpCtx.fillRect(bx + bw - 2, by, 2, bh);
      }
      curX += sw;
    }
    curY += rh;
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
      bumpScale: 0.06,
      roughness: 0.88,
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
   * Creates the red Bombsite A / B floor decal material matching the blueprint image
   */
  const createBombsiteFloorMaterial = (site: 'A' | 'B'): THREE.MeshStandardMaterial => {
    const [c, ctx] = createCanvas(512, 512);
    ctx.fillStyle = 'rgba(153, 27, 27, 0.52)';
    ctx.fillRect(0, 0, 512, 512);

    // Bright red tactical border + corner brackets
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 498);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, 464, 464);

    // Large white 'A' or 'B' with red glow in center
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 240px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(site, 256, 246);
    ctx.shadowBlur = 0;

    // Bottom pill badge 'A SITE' / 'B SITE'
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(146, 420, 220, 56);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.strokeRect(146, 420, 220, 56);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Rajdhani, sans-serif';
    ctx.fillText(`${site} SITE`, 256, 450);

    const tex = registerTex(c, true, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: stoneBumpMap,
      bumpScale: 0.04,
      transparent: true,
      roughness: 0.75,
      metalness: 0.1,
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
