import * as THREE from 'three';
import { Team, WEAPONS_DB, WeaponId } from '../game/WeaponsDB';

function makeGunMetalTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2d323a';
  ctx.fillRect(0, 0, 256, 256);
  // Horizontal brushed steel striations
  for (let y = 0; y < 256; y += 2) {
    const shade = 40 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 9})`;
    ctx.fillRect(0, y, 256, 1);
  }
  // Subtle machined grooves
  ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
  for (let x = 16; x < 256; x += 32) {
    ctx.fillRect(x, 0, 2, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makePolymerGripTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#181b20';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#252931';
  for (let y = 0; y < 128; y += 4) {
    for (let x = y % 8 === 0 ? 0 : 2; x < 128; x += 4) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeWoodFurnitureTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7c3a16';
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 2) {
    ctx.fillStyle =
      y % 8 === 0
        ? 'rgba(40, 16, 5, 0.38)'
        : y % 5 === 0
        ? 'rgba(180, 95, 38, 0.22)'
        : 'rgba(110, 48, 18, 0.15)';
    ctx.fillRect(0, y, 256, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFabricCamoTexture(baseHex: string, accentHex: string, darkHex = '#111827'): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  // Organic military camo pattern
  ctx.fillStyle = accentHex;
  for (let i = 0; i < 36; i++) {
    const bx = (i * 47) % 230;
    const by = (i * 73) % 230;
    const bw = 24 + ((i * 17) % 36);
    const bh = 18 + ((i * 29) % 28);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 8) : ctx.fillRect(bx, by, bw, bh);
    ctx.fill();
  }
  ctx.fillStyle = darkHex;
  for (let i = 0; i < 28; i++) {
    const bx = (i * 61) % 236;
    const by = (i * 89) % 236;
    const bw = 14 + ((i * 13) % 22);
    const bh = 10 + ((i * 23) % 18);
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 5) : ctx.fillRect(bx, by, bw, bh);
    ctx.fill();
  }
  // Ripstop tactile weave grid
  ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < 256; y += 8) {
    ctx.fillRect(0, y, 256, 1);
  }
  for (let x = 0; x < 256; x += 8) {
    ctx.fillRect(x, 0, 1, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function makeFaceEyesTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  // Skin tone in balaclava cutout
  ctx.fillStyle = '#c89578';
  ctx.fillRect(0, 0, 128, 64);
  // Brow shadows
  ctx.fillStyle = '#8a5c43';
  ctx.fillRect(20, 14, 34, 6);
  ctx.fillRect(74, 14, 34, 6);
  // Eye whites
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(26, 24, 22, 12);
  ctx.fillRect(80, 24, 22, 12);
  // Irises
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(33, 24, 9, 12);
  ctx.fillRect(87, 24, 9, 12);
  // Catchlight
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(34, 26, 3, 3);
  ctx.fillRect(88, 26, 3, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSandbagTexture(): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement);
  }
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#b89d74';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#9b8058';
  for (let y = 0; y < 128; y += 4) {
    ctx.fillRect(0, y, 128, 1);
  }
  for (let x = 0; x < 128; x += 4) {
    ctx.fillRect(x, 0, 1, 128);
  }
  // Coarse burlap specs
  for (let i = 0; i < 200; i++) {
    const x = (i * 37) % 128;
    const y = (i * 71) % 128;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(60,45,25,0.22)' : 'rgba(230,210,180,0.25)';
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const brushedSteelTex = makeGunMetalTexture();
const polymerGripTex = makePolymerGripTexture();
const woodStockTex = makeWoodFurnitureTexture();
const ctFabricTex = makeFabricCamoTexture('#1e334a', '#142334', '#0d1722');
const tFabricTex = makeFabricCamoTexture('#8c5e31', '#6d4824', '#3b2512');
const faceEyesTex = makeFaceEyesTexture();
const sandbagTex = makeSandbagTexture();

// Shared PBR materials for weapons, hands, characters, and props
const gunSteelDark = new THREE.MeshStandardMaterial({
  color: 0x262b33,
  map: brushedSteelTex,
  roughness: 0.32,
  metalness: 0.88,
});
const gunSteelBrushed = new THREE.MeshStandardMaterial({
  color: 0x5c6570,
  map: brushedSteelTex,
  roughness: 0.25,
  metalness: 0.92,
});
const gunChrome = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  map: brushedSteelTex,
  roughness: 0.16,
  metalness: 0.96,
});
const polymerMatte = new THREE.MeshStandardMaterial({
  color: 0x1a1d22,
  map: polymerGripTex,
  roughness: 0.72,
  metalness: 0.18,
});
const olivePolymer = new THREE.MeshStandardMaterial({
  color: 0x364932,
  map: polymerGripTex,
  roughness: 0.62,
  metalness: 0.2,
});
const tanPolymer = new THREE.MeshStandardMaterial({
  color: 0x856d4d,
  map: polymerGripTex,
  roughness: 0.66,
  metalness: 0.16,
});
const woodFurniture = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: woodStockTex,
  roughness: 0.46,
  metalness: 0.08,
});
const bakeliteMagMat = new THREE.MeshStandardMaterial({
  color: 0xc2591b,
  map: woodStockTex,
  roughness: 0.42,
  metalness: 0.18,
});
const lensGlass = new THREE.MeshStandardMaterial({
  color: 0x10b981,
  emissive: 0x059669,
  emissiveIntensity: 0.55,
  roughness: 0.08,
  metalness: 0.94,
});
const amberAccent = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.34,
  metalness: 0.7,
});
const tritiumDotMat = new THREE.MeshBasicMaterial({
  color: 0x4ade80,
});

/**
 * Builds a high-detail, silhouette-accurate Counter-Strike 3D weapon model
 * with articulated `magazine` and `slide` sub-objects for reload & blowback animations.
 */
export function createWeaponModel(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();

  // 1. M9 BAYONET TACTICAL KNIFE
  if (weaponId === 'knife') {
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.018, 0.125, 14),
      polymerMatte
    );
    handle.rotation.x = Math.PI / 2;

    // Ribbed grip grooves
    for (let i = -2; i <= 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.0175, 0.0022, 8, 14),
        gunSteelDark
      );
      ring.position.z = i * 0.018;
      group.add(ring);
    }

    const pommel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.018, 14),
      gunSteelBrushed
    );
    pommel.rotation.x = Math.PI / 2;
    pommel.position.z = 0.068;

    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.078, 0.012),
      gunSteelBrushed
    );
    guard.position.z = -0.064;

    const barrelRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.011, 0.003, 8, 14),
      gunSteelBrushed
    );
    barrelRing.position.set(0, 0.026, -0.064);

    // Bowie/M9 clip-point main blade + beveled edge + fuller + spine sawteeth
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.0045, 0.036, 0.21),
      gunChrome
    );
    blade.position.set(0, 0.003, -0.17);

    const bladeTip = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.055, 4),
      gunChrome
    );
    bladeTip.rotation.x = -Math.PI / 2;
    bladeTip.rotation.z = Math.PI / 4;
    bladeTip.scale.set(0.22, 1, 1);
    bladeTip.position.set(0, 0.003, -0.29);

    const bloodGroove = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.008, 0.145),
      gunSteelDark
    );
    bloodGroove.position.set(0, 0.007, -0.155);

    const spineSaw = new THREE.Mesh(
      new THREE.BoxGeometry(0.0055, 0.006, 0.1),
      gunSteelBrushed
    );
    spineSaw.position.set(0, 0.022, -0.13);

    group.add(handle, pommel, guard, barrelRing, blade, bladeTip, bloodGroove, spineSaw);
    return group;
  }

  // 2. C4 EXPLOSIVE CHARGE
  if (weaponId === 'c4') {
    const blockL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.068, 0.21), olivePolymer);
    blockL.position.x = -0.054;
    const blockR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.068, 0.21), olivePolymer);
    blockR.position.x = 0.054;
    const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.074, 0.026), polymerMatte);
    strap1.position.z = -0.055;
    const strap2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.074, 0.026), polymerMatte);
    strap2.position.z = 0.055;
    const keypad = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.024, 0.105), gunSteelDark);
    keypad.position.set(0, 0.04, 0.01);
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.027, 0.032),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b })
    );
    screen.position.set(0, 0.042, -0.022);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    led.name = 'c4_led';
    led.position.set(0.038, 0.046, -0.055);
    group.add(blockL, blockR, strap1, strap2, keypad, screen, led);
    return group;
  }

  // 3. TACTICAL GRENADES (HE, FLASHBANG, SMOKE)
  if (
    weaponId === 'he_grenade' ||
    weaponId === 'flashbang' ||
    weaponId === 'smoke_grenade'
  ) {
    const isHe = weaponId === 'he_grenade';
    const isFlash = weaponId === 'flashbang';
    const bodyMat = isHe ? olivePolymer : isFlash ? gunSteelBrushed : gunSteelDark;
    const bodyGeo = isHe
      ? new THREE.SphereGeometry(0.044, 14, 12)
      : new THREE.CylinderGeometry(0.034, 0.034, 0.115, 14);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    if (isHe) body.scale.y = 1.25;

    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.036, 0.018, 14),
      amberAccent
    );
    band.position.y = 0.02;

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.022, 0.032, 12),
      gunSteelBrushed
    );
    neck.position.y = 0.068;

    const spoon = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.088, 0.02),
      gunChrome
    );
    spoon.position.set(0.026, 0.02, 0);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.013, 0.0028, 8, 14),
      gunChrome
    );
    ring.name = 'slide'; // allows pin-pull animation on draw/throw
    ring.position.set(-0.018, 0.068, 0);
    ring.userData.homePos = ring.position.clone();

    group.add(body, band, neck, spoon, ring);
    return group;
  }

  // 4. PISTOLS: GLOCK-18, USP-S, P250, DESERT EAGLE, CZ75-AUTO
  if (
    weaponId === 'glock' ||
    weaponId === 'usp' ||
    weaponId === 'p250' ||
    weaponId === 'deagle' ||
    weaponId === 'cz75'
  ) {
    const isDeagle = weaponId === 'deagle';
    const isUsp = weaponId === 'usp';
    const isP250 = weaponId === 'p250';
    const isCz = weaponId === 'cz75';
    const slideMat = isDeagle
      ? gunChrome
      : isUsp
      ? gunSteelBrushed
      : isP250
      ? gunSteelDark
      : gunSteelDark;
    const frameMat = isDeagle ? gunSteelDark : polymerMatte;

    const frameLen = isDeagle ? 0.225 : isUsp ? 0.195 : 0.182;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(isDeagle ? 0.036 : 0.032, 0.026, frameLen),
      frameMat
    );
    frame.position.set(0, 0.004, -0.012);

    // Picatinny accessory rail slots under dust cover
    const underRail = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.008, frameLen * 0.45),
      gunSteelDark
    );
    underRail.position.set(0, -0.01, -frameLen * 0.28);

    // Articulated reciprocating slide
    const slideGroup = new THREE.Group();
    slideGroup.name = 'slide';
    slideGroup.position.set(0, 0.03, -0.012);
    slideGroup.userData.homePos = slideGroup.position.clone();

    const slideLen = isDeagle ? 0.24 : isUsp ? 0.2 : 0.188;
    const slideMesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        isDeagle ? 0.041 : 0.034,
        isDeagle ? 0.042 : 0.032,
        slideLen
      ),
      slideMat
    );

    // Top bevel on slide
    const slideTop = new THREE.Mesh(
      new THREE.BoxGeometry(
        isDeagle ? 0.03 : 0.026,
        0.006,
        slideLen * 0.96
      ),
      slideMat
    );
    slideTop.position.set(0, isDeagle ? 0.023 : 0.018, 0);

    const ejectionPort = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, 0.015, 0.04),
      polymerMatte
    );
    ejectionPort.position.set(0.002, 0.006, 0.008);

    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.01, 0.012),
      tritiumDotMat
    );
    frontSight.position.set(0, isDeagle ? 0.026 : 0.021, -slideLen * 0.44);

    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.01, 0.012),
      gunSteelDark
    );
    rearSight.position.set(0, isDeagle ? 0.026 : 0.021, slideLen * 0.43);

    slideGroup.add(slideMesh, slideTop, ejectionPort, frontSight, rearSight);

    // Ergonomic angled pistol grip + backstrap + magwell baseplate
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.031, 0.112, 0.046),
      polymerMatte
    );
    grip.position.set(0, -0.054, 0.06);
    grip.rotation.x = 0.25;

    // Detachable pistol magazine inside grip (`magazine`)
    const magGroup = new THREE.Group();
    magGroup.name = 'magazine';
    magGroup.position.set(0, -0.06, 0.062);
    magGroup.rotation.x = 0.25;
    magGroup.userData.homePos = magGroup.position.clone();
    magGroup.userData.homeRot = magGroup.rotation.clone();

    const magBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.112, 0.036),
      gunSteelBrushed
    );
    const magBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.033, 0.014, 0.048),
      polymerMatte
    );
    magBase.position.set(0, -0.058, 0);
    magGroup.add(magBody, magBase);

    // Barrel
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(isDeagle ? 0.011 : 0.008, isDeagle ? 0.011 : 0.008, slideLen * 1.02, 12),
      gunChrome
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.028, -0.02);

    // Trigger guard + curved trigger
    const triggerGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.028, 0.052),
      frameMat
    );
    triggerGuard.position.set(0, -0.019, 0.02);

    const trigger = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.02, 0.008),
      gunSteelBrushed
    );
    trigger.position.set(0, -0.012, 0.028);
    trigger.rotation.x = 0.35;

    group.add(frame, underRail, slideGroup, grip, magGroup, barrel, triggerGuard, trigger);

    if (isUsp) {
      // Iconic USP-S KAC cylindrical suppressor
      const suppressor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0165, 0.0165, 0.175, 16),
        gunSteelDark
      );
      suppressor.rotation.x = Math.PI / 2;
      suppressor.position.set(0, 0.029, -0.205);
      group.add(suppressor);
    } else if (isCz) {
      // CZ75-Auto front-mounted spare magazine tactical grip
      const frontMag = new THREE.Mesh(
        new THREE.BoxGeometry(0.023, 0.088, 0.032),
        gunSteelDark
      );
      frontMag.position.set(0, -0.042, -0.068);
      frontMag.rotation.x = -0.22;
      group.add(frontMag);
    }
    return group;
  }

  // 5. RIFLES, SMGS, SHOTGUNS & SNIPERS
  const isAk = weaponId === 'ak47';
  const isGalil = weaponId === 'galil';
  const isM4 = weaponId === 'm4a1s';
  const isFamas = weaponId === 'famas';
  const isAwp = weaponId === 'awp';
  const isSsg = weaponId === 'ssg08';
  const isAug = weaponId === 'aug';
  const isNova = weaponId === 'nova';
  const isSmg = weaponId === 'mp9' || weaponId === 'mac10' || weaponId === 'ump45';

  // --- SPECIALIZED ICONIC AK-47 KALASHNIKOV ---
  if (isAk) {
    // Stamped steel receiver + angled back
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.062, 0.28),
      gunSteelDark
    );
    receiver.position.set(0, 0, 0.01);

    // Ribbed top dust cover
    const dustCover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.26, 12),
      gunSteelBrushed
    );
    dustCover.rotation.x = Math.PI / 2;
    dustCover.position.set(0, 0.032, 0.015);

    // Reciprocating bolt carrier + charging handle (`slide`)
    const boltGroup = new THREE.Group();
    boltGroup.name = 'slide';
    boltGroup.position.set(0, 0.024, -0.03);
    boltGroup.userData.homePos = boltGroup.position.clone();
    const boltCarrier = new THREE.Mesh(
      new THREE.BoxGeometry(0.046, 0.02, 0.085),
      gunChrome
    );
    const chargingHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.038, 10),
      gunSteelBrushed
    );
    chargingHandle.rotation.z = Math.PI / 2;
    chargingHandle.position.set(0.028, 0.004, -0.02);
    boltGroup.add(boltCarrier, chargingHandle);

    // Varnished wood lower & upper handguards
    const lowerHg = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.038, 0.21),
      woodFurniture
    );
    lowerHg.position.set(0, -0.004, -0.235);

    const upperHg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.18, 12),
      woodFurniture
    );
    upperHg.rotation.x = Math.PI / 2;
    upperHg.position.set(0, 0.026, -0.22);

    // Barrel + Gas Tube + Angled Gas Block + Front Sight Triangle + Slant Muzzle Brake
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.012, 0.48, 12),
      gunSteelDark
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.37);

    const gasTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.24, 10),
      gunSteelBrushed
    );
    gasTube.rotation.x = Math.PI / 2;
    gasTube.position.set(0, 0.028, -0.26);

    const gasBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.038, 0.028),
      gunSteelDark
    );
    gasBlock.position.set(0, 0.018, -0.38);
    gasBlock.rotation.x = 0.25;

    const frontSightTower = new THREE.Mesh(
      new THREE.BoxGeometry(0.016, 0.052, 0.024),
      gunSteelDark
    );
    frontSightTower.position.set(0, 0.028, -0.55);

    const slantBrake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.042, 12),
      gunSteelBrushed
    );
    slantBrake.rotation.x = Math.PI / 2;
    slantBrake.position.set(0, 0.008, -0.61);

    // Iconic 2-segment curved Bakelite 30-round "banana" magazine (`magazine`)
    const magGroup = new THREE.Group();
    magGroup.name = 'magazine';
    magGroup.position.set(0, -0.095, -0.055);
    magGroup.rotation.x = -0.28;
    magGroup.userData.homePos = magGroup.position.clone();
    magGroup.userData.homeRot = magGroup.rotation.clone();

    const magUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.11, 0.062),
      bakeliteMagMat
    );
    const magLower = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.11, 0.062),
      bakeliteMagMat
    );
    magLower.position.set(0, -0.088, -0.026);
    magLower.rotation.x = -0.32;
    magGroup.add(magUpper, magLower);

    // Wooden pistol grip + wooden fixed buttstock (angled downward like real AKM)
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.11, 0.045),
      woodFurniture
    );
    grip.position.set(0, -0.072, 0.095);
    grip.rotation.x = 0.28;

    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.085, 0.25),
      woodFurniture
    );
    stock.position.set(0, -0.024, 0.265);
    stock.rotation.x = -0.11;

    const rearLeafSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.016, 0.055),
      gunSteelBrushed
    );
    rearLeafSight.position.set(0, 0.044, -0.11);

    group.add(
      receiver,
      dustCover,
      boltGroup,
      lowerHg,
      upperHg,
      barrel,
      gasTube,
      gasBlock,
      frontSightTower,
      slantBrake,
      magGroup,
      grip,
      stock,
      rearLeafSight
    );
    return group;
  }

  // --- OTHER RIFLES, SMGS, SHOTGUNS & SNIPERS ---
  const bodyMat =
    isAwp
      ? olivePolymer
      : isSsg
      ? tanPolymer
      : isGalil || isM4 || isFamas
      ? gunSteelDark
      : polymerMatte;
  const handguardMat =
    isAwp
      ? olivePolymer
      : isSsg
      ? tanPolymer
      : isNova
      ? polymerMatte
      : gunSteelDark;

  const receiverLen = isSmg ? 0.24 : isAwp || isSsg ? 0.38 : 0.31;
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.068, receiverLen),
    bodyMat
  );
  const lowerReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.038, receiverLen * 0.76),
    polymerMatte
  );
  lowerReceiver.position.set(0, -0.032, 0.02);

  // Handguard / Forend
  const hgLen = isSmg ? 0.14 : isAwp || isSsg ? 0.29 : 0.25;
  const handguard = new THREE.Mesh(
    isM4
      ? new THREE.CylinderGeometry(0.026, 0.026, hgLen, 14)
      : new THREE.BoxGeometry(0.042, 0.054, hgLen),
    handguardMat
  );
  if (isM4) handguard.rotation.x = Math.PI / 2;
  handguard.position.set(0, 0.004, -(receiverLen * 0.5 + hgLen * 0.45));

  // Barrel + Muzzle Brake
  const barrelLen = isAwp || isSsg ? 0.62 : isSmg ? 0.22 : 0.44;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.011, 0.013, barrelLen, 12),
    gunSteelBrushed
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -(receiverLen * 0.5 + barrelLen * 0.45));

  const muzzleTip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.015, 0.048, 12),
    gunSteelDark
  );
  muzzleTip.rotation.x = Math.PI / 2;
  muzzleTip.position.set(0, 0.015, -(receiverLen * 0.5 + barrelLen * 0.92));

  // Articulated Bolt Carrier / Charging Handle (`slide`)
  const boltGroup = new THREE.Group();
  boltGroup.name = 'slide';
  boltGroup.position.set(0, 0.022, -0.02);
  boltGroup.userData.homePos = boltGroup.position.clone();

  const ejectionCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.022, 0.075),
    gunChrome
  );
  const chargingHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.012, 0.018),
    gunSteelBrushed
  );
  chargingHandle.position.set(-0.026, 0.005, -0.02);
  boltGroup.add(ejectionCover, chargingHandle);

  // Pistol Grip
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.033, 0.11, 0.045),
    polymerMatte
  );
  grip.position.set(0, -0.074, 0.085);
  grip.rotation.x = 0.26;

  // Articulated Detachable Magazine (`magazine`)
  const isBullpup = isAug || isFamas;
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, isAwp || isSsg ? 0.085 : 0.165, 0.058),
    gunSteelDark
  );
  mag.name = 'magazine';
  mag.position.set(
    0,
    isAwp || isSsg ? -0.056 : -0.105,
    isBullpup ? 0.15 : -0.048
  );
  mag.rotation.x = isGalil ? -0.22 : -0.1;
  mag.userData.homePos = mag.position.clone();
  mag.userData.homeRot = mag.rotation.clone();

  // Buttstock
  const stockMat = isAwp ? olivePolymer : isSsg ? tanPolymer : polymerMatte;
  const stockLen = isSmg ? 0.15 : 0.23;
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.088, stockLen),
    stockMat
  );
  stock.position.set(0, -0.012, receiverLen * 0.5 + stockLen * 0.46);

  // Top Rail / Carry Handle + Front Sight
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.026,
      isFamas ? 0.042 : 0.012,
      receiverLen * 0.88
    ),
    gunSteelBrushed
  );
  rail.position.set(0, isFamas ? 0.055 : 0.04, 0);

  const frontPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.034, 0.014),
    gunSteelDark
  );
  frontPost.position.set(0, 0.042, -(receiverLen * 0.5 + hgLen * 0.78));

  group.add(
    receiver,
    lowerReceiver,
    handguard,
    barrel,
    muzzleTip,
    boltGroup,
    grip,
    mag,
    stock,
    rail,
    frontPost
  );

  if (isM4) {
    // M4A1-S Silencer + Carry handle rear sight
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.22, 16),
      polymerMatte
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.015, -(receiverLen * 0.5 + barrelLen * 0.88));
    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.026, 0.095),
      gunSteelDark
    );
    rearSight.position.set(0, 0.052, 0.03);
    group.add(suppressor, rearSight);
  } else if (isAwp || isSsg || isAug) {
    const scopeMount = new THREE.Mesh(
      new THREE.BoxGeometry(0.024, 0.026, 0.12),
      gunSteelDark
    );
    scopeMount.position.set(0, 0.056, -0.02);

    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, isAwp || isSsg ? 0.29 : 0.17, 16),
      gunSteelDark
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.076, -0.02);

    const frontBell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.02, 0.065, 16),
      gunSteelDark
    );
    frontBell.rotation.x = Math.PI / 2;
    frontBell.position.set(0, 0.076, isAwp || isSsg ? -0.165 : -0.105);

    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.01, 16),
      lensGlass
    );
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.076, isAwp || isSsg ? -0.195 : -0.135);

    group.add(scopeMount, scopeTube, frontBell, lens);
  }

  return group;
}

const sleeveMat = new THREE.MeshStandardMaterial({
  color: 0x1b2432,
  map: ctFabricTex,
  roughness: 0.78,
  metalness: 0.06,
});
const sleeveCuffMat = new THREE.MeshStandardMaterial({
  color: 0x111722,
  roughness: 0.72,
  metalness: 0.12,
});
const gloveMat = new THREE.MeshStandardMaterial({
  color: 0x1c2026,
  map: polymerGripTex,
  roughness: 0.58,
  metalness: 0.18,
});
const glovePalmMat = new THREE.MeshStandardMaterial({
  color: 0x272b33,
  roughness: 0.68,
  metalness: 0.1,
});
const knuckleGuardMat = new THREE.MeshStandardMaterial({
  color: 0x14171c,
  roughness: 0.36,
  metalness: 0.55,
});
const wristWatchMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  roughness: 0.28,
  metalness: 0.78,
});

function smoothstep01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Builds an anatomical, rounded first-person tactical hand + forearm mesh
 * using contoured CapsuleGeometry fingers, thumb, low-profile knuckle ridges,
 * and a seamless gauntlet cuff overlapping a full-length tapered jacket sleeve.
 */
function buildTacticalArmSubtree(
  side: 'left' | 'right',
  pose: 'rifle' | 'pistol' | 'knife' | 'utility'
): THREE.Group {
  const armGroup = new THREE.Group();
  const sign = side === 'right' ? 1 : -1;

  // 1. Sleek Contoured Tactical Glove Palm
  const palm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.018, 0.032, 8, 12),
    gloveMat
  );
  palm.rotation.x = Math.PI / 2;
  palm.scale.set(0.92, 1.0, 0.82);
  palm.position.set(0, -0.004, 0.006);

  // Ergonomic molded carbon-fiber knuckle protector plate
  const knuckleGuard = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const kShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.0062, 8, 8),
      knuckleGuardMat
    );
    kShell.scale.set(0.9, 1.15, 0.85);
    kShell.position.set((k - 1.5) * 0.0085, 0.011, -0.006);
    knuckleGuard.add(kShell);
  }
  const knuckleBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.006, 0.014),
    knuckleGuardMat
  );
  knuckleBase.position.set(0, 0.008, -0.006);
  knuckleGuard.add(knuckleBase);

  // 2. Five Articulated Fingers (Thumb, Index, Middle, Ring, Pinky)
  const fingersGroup = new THREE.Group();

  if (pose === 'knife') {
    // TACTICAL COMBAT KNIFE GRIP: 4 fingers wrapped snugly around the cylindrical handle
    for (let i = 0; i < 4; i++) {
      const fGroup = new THREE.Group();
      const len = i === 0 ? 0.02 : i === 3 ? 0.017 : 0.022;
      const fProximal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.005, len, 6, 8),
        glovePalmMat
      );
      fProximal.rotation.z = Math.PI / 2;
      fProximal.rotation.x = 0.52;
      fProximal.position.set(0, -0.003, -0.006);

      const fDistal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0044, len * 0.82, 6, 8),
        glovePalmMat
      );
      fDistal.rotation.z = Math.PI / 2;
      fDistal.rotation.x = 1.15;
      fDistal.position.set(0, -0.013, -0.012);

      fGroup.position.set(0, 0.014 - i * 0.01, -0.014);
      fGroup.add(fProximal, fDistal);
      fingersGroup.add(fGroup);
    }

    // Opposable Thumb braced across the upper handle / crossguard
    const thumbGroup = new THREE.Group();
    const thumbBase = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.016, 6, 8),
      gloveMat
    );
    thumbBase.rotation.x = Math.PI / 2.0;
    thumbBase.rotation.y = sign * 0.32;
    const thumbTip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0052, 0.014, 6, 8),
      glovePalmMat
    );
    thumbTip.rotation.x = Math.PI / 2.1;
    thumbTip.position.set(-sign * 0.008, 0.008, -0.012);
    thumbGroup.position.set(-sign * 0.014, 0.012, -0.006);
    thumbGroup.add(thumbBase, thumbTip);
    fingersGroup.add(thumbGroup);
  } else {
    // Index trigger finger (posed slightly forward or wrapped depending on weapon)
    const indexGroup = new THREE.Group();
    const indexProximal = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0048, 0.018, 6, 8),
      glovePalmMat
    );
    indexProximal.rotation.z = Math.PI / 2;
    indexProximal.position.set(0, 0, 0);
    const indexDistal = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0042, 0.014, 6, 8),
      glovePalmMat
    );
    indexDistal.rotation.z = Math.PI / 2;
    indexDistal.position.set(sign * 0.002, -0.005, -0.012);
    indexGroup.position.set(0, 0.012, -0.018);
    indexGroup.add(indexProximal, indexDistal);
    fingersGroup.add(indexGroup);

    // Middle, Ring, Pinky (wrapping firmly around the grip)
    for (let i = 1; i < 4; i++) {
      const fGroup = new THREE.Group();
      const len = i === 3 ? 0.018 : 0.022;
      const fProximal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0048, len, 6, 8),
        glovePalmMat
      );
      fProximal.rotation.z = Math.PI / 2;
      const fDistal = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.0042, len * 0.8, 6, 8),
        glovePalmMat
      );
      fDistal.rotation.z = Math.PI / 2;
      fDistal.position.set(0, -0.004, -0.01);
      fGroup.position.set(0, 0.012 - i * 0.011, -0.018);
      fGroup.add(fProximal, fDistal);
      fingersGroup.add(fGroup);
    }

    // Opposable Thumb with dual joints
    const thumbGroup = new THREE.Group();
    const thumbBase = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.016, 6, 8),
      gloveMat
    );
    thumbBase.rotation.x = Math.PI / 2.2;
    thumbBase.rotation.y = sign * 0.22;
    const thumbTip = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.0052, 0.014, 6, 8),
      glovePalmMat
    );
    thumbTip.rotation.x = Math.PI / 2.4;
    thumbTip.position.set(-sign * 0.006, 0.01, -0.014);
    thumbGroup.position.set(-sign * 0.013, 0.012, -0.006);
    thumbGroup.add(thumbBase, thumbTip);
    fingersGroup.add(thumbGroup);
  }

  // 3. Seamless Glove Gauntlet Cuff + Tapered Jacket Forearm Sleeve
  const forearmPivot = new THREE.Group();
  forearmPivot.position.set(0, -0.008, 0.028);

  if (side === 'right') {
    forearmPivot.rotation.set(-0.35, -0.18, 0.12);
  } else {
    if (pose === 'rifle') {
      forearmPivot.rotation.set(-0.36, 0.32, -0.16);
    } else {
      forearmPivot.rotation.set(-0.34, 0.24, -0.12);
    }
  }

  const gloveCuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.023, 0.027, 0.045, 14),
    sleeveCuffMat
  );
  gloveCuff.rotation.x = Math.PI / 2;
  gloveCuff.position.set(0, 0, 0.02);

  // Tactical wrist adjustment rubber strap
  const cuffStrap = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.008, 0.018),
    knuckleGuardMat
  );
  cuffStrap.position.set(0, 0.018, 0.02);
  forearmPivot.add(cuffStrap);

  if (side === 'left') {
    // Tactical military field watch with green glowing tactical OLED screen
    const watchBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, 0.007, 14),
      wristWatchMat
    );
    watchBody.position.set(0.017, 0.012, 0.03);
    watchBody.rotation.z = -Math.PI / 3;

    const watchFace = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.002, 14),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    watchFace.position.set(0.018, 0.014, 0.03);
    watchFace.rotation.z = -Math.PI / 3;

    forearmPivot.add(watchBody, watchFace);
  }

  // Natural tapered forearm sleeve extending downward off-screen
  const sleeveForearm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.027, 0.04, 0.26, 14),
    sleeveMat
  );
  sleeveForearm.rotation.x = Math.PI / 2.15;
  sleeveForearm.position.set(sign * 0.015, -0.045, 0.14);

  forearmPivot.add(gloveCuff, sleeveForearm);
  armGroup.add(palm, knuckleGuard, fingersGroup, forearmPivot);
  return armGroup;
}

/**
 * Wraps a weapon model with natural, ergonomic first-person hands & forearms
 * tailored specifically to rifles/SMGs, pistols, knives, and grenades/C4.
 */
export function createFirstPersonViewmodel(weaponId: WeaponId): THREE.Group {
  const root = new THREE.Group();

  const gunPivot = new THREE.Group();
  gunPivot.name = 'gunPivot';
  const gun = createWeaponModel(weaponId);
  gun.name = 'gunModel';

  const isPistol =
    weaponId === 'glock' ||
    weaponId === 'usp' ||
    weaponId === 'p250' ||
    weaponId === 'deagle' ||
    weaponId === 'cz75';
  const isKnife = weaponId === 'knife';
  const isGrenade =
    weaponId === 'he_grenade' ||
    weaponId === 'flashbang' ||
    weaponId === 'smoke_grenade';
  const isC4 = weaponId === 'c4';
  const isSmg =
    weaponId === 'mp9' || weaponId === 'mac10' || weaponId === 'ump45';
  const pose = isKnife
    ? 'knife'
    : isPistol
    ? 'pistol'
    : isGrenade || isC4
    ? 'utility'
    : 'rifle';

  // Position the M9 Bayonet so its ribbed handle sits completely inside the right fist right behind the crossguard
  if (isKnife) {
    gun.position.set(0, 0.002, 0.042);
    gun.rotation.set(0.18, -0.08, 0.04);
  }
  gun.userData.homePos = gun.position.clone();
  gun.userData.homeRot = gun.rotation.clone();
  gunPivot.add(gun);
  root.add(gunPivot);

  // 1. RIGHT DOMINANT HAND & FOREARM
  const rightArmGroup = buildTacticalArmSubtree('right', pose);
  rightArmGroup.name = 'rightArm';

  if (isKnife) {
    // Fist wraps directly around the M9 Bayonet handle right up against the crossguard
    rightArmGroup.position.set(0.002, 0.002, 0.042);
    rightArmGroup.rotation.set(0.18, -0.08, 0.04);
  } else if (isGrenade) {
    // Right hand wraps around the grenade body
    rightArmGroup.position.set(0.008, -0.012, 0.022);
    rightArmGroup.rotation.set(0.14, -0.08, -0.08);
  } else if (isC4) {
    // Holds the right side of the C4 pack
    rightArmGroup.position.set(0.09, -0.016, 0.042);
    rightArmGroup.rotation.set(0.12, -0.1, -0.08);
  } else if (isPistol) {
    // Wraps flush around the angled pistol grip
    rightArmGroup.position.set(0.002, -0.052, 0.064);
    rightArmGroup.rotation.set(0.22, -0.03, 0);
  } else {
    // Wraps around the rifle/SMG pistol grip
    rightArmGroup.position.set(0.002, -0.068, 0.09);
    rightArmGroup.rotation.set(0.22, -0.03, 0);
  }
  rightArmGroup.userData.homePos = rightArmGroup.position.clone();
  rightArmGroup.userData.homeRot = rightArmGroup.rotation.clone();
  gunPivot.add(rightArmGroup);

  // 2. LEFT SUPPORT HAND & FOREARM (Authentic CS2 dual-hand tactical posture)
  if (!isGrenade) {
    const leftArmGroup = buildTacticalArmSubtree('left', isKnife ? 'knife' : pose);
    leftArmGroup.name = 'leftArm';

    if (isKnife) {
      // Natural combat-ready balance guard in lower-left field of view
      leftArmGroup.position.set(-0.165, -0.062, 0.048);
      leftArmGroup.rotation.set(0.32, 0.42, 0.26);
    } else if (isC4) {
      leftArmGroup.position.set(-0.09, -0.014, 0.038);
      leftArmGroup.rotation.set(0.12, 0.14, 0.14);
    } else if (isPistol) {
      // Cups cleanly under the base of the pistol grip in a compact two-handed hold
      leftArmGroup.position.set(-0.012, -0.068, 0.058);
      leftArmGroup.rotation.set(0.2, 0.22, 0.16);
    } else {
      // Cradles the underside of the front rifle/SMG handguard
      leftArmGroup.position.set(-0.012, -0.028, isSmg ? -0.115 : -0.185);
      leftArmGroup.rotation.set(0.08, 0.2, 0.42);
    }

    leftArmGroup.userData.homePos = leftArmGroup.position.clone();
    leftArmGroup.userData.homeRot = leftArmGroup.rotation.clone();
    gunPivot.add(leftArmGroup);
  }

  return root;
}

/**
 * Animates the first-person weapon viewmodel with smooth cubic-eased multi-stage reload,
 * equip/draw flourish, realistic alternating knife slashes + heavy forward lunge stab,
 * slide blowback on shot, and natural CS2 shouldered stance.
 */
export function updateFirstPersonViewmodelAnimation(
  viewmodelRoot: THREE.Group,
  weaponId: WeaponId,
  walkCycle: number,
  reloadTimer: number,
  deployTimer: number,
  fireCooldown: number,
  viewPunchPitch: number,
  swayLagX: number,
  swayLagY: number,
  crouching: boolean,
  knifeSwingCount = 0,
  isHeavyKnife = false
): void {
  const spec = WEAPONS_DB[weaponId];
  const gunPivot = viewmodelRoot.getObjectByName('gunPivot') as THREE.Group | undefined;
  if (!gunPivot) return;

  const gunModel = gunPivot.getObjectByName('gunModel') as THREE.Object3D | undefined;
  const mag = gunPivot.getObjectByName('magazine') as THREE.Object3D | undefined;
  const slide = gunPivot.getObjectByName('slide') as THREE.Object3D | undefined;
  const leftArm = gunPivot.getObjectByName('leftArm') as THREE.Object3D | undefined;
  const rightArm = gunPivot.getObjectByName('rightArm') as THREE.Object3D | undefined;

  // Reset sub-parts to their home transform before applying current keyframe
  if (gunModel && gunModel.userData.homePos) {
    gunModel.position.copy(gunModel.userData.homePos);
    if (gunModel.userData.homeRot) gunModel.rotation.copy(gunModel.userData.homeRot);
  }
  if (mag && mag.userData.homePos) {
    mag.position.copy(mag.userData.homePos);
    if (mag.userData.homeRot) mag.rotation.copy(mag.userData.homeRot);
    mag.visible = true;
  }
  if (slide && slide.userData.homePos) {
    slide.position.copy(slide.userData.homePos);
  }
  if (leftArm && leftArm.userData.homePos) {
    leftArm.position.copy(leftArm.userData.homePos);
    if (leftArm.userData.homeRot) leftArm.rotation.copy(leftArm.userData.homeRot);
  }
  if (rightArm && rightArm.userData.homePos) {
    rightArm.position.copy(rightArm.userData.homePos);
    if (rightArm.userData.homeRot) rightArm.rotation.copy(rightArm.userData.homeRot);
  }

  const isPistol = spec.category === 'pistol';
  const isKnife = weaponId === 'knife';
  const isGrenade = spec.category === 'grenade';
  const isC4 = weaponId === 'c4';

  const baseX = isKnife
    ? 0.21
    : isGrenade
    ? 0.18
    : isC4
    ? 0.04
    : isPistol
    ? 0.19
    : 0.23;
  const baseY =
    (isKnife
      ? -0.175
      : isGrenade
      ? -0.185
      : isC4
      ? -0.19
      : isPistol
      ? -0.19
      : -0.21) + (crouching ? 0.015 : 0);
  const baseZ = isKnife
    ? -0.35
    : isGrenade
    ? -0.34
    : isC4
    ? -0.36
    : isPistol
    ? -0.38
    : -0.43;

  // Walk bobbing + mouse look inertia sway
  const bobX = Math.cos(walkCycle) * 0.01 + swayLagX;
  const bobY = Math.abs(Math.sin(walkCycle)) * -0.012 + swayLagY;

  let animPosX = 0;
  let animPosY = 0;
  let animPosZ = 0;
  let animRotX = viewPunchPitch * 0.72;
  let animRotY = isKnife ? 0.16 : isGrenade ? 0.08 : -0.045;
  let animRotZ = swayLagX * 1.5 + (crouching ? 0.045 : 0);

  // Firearm recoil & slide blowback OR realistic multi-phase Knife Slash / Heavy Lunge Stab
  if (isKnife) {
    const totalCooldown = isHeavyKnife ? 0.95 : 60 / spec.fireRate;
    const activeSwing = fireCooldown > 0 && totalCooldown > 0;
    if (activeSwing) {
      const p = 1 - Math.max(0, Math.min(1, fireCooldown / totalCooldown));

      if (isHeavyKnife) {
        // HEAVY RIGHT-CLICK LUNGE STAB:
        // Phase 1 (0..20%): Pull blade back slightly to cock
        // Phase 2 (20..45%): Fast explosive forward lunge thrust into target
        // Phase 3 (45..100%): Controlled recovery back to ready stance
        if (p < 0.2) {
          const w = smoothstep01(p / 0.2);
          animPosX = w * 0.025;
          animPosY = w * 0.015;
          animPosZ = w * 0.06;
          animRotX -= w * 0.18;
          animRotY -= w * 0.08;
        } else if (p < 0.45) {
          const w = smoothstep01((p - 0.2) / 0.25);
          animPosX = 0.025 * (1 - w) - w * 0.045;
          animPosY = 0.015 * (1 - w) + w * 0.01;
          animPosZ = 0.06 * (1 - w) - w * 0.16;
          animRotX += -0.18 - w * 0.14;
          animRotY += -0.08 + w * 0.12;
          animRotZ -= w * 0.08;
        } else {
          const w = smoothstep01((p - 0.45) / 0.55);
          const rem = 1 - w;
          animPosX = -0.045 * rem;
          animPosY = 0.01 * rem;
          animPosZ = -0.16 * rem;
          animRotX += -0.32 * rem;
          animRotY += 0.04 * rem;
          animRotZ -= 0.08 * rem;
        }

        if (leftArm && leftArm.userData.homePos) {
          const brace = Math.sin(p * Math.PI);
          leftArm.position.x = leftArm.userData.homePos.x - brace * 0.03;
          leftArm.position.y = leftArm.userData.homePos.y - brace * 0.02;
          leftArm.position.z = leftArm.userData.homePos.z + brace * 0.05;
        }
      } else {
        // LIGHT LEFT-CLICK ALTERNATING DIAGONAL SLASHES:
        // Swing A (even): Quick forehand slash
        // Swing B (odd): Quick backhand return
        const isBackhand = knifeSwingCount % 2 === 1;
        const dir = isBackhand ? -1 : 1;

        if (p < 0.18) {
          // Quick wrist cock wind-up
          const w = smoothstep01(p / 0.18);
          animPosX = dir * w * 0.035;
          animPosY = w * 0.02;
          animPosZ = w * 0.025;
          animRotX += w * 0.12;
          animRotY -= dir * w * 0.14;
          animRotZ -= dir * w * 0.1;
        } else if (p < 0.52) {
          // Sharp diagonal blade cut across crosshair
          const w = smoothstep01((p - 0.18) / 0.34);
          const arc = Math.sin(w * Math.PI);
          animPosX = dir * (0.035 - w * 0.13);
          animPosY = 0.02 - w * 0.04;
          animPosZ = 0.025 - arc * 0.09;
          animRotX += 0.12 - w * 0.28;
          animRotY += dir * (-0.14 + w * 0.32);
          animRotZ += dir * (-0.1 + w * 0.2);
        } else {
          // Smooth follow-through recovery back to ready stance
          const w = smoothstep01((p - 0.52) / 0.48);
          const rem = 1 - w;
          animPosX = -dir * 0.095 * rem;
          animPosY = -0.02 * rem;
          animRotX += -0.16 * rem;
          animRotY += dir * 0.18 * rem;
          animRotZ += dir * 0.1 * rem;
        }
      }
    }
  } else {
    // Firearm shot recoil kickback & slide blowback
    const shotRatio =
      spec.fireRate > 0
        ? Math.max(0, Math.min(1, fireCooldown * (spec.fireRate / 60)))
        : 0;
    const kickBackZ = Math.pow(shotRatio, 1.5) * (isPistol ? 0.045 : 0.062);
    const kickPitch = Math.pow(shotRatio, 1.4) * (isPistol ? 0.15 : 0.075);
    animPosZ += kickBackZ;
    animRotX += kickPitch;

    if (slide && slide.userData.homePos && shotRatio > 0.05 && !isGrenade) {
      slide.position.z =
        slide.userData.homePos.z + Math.sin(shotRatio * Math.PI) * 0.056;
    }
  }

  // 1. EQUIP / DRAW ANIMATION (`deployTimer > 0`)
  if (deployTimer > 0 && spec.deployTime > 0) {
    const p = 1 - Math.max(0, Math.min(1, deployTimer / spec.deployTime));

    if (isKnife) {
      // ACROBATIC CS2-STYLE 720° KNIFE TWIRL / INDEX FINGER FLIP INTO COMBAT GRIP
      const spinWindow = 0.74; // first 74% of deploy is the athletic spin
      if (p < spinWindow) {
        const spinP = p / spinWindow;
        // Parabolic loft / air toss
        const tossY = Math.sin(spinP * Math.PI) * 0.082;
        const tossX = Math.sin(spinP * Math.PI * 0.5) * 0.032;
        // 2 full 360° revolutions (720° = 4 * PI)
        const totalRot = 4 * Math.PI;
        const currentRot = spinP * totalRot;

        animPosY += tossY - (1 - spinP) * 0.06;
        animPosX += tossX;

        // Spin knife model on its finger/crossguard pivot
        if (gunModel && gunModel.userData.homeRot && gunModel.userData.homePos) {
          gunModel.rotation.x = gunModel.userData.homeRot.x + currentRot;
          gunModel.rotation.z = gunModel.userData.homeRot.z + Math.sin(spinP * Math.PI) * 0.45;
          gunModel.position.y = gunModel.userData.homePos.y + tossY * 0.75;
          gunModel.position.z = gunModel.userData.homePos.z + Math.sin(spinP * Math.PI) * 0.02;
        }

        // Wrist follows the spin with open palm ready to catch
        if (rightArm && rightArm.userData.homeRot) {
          rightArm.rotation.x = rightArm.userData.homeRot.x + Math.sin(spinP * Math.PI) * 0.28;
          rightArm.rotation.z = rightArm.userData.homeRot.z - Math.sin(spinP * Math.PI) * 0.22;
        }
      } else {
        // Crisp mechanical snap-catch into locked combat grip with spring bounce
        const catchP = (p - spinWindow) / (1 - spinWindow);
        const settle = Math.sin(catchP * Math.PI * 3) * Math.exp(-catchP * 6) * 0.045;
        animPosY += settle;
        animRotX += settle * 0.75;
        animRotZ += settle * -0.5;

        if (gunModel && gunModel.userData.homeRot && gunModel.userData.homePos) {
          gunModel.rotation.copy(gunModel.userData.homeRot);
          gunModel.position.copy(gunModel.userData.homePos);
        }
      }
    } else if (isGrenade || isC4) {
      const ease = smoothstep01(p);
      animPosY += (1 - ease) * -0.2;
      animRotX += (1 - ease) * -0.42;
    } else if (p < 0.5) {
      const ease = smoothstep01(p / 0.5);
      animPosX += (1 - ease) * -0.1;
      animPosY += (1 - ease) * -0.22;
      animRotX += (1 - ease) * -0.45;
      animRotZ += (1 - ease) * 0.42;
    } else if (p < 0.88) {
      const t = (p - 0.5) / 0.38;
      const rackWave = Math.sin(t * Math.PI);
      animRotZ += rackWave * -0.18;
      animRotX += rackWave * 0.07;
      animPosZ += rackWave * 0.028;
      if (slide && slide.userData.homePos) {
        slide.position.z = slide.userData.homePos.z + rackWave * 0.062;
      }
      if (leftArm && leftArm.userData.homePos) {
        leftArm.position.set(
          leftArm.userData.homePos.x - 0.01,
          leftArm.userData.homePos.y + rackWave * 0.05,
          leftArm.userData.homePos.z + rackWave * 0.11
        );
      }
    }
  }
  // 2. MULTI-STAGE CUBIC-EASED RELOAD ANIMATION (`reloadTimer > 0`)
  else if (reloadTimer > 0 && spec.reloadTime > 0) {
    const p = 1 - Math.max(0, Math.min(1, reloadTimer / spec.reloadTime));

    if (p < 0.18) {
      const t = smoothstep01(p / 0.18);
      animRotZ += t * 0.38;
      animRotX += t * 0.18;
      animRotY += t * 0.2;
      animPosY += t * 0.022;
    } else if (p < 0.46) {
      const t = smoothstep01((p - 0.18) / 0.28);
      animRotZ += 0.38;
      animRotX += 0.18;
      animRotY += 0.2;
      animPosY += 0.022 - Math.sin(t * Math.PI) * 0.02;

      if (mag && mag.userData.homePos) {
        mag.position.y = mag.userData.homePos.y - t * 0.24;
        mag.position.z = mag.userData.homePos.z + t * 0.045;
        if (t > 0.82) mag.visible = false;
      }
      if (leftArm && leftArm.userData.homePos) {
        leftArm.position.set(
          mag ? mag.position.x - 0.018 : leftArm.userData.homePos.x,
          (mag ? mag.position.y : leftArm.userData.homePos.y) - 0.018,
          mag ? mag.position.z + 0.025 : -0.02
        );
      }
    } else if (p < 0.72) {
      const rawT = (p - 0.46) / 0.26;
      const ease = smoothstep01(rawT);
      const tap =
        rawT > 0.78 ? Math.sin(((rawT - 0.78) / 0.22) * Math.PI) * 0.032 : 0;
      animRotZ += 0.38;
      animRotX += 0.18 - tap * 1.6;
      animRotY += 0.2;
      animPosY += 0.022 + tap;

      if (mag && mag.userData.homePos) {
        mag.position.y = mag.userData.homePos.y - (1 - ease) * 0.24;
        mag.position.z = mag.userData.homePos.z + (1 - ease) * 0.04;
      }
      if (leftArm && leftArm.userData.homePos) {
        leftArm.position.set(
          mag ? mag.position.x - 0.018 : leftArm.userData.homePos.x,
          (mag ? mag.position.y : leftArm.userData.homePos.y) - 0.018,
          mag ? mag.position.z + 0.025 : -0.02
        );
      }
    } else if (p < 0.92) {
      const t = smoothstep01((p - 0.72) / 0.2);
      const rack = Math.sin(t * Math.PI);
      animRotZ += 0.38 * (1 - t) - rack * 0.22;
      animRotX += 0.18 * (1 - t) + rack * 0.1;
      animRotY += 0.2 * (1 - t);
      animPosZ += rack * 0.032;

      if (slide && slide.userData.homePos) {
        slide.position.z = slide.userData.homePos.z + rack * 0.065;
      }
      if (leftArm && leftArm.userData.homePos) {
        leftArm.position.set(
          leftArm.userData.homePos.x - 0.01,
          leftArm.userData.homePos.y + rack * 0.055,
          leftArm.userData.homePos.z + rack * 0.13
        );
      }
    } else {
      const t = smoothstep01((p - 0.92) / 0.08);
      animRotZ *= 1 - t;
    }
  }

  viewmodelRoot.position.set(
    baseX + bobX + animPosX,
    baseY + bobY + animPosY,
    baseZ + animPosZ
  );
  viewmodelRoot.rotation.set(animRotX, animRotY, animRotZ);
}

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  upperBody: THREE.Group;
  headMesh: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponMount: THREE.Group;
  torsoMesh: THREE.Mesh;
  crouchBlend: number;
  equippedWeaponId: WeaponId | null;
}

/**
 * Builds a detailed, realistic articulated tactical humanoid operator (CT or T)
 * with sculpted FAST ballistic helmet, NVG mount, ARC rails, comms headset with boom mic,
 * balaclava with realistic eyes, SAPI-cut plate carrier with MOLLE webbing and mag pouches,
 * radio with whip antenna, contoured limbs with knee/elbow pads, combat boots, and 5-finger gloved hands.
 */
export function createCharacterRig(
  team: Team,
  contactShadowMat: THREE.Material
): CharacterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const isCT = team === 'CT';

  const uniformMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: isCT ? ctFabricTex : tFabricTex,
    roughness: 0.76,
    metalness: 0.08,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x17253b : 0x2b2623,
    roughness: 0.8,
    metalness: 0.06,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x111827 : 0x5c3a1e,
    map: polymerGripTex,
    roughness: 0.55,
    metalness: 0.22,
  });
  const helmetMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x1e3a5f : 0x854d0e,
    roughness: 0.42,
    metalness: 0.35,
  });
  const balaclavaMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x1e242b : 0x3b2f26,
    roughness: 0.82,
    metalness: 0.04,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: isCT ? 0x0284c7 : 0xd97706,
    roughness: 0.12,
    metalness: 0.9,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x141619,
    roughness: 0.62,
    metalness: 0.18,
  });
  const faceMat = new THREE.MeshBasicMaterial({
    map: faceEyesTex,
  });

  // Contact shadow disc on floor
  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    contactShadowMat
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  // Helper to build an articulated leg with anatomical thigh, knee pad, calf, and sculpted combat boot
  const buildLeg = (side: number): THREE.Group => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.135, 0.78, 0);

    // Muscular tapered thigh
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.088, 0.22, 10, 14),
      pantsMat
    );
    thigh.position.set(0, -0.19, 0);
    thigh.castShadow = true;

    // Tactical cargo pocket on outer thigh
    const cargoPocket = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.12, 0.1),
      pantsMat
    );
    cargoPocket.position.set(side * 0.085, -0.18, 0);
    legGroup.add(cargoPocket);

    // Crye AirFlex ergonomic knee pad with curved shield and dual retention straps
    const kneePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.09, 12, 1, false, 0, Math.PI),
      vestMat
    );
    kneePad.rotation.x = -Math.PI / 2;
    kneePad.position.set(0, -0.38, -0.065);

    const kneeStrapTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.082, 0.02, 12),
      vestMat
    );
    kneeStrapTop.position.set(0, -0.35, 0);
    const kneeStrapBtm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.078, 0.078, 0.02, 12),
      vestMat
    );
    kneeStrapBtm.position.set(0, -0.41, 0);

    // Anatomical calf with blousing folds over the boot
    const calf = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.2, 10, 14),
      pantsMat
    );
    calf.position.set(0, -0.55, 0.01);
    calf.castShadow = true;

    const trouserBlouse = new THREE.Mesh(
      new THREE.TorusGeometry(0.078, 0.02, 8, 14),
      pantsMat
    );
    trouserBlouse.rotation.x = Math.PI / 2;
    trouserBlouse.position.set(0, -0.66, 0);

    // Sculpted tactical combat boot (Outsole lug tread, leather toe cap, heel wedge, laces)
    const bootGroup = new THREE.Group();
    bootGroup.position.set(0, -0.73, 0);

    const bootSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.032, 0.26),
      bootMat
    );
    bootSole.position.set(0, 0.016, -0.04);
    bootSole.castShadow = true;

    const bootHeel = new THREE.Mesh(
      new THREE.BoxGeometry(0.118, 0.02, 0.09),
      bootMat
    );
    bootHeel.position.set(0, 0.01, 0.04);

    const bootToeCap = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.042, 8, 12),
      bootMat
    );
    bootToeCap.rotation.x = Math.PI / 2;
    bootToeCap.position.set(0, 0.048, -0.1);
    bootToeCap.castShadow = true;

    const bootUpper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.068, 0.12, 12),
      bootMat
    );
    bootUpper.position.set(0, 0.065, -0.01);

    const bootLaces = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.09, 0.03),
      vestMat
    );
    bootLaces.position.set(0, 0.07, -0.065);
    bootLaces.rotation.x = -0.3;

    bootGroup.add(bootSole, bootHeel, bootToeCap, bootUpper, bootLaces);

    // Thigh holster with molded sidearm on right leg
    if (side > 0) {
      const holsterGroup = new THREE.Group();
      holsterGroup.position.set(0.095, -0.2, 0);

      const holsterRig = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.18, 0.095),
        vestMat
      );
      const pistolGrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.032, 0.08, 0.042),
        polymerMatte
      );
      pistolGrip.position.set(0, 0.08, -0.015);
      pistolGrip.rotation.x = 0.25;

      const pistolSlide = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.04, 0.11),
        gunSteelDark
      );
      pistolSlide.position.set(0, 0.05, 0.01);

      holsterGroup.add(holsterRig, pistolGrip, pistolSlide);
      legGroup.add(holsterGroup);
    }

    legGroup.add(
      thigh,
      kneePad,
      kneeStrapTop,
      kneeStrapBtm,
      calf,
      trouserBlouse,
      bootGroup
    );
    return legGroup;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Pelvis + Tactical Battle Belt with Cobra Metal Buckle & Pouches
  const pelvis = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 0.12, 10, 14),
    pantsMat
  );
  pelvis.scale.set(1.15, 1, 0.8);
  pelvis.position.set(0, 0.82, 0);

  const battleBelt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.07, 16),
    vestMat
  );
  battleBelt.scale.set(1.08, 1, 0.74);
  battleBelt.position.set(0, 0.86, 0);

  const cobraBuckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.045, 0.02),
    gunSteelBrushed
  );
  cobraBuckle.position.set(0, 0.86, -0.175);

  const dumpPouch = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.14, 0.11),
    vestMat
  );
  dumpPouch.position.set(-0.24, 0.82, 0.02);

  const pistolMag1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.09, 0.04),
    polymerMatte
  );
  pistolMag1.position.set(-0.16, 0.86, -0.165);
  const pistolMag2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.09, 0.04),
    polymerMatte
  );
  pistolMag2.position.set(-0.11, 0.86, -0.172);

  // Upper body group pivoted at waist (Y = 0.84) for natural crouch lean
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.84, 0);

  // Anatomical V-tapered muscular torso
  const torsoMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.19, 0.32, 12, 16),
    uniformMat
  );
  torsoMesh.scale.set(1.15, 1.0, 0.72);
  torsoMesh.position.set(0, 0.32, 0);
  torsoMesh.castShadow = true;

  // Crye Precision JPC Tactical Plate Carrier Vest (SAPI cut front & back)
  const plateCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.44, 0.28),
    vestMat
  );
  plateCarrier.position.set(0, 0.33, 0);

  // Triple Front Magazine Pouches with 5.56 / 7.62 Mag Tops & Bungee Pulls
  for (let m = -1; m <= 1; m++) {
    const pouch = new THREE.Mesh(
      new THREE.BoxGeometry(0.082, 0.16, 0.048),
      polymerMatte
    );
    pouch.position.set(m * 0.1, 0.24, -0.162);

    const magTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.045, 0.036),
      isCT ? gunSteelDark : bakeliteMagMat
    );
    magTop.position.set(m * 0.1, 0.34, -0.162);

    const bungeeTab = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6),
      vestMat
    );
    bungeeTab.position.set(m * 0.1, 0.37, -0.162);

    upperBody.add(pouch, magTop, bungeeTab);
  }

  // Chest Admin Patch / Insignia
  const adminPatch = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.055, 0.01),
    new THREE.MeshStandardMaterial({
      color: isCT ? 0x0284c7 : 0xb91c1c,
      roughness: 0.6,
    })
  );
  adminPatch.position.set(0, 0.44, -0.145);
  upperBody.add(adminPatch);

  // Tourniquet (CAT) on chest strap
  const tourniquet = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.1, 0.035),
    gunSteelDark
  );
  tourniquet.position.set(-0.13, 0.44, -0.14);
  upperBody.add(tourniquet);

  // Back Assault Pack / Hydration Carrier + Tactical Radio Antenna
  const backPack = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.36, 0.11),
    vestMat
  );
  backPack.position.set(0, 0.34, 0.17);

  const radioBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.16, 0.055),
    polymerMatte
  );
  radioBox.position.set(0.14, 0.42, 0.16);

  const radioAntenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.005, 0.38, 8),
    polymerMatte
  );
  radioAntenna.position.set(0.15, 0.68, 0.14);
  radioAntenna.rotation.z = -0.15;

  upperBody.add(plateCarrier, backPack, radioBox, radioAntenna);

  // Collar / Balaclava neck
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.135, 0.1, 14),
    balaclavaMat
  );
  collar.position.set(0, 0.61, 0);

  // If Terrorist, add tactical desert Shemagh / Keffiyeh scarf around neck
  if (!isCT) {
    const shemagh = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.055, 10, 16),
      tFabricTex ? uniformMat : vestMat
    );
    shemagh.rotation.x = Math.PI / 2.2;
    shemagh.position.set(0, 0.61, 0.02);
    upperBody.add(shemagh);
  }

  // Sculpted Head + Balaclava + Eyes + FAST Ballistic Helmet + Comms Headset + Visor
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.75, 0);

  // Anatomical balaclava head with chin & jawline
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(0.132, 16, 14),
    balaclavaMat
  );
  cranium.scale.set(0.92, 1.08, 1.0);
  cranium.castShadow = true;

  const jawline = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.1, 12),
    balaclavaMat
  );
  jawline.position.set(0, -0.06, -0.035);

  // Eye slit showing human eyes
  const faceDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.14, 0.07),
    faceMat
  );
  faceDecal.position.set(0, 0.015, -0.134);

  // High-Cut FAST Ballistic Helmet Shell
  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.146, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6),
    helmetMat
  );
  helmetShell.position.set(0, 0.02, 0.01);
  helmetShell.castShadow = true;

  // Front Wilcox NVG mount bracket
  const nvgMount = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.048, 0.022),
    gunSteelDark
  );
  nvgMount.position.set(0, 0.085, -0.142);

  // Left & right ARC accessory rails on helmet
  const railL = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.025, 0.12),
    polymerMatte
  );
  railL.position.set(-0.142, 0.04, 0.01);
  railL.rotation.y = 0.1;

  const railR = new THREE.Mesh(
    new THREE.BoxGeometry(0.015, 0.025, 0.12),
    polymerMatte
  );
  railR.position.set(0.142, 0.04, 0.01);
  railR.rotation.y = -0.1;

  // Tactical helmet task flashlight on left rail
  const helmetLight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.06, 10),
    gunSteelDark
  );
  helmetLight.rotation.x = Math.PI / 2;
  helmetLight.position.set(-0.155, 0.04, -0.02);

  // Top & Rear Velcro loop patch + IR Strobe Beacon
  const irStrobe = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 0.06),
    gunSteelDark
  );
  irStrobe.position.set(0, 0.158, 0.02);

  // Oakley SI Ballistic Goggles
  const gogglesFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.07, 0.055),
    polymerMatte
  );
  gogglesFrame.position.set(0, 0.018, -0.115);

  const gogglesLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.052, 0.062),
    visorMat
  );
  gogglesLens.position.set(0, 0.018, -0.116);

  // Peltor ComTac Tactical Headset Ear Cups + Mic Boom
  const earCupL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.035, 14),
    polymerMatte
  );
  earCupL.rotation.z = Math.PI / 2;
  earCupL.position.set(-0.138, 0.0, 0.01);

  const earCupR = new THREE.Mesh(
    new THREE.CylinderGeometry(0.044, 0.044, 0.035, 14),
    polymerMatte
  );
  earCupR.rotation.z = Math.PI / 2;
  earCupR.position.set(0.138, 0.0, 0.01);

  const micBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6),
    polymerMatte
  );
  micBoom.rotation.z = 0.55;
  micBoom.rotation.x = 0.85;
  micBoom.position.set(-0.1, -0.04, -0.09);

  headGroup.add(
    cranium,
    jawline,
    faceDecal,
    helmetShell,
    nvgMount,
    railL,
    railR,
    helmetLight,
    irStrobe,
    gogglesFrame,
    gogglesLens,
    earCupL,
    earCupR,
    micBoom
  );

  // Articulated Arms (Shoulder Deltoid + Crye Sleeve + Elbow Pad + Forearm + 5-Finger Gloved Hand)
  const buildOperatorArm = (side: number): THREE.Group => {
    const armRoot = new THREE.Group();
    armRoot.position.set(side * 0.295, 0.52, 0);

    const shoulderPad = new THREE.Mesh(
      new THREE.SphereGeometry(0.082, 12, 10),
      uniformMat
    );
    shoulderPad.scale.set(0.95, 1.1, 0.95);

    // Morale / Team Flag Patch on sleeve
    const sleevePatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.06, 0.045),
      new THREE.MeshStandardMaterial({
        color: isCT ? 0x0284c7 : 0xd97706,
        roughness: 0.5,
      })
    );
    sleevePatch.position.set(side * 0.082, 0, 0);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.062, 0.2, 10, 12),
      uniformMat
    );
    upperArm.position.set(0, -0.13, 0);
    upperArm.castShadow = true;

    // Molded Tactical Hard-Knuckle Elbow Pad with Straps
    const elbowPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.07, 10, 1, false, 0, Math.PI),
      vestMat
    );
    elbowPad.rotation.x = Math.PI / 2;
    elbowPad.position.set(0, -0.25, 0.045);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.052, 0.18, 10, 12),
      uniformMat
    );
    forearm.position.set(0, -0.35, -0.04);
    forearm.rotation.x = 0.25;
    forearm.castShadow = true;

    // 5-Finger Articulated Tactical Glove
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.47, -0.07);

    const palmMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.042, 8, 10),
      gloveMat
    );
    palmMesh.rotation.x = Math.PI / 2;

    const knuckleArmor = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.015, 0.022),
      knuckleGuardMat
    );
    knuckleArmor.position.set(0, 0.016, -0.01);

    // Fingers curling around weapon mount
    const fingers = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.045, 6, 8),
      glovePalmMat
    );
    fingers.rotation.z = Math.PI / 2;
    fingers.position.set(0, -0.012, -0.024);

    const thumbMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.01, 0.026, 6, 8),
      gloveMat
    );
    thumbMesh.rotation.x = Math.PI / 2.3;
    thumbMesh.position.set(-side * 0.02, 0.015, -0.01);

    handGroup.add(palmMesh, knuckleArmor, fingers, thumbMesh);

    armRoot.add(shoulderPad, sleevePatch, upperArm, elbowPad, forearm, handGroup);
    return armRoot;
  };

  const leftArm = buildOperatorArm(-1);
  leftArm.rotation.x = 0.72;
  leftArm.rotation.z = -0.15;

  const rightArm = new THREE.Group();
  rightArm.position.set(0.295, 0.52, 0);
  const rightArmSub = buildOperatorArm(1);
  rightArmSub.position.set(0, 0, 0);
  rightArmSub.rotation.x = Math.PI / 2.25;
  rightArm.add(rightArmSub);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.08, -0.05, -0.38);
  rightArm.add(weaponMount);

  upperBody.add(
    torsoMesh,
    collar,
    headGroup,
    leftArm,
    rightArm
  );

  bodyGroup.add(
    leftLeg,
    rightLeg,
    pelvis,
    battleBelt,
    cobraBuckle,
    dumpPouch,
    pistolMag1,
    pistolMag2,
    upperBody
  );

  return {
    root,
    bodyGroup,
    upperBody,
    headMesh: headGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    weaponMount,
    torsoMesh,
    crouchBlend: 0,
    equippedWeaponId: null,
  };
}

/**
 * Builds composite environmental props:
 * - 'barrel': realistic 55-gal ribbed steel oil drum with hazard stripes
 * - 'sandbags': 3-tier curved defensive parapet with canvas burlap texture
 * - 'pallet': standard wooden shipping pallet with skids and deck boards
 * - 'palm': desert oasis palm tree with ring bark and spreading fronds
 * - 'lamp': tactical wall sconce fixture
 */
export function createEnvironmentalProp(type: string): THREE.Group {
  const group = new THREE.Group();

  if (type === 'barrel') {
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x222730,
      map: polymerGripTex,
      roughness: 0.38,
      metalness: 0.82,
    });
    const cylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 1.08, 18),
      barrelMat
    );
    cylinder.position.y = 0.54;
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;

    // Rolling ribs & chimes
    const rib1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.368, 0.368, 0.045, 18),
      gunSteelBrushed
    );
    rib1.position.y = 0.34;
    const rib2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.368, 0.368, 0.045, 18),
      gunSteelBrushed
    );
    rib2.position.y = 0.74;

    const topRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.362, 0.362, 0.04, 18),
      gunSteelDark
    );
    topRim.position.y = 1.07;

    // Yellow hazard stripe around middle
    const hazardStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.353, 0.353, 0.14, 18),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.5,
      })
    );
    hazardStripe.position.y = 0.54;

    // Bung plug on top lid
    const bungPlug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10),
      gunSteelBrushed
    );
    bungPlug.position.set(0.18, 1.09, 0);

    group.add(cylinder, rib1, rib2, topRim, hazardStripe, bungPlug);
    return group;
  }

  if (type === 'sandbags') {
    const sandbagMat = new THREE.MeshStandardMaterial({
      map: sandbagTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    // 3-layer staggered curved sandbag parapet
    const addBag = (x: number, y: number, z: number, rotY = 0) => {
      const bag = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.55, 8, 12),
        sandbagMat
      );
      bag.rotation.z = Math.PI / 2;
      bag.rotation.y = rotY;
      bag.position.set(x, y, z);
      bag.castShadow = true;
      bag.receiveShadow = true;
      group.add(bag);
    };

    // Layer 1 (Bottom)
    addBag(-0.75, 0.14, 0, 0.08);
    addBag(0, 0.14, 0, 0);
    addBag(0.75, 0.14, 0, -0.08);

    // Layer 2 (Middle)
    addBag(-0.38, 0.38, 0.01, 0.04);
    addBag(0.38, 0.38, 0.01, -0.04);

    // Layer 3 (Top)
    addBag(-0.72, 0.62, 0.02, 0.08);
    addBag(0, 0.62, 0.02, 0);
    addBag(0.72, 0.62, 0.02, -0.08);

    return group;
  }

  if (type === 'pallet') {
    const palletWood = woodFurniture;
    // Standard 1.2m x 0.8m wooden cargo pallet
    // 3 Bottom skids
    for (let s = -1; s <= 1; s++) {
      const skid = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.025, 1.2),
        palletWood
      );
      skid.position.set(s * 0.36, 0.012, 0);
      skid.castShadow = true;
      group.add(skid);

      // 3 Blocks per skid
      for (let b = -1; b <= 1; b++) {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, 0.08, 0.12),
          palletWood
        );
        block.position.set(s * 0.36, 0.065, b * 0.5);
        block.castShadow = true;
        group.add(block);
      }
    }

    // 5 Top deck slats
    for (let d = -2; d <= 2; d++) {
      const deckSlat = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.022, 0.14),
        palletWood
      );
      deckSlat.position.set(0, 0.116, d * 0.25);
      deckSlat.castShadow = true;
      deckSlat.receiveShadow = true;
      group.add(deckSlat);
    }
    return group;
  }

  if (type === 'palm') {
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5a3e28,
      map: woodStockTex,
      roughness: 0.85,
    });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    // Segmented curved trunk
    const trunkH = 5.2;
    const trunkMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, trunkH, 12),
      trunkMat
    );
    trunkMesh.position.y = trunkH * 0.5;
    trunkMesh.castShadow = true;
    group.add(trunkMesh);

    // Crown of 8 drooping palm fronds
    for (let f = 0; f < 8; f++) {
      const angle = (f / 8) * Math.PI * 2;
      const frondGroup = new THREE.Group();
      frondGroup.position.set(0, trunkH - 0.1, 0);
      frondGroup.rotation.y = angle;

      const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(0.65, 2.4, 4, 8),
        frondMat
      );
      leaf.position.set(0, -0.3, 1.2);
      leaf.rotation.x = -Math.PI / 3;
      leaf.castShadow = true;

      frondGroup.add(leaf);
      group.add(frondGroup);
    }
    return group;
  }

  if (type === 'lamp') {
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.14, 0.28),
      gunSteelDark
    );
    housing.position.set(0, 3.3, 0);
    const bulb = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.06, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xfde68a })
    );
    bulb.position.set(0, 3.22, 0);
    group.add(housing, bulb);
    return group;
  }

  return group;
}
