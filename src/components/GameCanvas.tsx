import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { audioEngine } from '../engine/AudioEngine';
import { gameSim } from '../engine/GameLoop';
import { requestPointerLockSafe } from '../engine/InputManager';
import { WEAPONS_DB, WeaponId } from '../game/WeaponsDB';
import { useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import {
  BOMBSITE_ZONES,
  DUST_ALLEY_BOXES,
  DUST_ALLEY_PROPS,
  DUST_ALLEY_SIGNS,
  PLAYER_DIMENSIONS,
} from '../world/DustAlleyMap';
import {
  CharacterRig,
  createCharacterRig,
  createEnvironmentalProp,
  createFirstPersonViewmodel,
  createWeaponModel,
  updateFirstPersonViewmodelAnimation,
} from '../world/ProceduralModels';
import { createProceduralMaterials } from '../world/ProceduralTextures';

// Pre-allocated scratch vectors/matrices outside render loop (zero GC)
const _vec3A = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dummyObj = new THREE.Object3D();
const _color = new THREE.Color();

export const GameCanvas: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('Twoja przeglądarka lub karta graficzna nie obsługuje WebGL.');
      return;
    }

    const initSettings = useSettingsStore.getState();
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = Math.min(initSettings.exposure ?? 0.85, 0.9);
    renderer.setPixelRatio(
      isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio * initSettings.renderScale, 2.25)
    );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isSoftwareGl && initSettings.shadowsEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Skybox, Fog, and RoomEnvironment Studio PBR Reflections
    const scene = new THREE.Scene();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const matBundle = createProceduralMaterials(maxAniso);

    scene.background = matBundle.skyTexture;
    scene.fog = new THREE.FogExp2(0x11151e, 0.009);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.02).texture;
    pmremGenerator.dispose();

    // 3. Camera + First-Person Viewmodel Rig
    const camera = new THREE.PerspectiveCamera(
      initSettings.fov,
      window.innerWidth / window.innerHeight,
      0.06,
      160
    );
    scene.add(camera);

    // Subtle 3D Ambient Dust Motes (drifting gently through air)
    const dustCount = 200;
    const dustGeo = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 55;
      dustPositions[i * 3 + 1] = 0.5 + Math.random() * 6.5;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 55;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.07,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    const viewmodelContainer = new THREE.Group();
    camera.add(viewmodelContainer);

    // Pre-build articulated viewmodel meshes for every weapon
    const viewmodels = new Map<WeaponId, THREE.Group>();
    (Object.keys(WEAPONS_DB) as WeaponId[]).forEach((wId) => {
      const wm = createFirstPersonViewmodel(wId);
      wm.visible = false;
      viewmodelContainer.add(wm);
      viewmodels.set(wId, wm);
    });

    // Muzzle flash sprite + transient point light on viewmodel
    const muzzleLight = new THREE.PointLight(0xf59e0b, 0, 9, 2);
    muzzleLight.position.set(0.24, -0.14, -0.82);
    camera.add(muzzleLight);

    const muzzleFlashMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.92,
      })
    );
    muzzleFlashMesh.position.set(0.24, -0.13, -0.8);
    muzzleFlashMesh.visible = false;
    camera.add(muzzleFlashMesh);

    // 4. Night/Dusk Moonlight Key Light + Cool Ambient Hemisphere Fill Light + Warm Wall Sconce Lights
    const hemiLight = new THREE.HemisphereLight(0x475569, 0x181c24, 0.38);
    hemiLight.position.set(0, 35, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xdbeafe, 0.72);
    sunLight.position.set(22, 42, 20);
    sunLight.castShadow = !isSoftwareGl && initSettings.shadowsEnabled;
    sunLight.shadow.mapSize.set(2048, 2048);
    const d = 35;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 105;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // 5. Build Spacious 62.4m x 62.4m Blueprint World Geometry (Instanced per material for 60 FPS smoothness)
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(68, 68),
      matBundle.materials.sand_ground
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    worldGroup.add(groundMesh);

    // Red Bombsite A & B Floor Zones matching the blueprint image
    (['A', 'B'] as const).forEach((site) => {
      const z = BOMBSITE_ZONES[site];
      const w = z.maxX - z.minX;
      const dSize = z.maxZ - z.minZ;
      const siteMat = matBundle.createBombsiteFloorMaterial(site);
      const sitePlane = new THREE.Mesh(new THREE.PlaneGeometry(w, dSize), siteMat);
      sitePlane.rotation.x = -Math.PI / 2;
      sitePlane.position.set(
        (z.minX + z.maxX) * 0.5,
        z.y + 0.02,
        (z.minZ + z.maxZ) * 0.5
      );
      sitePlane.receiveShadow = true;
      worldGroup.add(sitePlane);
    });

    // Batch Map Boxes (Walls, Crates, Trim) by material into InstancedMeshes for minimal draw calls
    const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxesByMat = new Map<string, typeof DUST_ALLEY_BOXES>();
    for (const box of DUST_ALLEY_BOXES) {
      const key = `${box.material}_${box.noCollide ? 'nocollide' : 'solid'}`;
      const list = boxesByMat.get(key) || [];
      list.push(box);
      boxesByMat.set(key, list);
    }

    boxesByMat.forEach((boxList) => {
      const sample = boxList[0];
      const mat = matBundle.materials[sample.material] || matBundle.materials.concrete;
      const instMesh = new THREE.InstancedMesh(unitBoxGeo, mat, boxList.length);
      instMesh.castShadow = !sample.noCollide;
      instMesh.receiveShadow = true;
      for (let i = 0; i < boxList.length; i++) {
        const b = boxList[i];
        _dummyObj.position.set(b.x, b.y, b.z);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(b.w, b.h, b.d);
        _dummyObj.updateMatrix();
        instMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      instMesh.instanceMatrix.needsUpdate = true;
      worldGroup.add(instMesh);
    });

    // Callout Signs ("A", "B", "MID")
    for (const sign of DUST_ALLEY_SIGNS) {
      const signMat = matBundle.createSignMaterial(sign.text, sign.color);
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sign.width, sign.height),
        signMat
      );
      signMesh.position.set(sign.position[0], sign.position[1], sign.position[2]);
      signMesh.rotation.y = sign.rotationY;
      worldGroup.add(signMesh);
    }

    // Environmental Props (Barrels + Warm Wall Sconce Glow Pools matching the blueprint)
    const sconceGlowMeshes: THREE.Mesh[] = [];
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d')!;
    const gGrad = gCtx.createRadialGradient(64, 64, 4, 64, 64, 60);
    gGrad.addColorStop(0, 'rgba(251, 191, 36, 0.52)');
    gGrad.addColorStop(0.45, 'rgba(245, 158, 11, 0.22)');
    gGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    gCtx.fillStyle = gGrad;
    gCtx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    for (const prop of DUST_ALLEY_PROPS) {
      const propObj = createEnvironmentalProp(prop.type);
      propObj.position.set(prop.position[0], prop.position[1], prop.position[2]);
      if (prop.rotationY) propObj.rotation.y = prop.rotationY;
      if (prop.scale) propObj.scale.setScalar(prop.scale);
      worldGroup.add(propObj);

      if (prop.type === 'lamp') {
        const poolMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), glowMat);
        poolMesh.rotation.x = -Math.PI / 2;
        poolMesh.position.set(prop.position[0], 0.025, prop.position[2]);
        poolMesh.visible = initSettings.dynamicLights;
        worldGroup.add(poolMesh);
        sconceGlowMeshes.push(poolMesh);
      }
    }

    // 6. Dynamic Character Rigs, World C4 Bomb, Pre-Allocated Grenade/Smoke/Particle Pools
    const characterRigs = new Map<string, CharacterRig>();

    const worldC4Group = createWeaponModel('c4');
    worldC4Group.scale.setScalar(1.35);
    worldC4Group.visible = false;
    scene.add(worldC4Group);

    const c4BeaconLight = new THREE.PointLight(0xef4444, 0, 7, 2);
    c4BeaconLight.position.set(0, 0.25, 0);
    worldC4Group.add(c4BeaconLight);

    // Pooled Particles InstancedMesh (Sparks, Dust, Blood, Shell Casings, Fireball)
    const maxParticles = gameSim.particlePool.getAll().length;
    const particleGeo = new THREE.BoxGeometry(1, 1, 1);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInstanced = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      maxParticles
    );
    particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particleInstanced.frustumCulled = false;
    scene.add(particleInstanced);

    // Pooled Bullet Hole Decals
    const decalMeshes: THREE.Mesh[] = [];
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < gameSim.decalPool.getAll().length; i++) {
      const m = new THREE.Mesh(decalGeo, matBundle.decalBulletMat);
      m.visible = false;
      scene.add(m);
      decalMeshes.push(m);
    }

    // Pooled Bullet Tracers
    const tracerLines: THREE.Line[] = [];
    const tracerMat = new THREE.LineBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.82,
    });
    for (let i = 0; i < 24; i++) {
      const tGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const line = new THREE.Line(tGeo, tracerMat);
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      tracerLines.push(line);
    }

    // Pre-allocated Grenade Mesh Pool (8 slots, zero runtime allocation)
    const grenadePoolMeshes: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const gm = createWeaponModel('he_grenade');
      gm.visible = false;
      scene.add(gm);
      grenadePoolMeshes.push(gm);
    }

    // Pre-allocated Dense Volumetric Smoke Sprite Clusters (6 clouds x 14 sprites = 84 sprites, zero runtime allocation)
    const smokeOffsets: Array<[number, number, number]> = [
      [0, 0, 0],
      [0, 0.9, 0],
      [0, -0.6, 0],
      [2.2, 0.2, 1.2],
      [-2.2, 0.1, -1.2],
      [1.2, 0.4, -2.1],
      [-1.2, 0.3, 2.1],
      [1.8, 0.9, 1.6],
      [-1.8, 0.8, -1.6],
      [1.9, 0.8, -1.4],
      [-1.9, 0.7, 1.4],
      [0, 1.8, 0],
      [2.8, -0.2, 0],
      [-2.8, -0.2, 0],
    ];
    const smokeClusters: THREE.Sprite[][] = [];
    for (let c = 0; c < 6; c++) {
      const cluster: THREE.Sprite[] = [];
      for (let s = 0; s < smokeOffsets.length; s++) {
        const sp = new THREE.Sprite(matBundle.smokeSpriteMat);
        sp.visible = false;
        scene.add(sp);
        cluster.push(sp);
      }
      smokeClusters.push(cluster);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    gameSim.input.attach();

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && useGameStore.getState().screenState === 'title') {
      gameSim.startOfflineMatch();
    }

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let lastTime = performance.now();
    let appliedScale = initSettings.renderScale;
    let appliedShadows = initSettings.shadowsEnabled;
    let appliedDynamicLights = initSettings.dynamicLights;
    let appliedExposure = initSettings.exposure;

    // Smooth camera & viewmodel interpolation state
    let smoothEyeHeight = PLAYER_DIMENSIONS.EYE_STAND;
    let lastActorYaw = 0;
    let lastActorPitch = 0;
    let swayLagX = 0;
    let swayLagY = 0;

    // FPS telemetry counter updated every 250ms directly in DOM (zero React re-renders)
    let fpsFrames = 0;
    let fpsWindowStart = performance.now();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (!sync) {
            frameId = window.setTimeout(cb, 80);
            return;
          }
          const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      const now = performance.now();
      const rawDt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Update live FPS counter element if present
      fpsFrames++;
      if (now - fpsWindowStart >= 250) {
        const currentFps = Math.round((fpsFrames * 1000) / (now - fpsWindowStart));
        const frameMs = ((now - fpsWindowStart) / fpsFrames).toFixed(1);
        const fpsEl = document.getElementById('hud-fps-counter');
        if (fpsEl) {
          fpsEl.textContent = `${currentFps} FPS · ${frameMs} ms`;
        }
        fpsFrames = 0;
        fpsWindowStart = now;
      }

      // Apply live-reactive Graphics & Audio Settings whenever changed in Menu/Pause
      const settings = useSettingsStore.getState();
      audioEngine.setVolume(settings.volume, settings.muted);

      if (settings.renderScale !== appliedScale && !isSoftwareGl) {
        appliedScale = settings.renderScale;
        renderer.setPixelRatio(
          Math.min(window.devicePixelRatio * appliedScale, 2.25)
        );
      }
      if (settings.shadowsEnabled !== appliedShadows && !isSoftwareGl) {
        appliedShadows = settings.shadowsEnabled;
        renderer.shadowMap.enabled = appliedShadows;
        sunLight.castShadow = appliedShadows;
        worldGroup.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh && (obj as THREE.Mesh).material) {
            const mat = (obj as THREE.Mesh).material as THREE.Material;
            mat.needsUpdate = true;
          }
        });
      }
      if (settings.dynamicLights !== appliedDynamicLights) {
        appliedDynamicLights = settings.dynamicLights;
        for (const gm of sconceGlowMeshes) {
          gm.visible = appliedDynamicLights;
        }
      }
      if (settings.exposure !== appliedExposure) {
        appliedExposure = settings.exposure;
        renderer.toneMappingExposure = appliedExposure;
      }

      // Step simulation
      gameSim.step(rawDt);

      const storeState = useGameStore.getState();

      // Animate ambient sunlight dust motes
      const dustPos = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        dustPos[i * 3 + 1] += Math.sin(now * 0.0008 + i) * 0.0018;
        dustPos[i * 3] += Math.cos(now * 0.0005 + i * 2) * 0.0012;
      }
      dustGeo.attributes.position.needsUpdate = true;

      // Update Camera: Title Screen Cinematic Flythrough vs First-Person Gameplay
      if (storeState.screenState === 'title') {
        viewmodelContainer.visible = false;
        const sceneDuration = 9.0;
        const totalSec = now * 0.001;
        const sceneIndex = Math.floor((totalSec / sceneDuration) % 4);
        const st = (totalSec % sceneDuration) / sceneDuration;
        const smoothT = st * st * (3 - 2 * st);

        if (sceneIndex === 0) {
          // 1. Mid Courtyard Tracking Shot
          const sx = -3.2, sz = 14.5, ex = -0.5, ez = -3.5;
          camera.position.set(
            sx + (ex - sx) * smoothT,
            1.85 + Math.sin(st * Math.PI) * 0.25,
            sz + (ez - sz) * smoothT
          );
          camera.lookAt(8.5, 2.0, -9.5);
        } else if (sceneIndex === 1) {
          // 2. High Crane Panoramic Pan over Bombsite A
          const angle = 0.4 + smoothT * 0.55;
          const radius = 15.0;
          camera.position.set(
            17.5 + Math.cos(angle) * radius,
            6.2 + Math.sin(smoothT * Math.PI) * 0.35,
            -11.5 + Math.sin(angle) * radius
          );
          camera.lookAt(17.5, 1.2, -11.5);
        } else if (sceneIndex === 2) {
          // 3. Fast Corridor Tracking Shot through Long A
          const sx = 23.5, sz = 15.0, ex = 21.0, ez = -3.0;
          camera.position.set(
            sx + (ex - sx) * smoothT,
            1.7 + Math.sin(st * Math.PI) * 0.18,
            sz + (ez - sz) * smoothT
          );
          camera.lookAt(18.5, 1.7, -15.0);
        } else {
          // 4. Moody Low-Angle Shot around Bombsite B Arches & Crates
          const angle = -1.35 + smoothT * 0.5;
          const radius = 14.0;
          camera.position.set(
            -18.5 + Math.cos(angle) * radius,
            5.0 + Math.sin(smoothT * Math.PI) * 0.3,
            -10.5 + Math.sin(angle) * radius
          );
          camera.lookAt(-18.5, 1.3, -10.5);
        }

        if (camera.fov !== 66) {
          camera.fov = 66;
          camera.updateProjectionMatrix();
        }
      } else {
        const camActor = gameSim.getCameraTargetActor();
        if (camActor) {
          const targetEyeH = camActor.crouching
            ? PLAYER_DIMENSIONS.EYE_CROUCH
            : PLAYER_DIMENSIONS.EYE_STAND;
          smoothEyeHeight +=
            (targetEyeH - smoothEyeHeight) * Math.min(1, rawDt * 14);

          const crouchRatio = Math.max(
            0,
            Math.min(
              1,
              (PLAYER_DIMENSIONS.EYE_STAND - smoothEyeHeight) /
                Math.max(0.01, PLAYER_DIMENSIONS.EYE_STAND - PLAYER_DIMENSIONS.EYE_CROUCH)
            )
          );
          const leanForward = crouchRatio * 0.1;
          const forwardX = -Math.sin(camActor.yaw) * leanForward;
          const forwardZ = -Math.cos(camActor.yaw) * leanForward;

          const shakeX =
            (Math.random() - 0.5) * gameSim.cameraTrauma * gameSim.cameraTrauma * 0.32;
          const shakeY =
            (Math.random() - 0.5) * gameSim.cameraTrauma * gameSim.cameraTrauma * 0.32;

          const bobY =
            camActor.grounded && !camActor.crouching
              ? Math.sin(camActor.walkCycle * 2) * 0.024
              : 0;

          camera.position.set(
            camActor.position[0] + forwardX + shakeX,
            camActor.position[1] + smoothEyeHeight + bobY + shakeY,
            camActor.position[2] + forwardZ
          );

          _euler.set(
            camActor.pitch +
              camActor.recoilPitch * 1.15 +
              gameSim.viewPunchPitch,
            camActor.yaw + camActor.recoilYaw * 1.15,
            gameSim.viewPunchRoll,
            'YXZ'
          );
          camera.quaternion.setFromEuler(_euler);

          // Weapon inertia sway from mouse rotation delta
          let dYaw = camActor.yaw - lastActorYaw;
          while (dYaw > Math.PI) dYaw -= Math.PI * 2;
          while (dYaw < -Math.PI) dYaw += Math.PI * 2;
          const dPitch = camActor.pitch - lastActorPitch;
          lastActorYaw = camActor.yaw;
          lastActorPitch = camActor.pitch;

          swayLagX += (-dYaw * 0.18 - swayLagX) * Math.min(1, rawDt * 14);
          swayLagY += (dPitch * 0.18 - swayLagY) * Math.min(1, rawDt * 14);
          swayLagX = Math.max(-0.045, Math.min(0.045, swayLagX));
          swayLagY = Math.max(-0.045, Math.min(0.045, swayLagY));

          // Update Scoped FOV smoothly
          const spec = WEAPONS_DB[camActor.activeWeapon];
          const desiredFov =
            camActor.zoomLevel > 0 && spec.zoomLevels
              ? spec.zoomLevels[camActor.zoomLevel - 1] || settings.fov
              : settings.fov;
          if (Math.abs(camera.fov - desiredFov) > 0.1) {
            camera.fov += (desiredFov - camera.fov) * Math.min(1, rawDt * 18);
            camera.updateProjectionMatrix();
          }

          // Update Articulated First-Person Weapon Viewmodel
          viewmodelContainer.visible = camActor.zoomLevel === 0 && camActor.alive;
          viewmodels.forEach((mesh, wId) => {
            const isCurrent = wId === camActor.activeWeapon;
            mesh.visible = isCurrent;
            if (isCurrent) {
              updateFirstPersonViewmodelAnimation(
                mesh,
                wId,
                camActor.walkCycle,
                camActor.reloadTimer,
                camActor.deployTimer,
                camActor.fireCooldown,
                gameSim.viewPunchPitch,
                swayLagX,
                swayLagY,
                camActor.crouching,
                gameSim.knifeSwingCount,
                gameSim.lastKnifeHeavy
              );
            }
          });
        }
      }

      // Muzzle flash visibility
      const showFlash = gameSim.muzzleFlashTimer > 0;
      muzzleFlashMesh.visible = showFlash;
      muzzleLight.intensity = showFlash && appliedDynamicLights ? 3.5 : 0;
      if (showFlash) {
        muzzleFlashMesh.rotation.z = Math.random() * Math.PI;
      }

      // Update Character Rigs (CT & T players/bots)
      const camTargetId = gameSim.getCameraTargetActor()?.id;
      for (const actor of gameSim.actors) {
        let rig = characterRigs.get(actor.id);
        if (!rig) {
          rig = createCharacterRig(actor.team, matBundle.contactShadowMat);
          scene.add(rig.root);
          characterRigs.set(actor.id, rig);
        }

        const isFirstPersonSelf =
          storeState.screenState !== 'title' && actor.id === camTargetId && actor.alive;
        rig.root.visible = !isFirstPersonSelf && (actor.alive || actor.koTimer < 1);

        if (!rig.root.visible) continue;

        rig.root.position.set(
          actor.position[0],
          actor.position[1],
          actor.position[2]
        );
        rig.root.rotation.y = actor.yaw;

        if (!actor.alive) {
          rig.bodyGroup.rotation.x = -actor.koTimer * (Math.PI * 0.48);
          rig.bodyGroup.position.y = 0;
          rig.bodyGroup.scale.set(1, 1, 1);
          rig.upperBody.rotation.x = 0;
        } else {
          // Smoothly blend crouch factor without ever squashing scale.y!
          const targetCrouch = actor.crouching ? 1 : 0;
          rig.crouchBlend += (targetCrouch - rig.crouchBlend) * Math.min(1, rawDt * 14);
          const cb = rig.crouchBlend;

          rig.bodyGroup.rotation.x = 0;
          rig.bodyGroup.scale.set(1, 1, 1);
          rig.bodyGroup.position.y = -0.26 * cb;
          rig.bodyGroup.position.z = -0.06 * cb;

          // Upper body leans slightly forward at the waist while head & rifle stay level
          rig.upperBody.rotation.x = -0.26 * cb;

          const swing = Math.sin(actor.walkCycle * 2) * (0.55 - 0.22 * cb);
          const speed = Math.hypot(actor.velocity[0], actor.velocity[2]);
          const amp = Math.min(1, speed / 4.0);
          rig.leftLeg.rotation.x = 0.52 * cb + swing * amp;
          rig.rightLeg.rotation.x = -0.46 * cb - swing * amp;
          rig.headMesh.rotation.x = 0.26 * cb + actor.pitch * 0.6;
        }

        if (rig.equippedWeaponId !== actor.activeWeapon) {
          rig.weaponMount.clear();
          const thirdPersonGun = createWeaponModel(actor.activeWeapon);
          thirdPersonGun.scale.setScalar(0.95);
          rig.weaponMount.add(thirdPersonGun);
          rig.equippedWeaponId = actor.activeWeapon;
        }
      }

      // Update World C4 Bomb Mesh (dropped or planted)
      const bomb = gameSim.bomb;
      if (bomb.state === 'dropped' || bomb.state === 'planted') {
        worldC4Group.visible = true;
        worldC4Group.position.set(
          bomb.position[0],
          bomb.position[1] + 0.06,
          bomb.position[2]
        );
        worldC4Group.rotation.y =
          bomb.state === 'dropped' ? gameSim.droppedC4Rotation : 0;

        const blinkOn =
          bomb.state === 'planted' &&
          Math.sin((40 - bomb.timeRemaining) * (bomb.timeRemaining < 10 ? 28 : 10)) > 0;
        c4BeaconLight.intensity = blinkOn ? 2.8 : 0;
      } else {
        worldC4Group.visible = false;
        c4BeaconLight.intensity = 0;
      }

      // Update Pooled Particles InstancedMesh
      const particles = gameSim.particlePool.getAll();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!p.active) {
          _dummyObj.scale.setScalar(0);
          _dummyObj.updateMatrix();
          particleInstanced.setMatrixAt(i, _dummyObj.matrix);
          continue;
        }
        const scale = p.size * (1 - p.life / p.maxLife);
        _dummyObj.position.set(p.position[0], p.position[1], p.position[2]);
        _dummyObj.scale.setScalar(Math.max(0.001, scale));
        _dummyObj.updateMatrix();
        particleInstanced.setMatrixAt(i, _dummyObj.matrix);
        _color.setHex(p.color);
        particleInstanced.setColorAt(i, _color);
      }
      particleInstanced.instanceMatrix.needsUpdate = true;
      if (particleInstanced.instanceColor) {
        particleInstanced.instanceColor.needsUpdate = true;
      }

      // Update Bullet Decals
      const decals = gameSim.decalPool.getAll();
      for (let i = 0; i < decals.length; i++) {
        const dItem = decals[i];
        const mesh = decalMeshes[i];
        if (!dItem.active) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(
          dItem.position[0],
          dItem.position[1],
          dItem.position[2]
        );
        _vec3A.set(
          dItem.position[0] + dItem.normal[0],
          dItem.position[1] + dItem.normal[1],
          dItem.position[2] + dItem.normal[2]
        );
        mesh.lookAt(_vec3A);
        mesh.scale.setScalar(dItem.scale);
      }

      // Update Bullet Tracers
      const tracers = gameSim.tracerPool.getAll();
      for (let i = 0; i < tracers.length; i++) {
        const tr = tracers[i];
        const line = tracerLines[i];
        if (!tr.active) {
          line.visible = false;
          continue;
        }
        line.visible = true;
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(0, tr.start[0], tr.start[1], tr.start[2]);
        posAttr.setXYZ(1, tr.end[0], tr.end[1], tr.end[2]);
        posAttr.needsUpdate = true;
      }

      // Update Pre-allocated Grenades Pool (zero GC)
      for (let i = 0; i < grenadePoolMeshes.length; i++) {
        const g = gameSim.grenades[i];
        const mesh = grenadePoolMeshes[i];
        if (!g) {
          mesh.visible = false;
          continue;
        }
        mesh.visible = true;
        mesh.position.set(g.position[0], g.position[1], g.position[2]);
        mesh.rotation.set(now * 0.01, now * 0.015, 0);
      }

      // Update Pre-allocated Smoke Sprite Clusters (zero GC)
      for (let c = 0; c < smokeClusters.length; c++) {
        const s = gameSim.smokeClouds[c];
        const cluster = smokeClusters[c];
        if (!s) {
          for (let k = 0; k < cluster.length; k++) {
            cluster[k].visible = false;
          }
          continue;
        }
        for (let k = 0; k < cluster.length; k++) {
          const sp = cluster[k];
          const off = smokeOffsets[k];
          sp.visible = true;
          sp.position.set(
            s.position[0] + off[0],
            s.position[1] + off[1],
            s.position[2] + off[2]
          );
          sp.scale.setScalar(s.radius * 1.85);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      gameSim.input.detach();
      matBundle.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0b0d10] text-zinc-100 p-6">
        <div className="max-w-md border border-red-500/40 bg-zinc-900/90 p-6 rounded">
          <h2 className="text-xl font-bold uppercase tracking-wider text-red-400 mb-2">
            Brak obsługi WebGL
          </h2>
          <p className="text-sm text-zinc-300">{webglError}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      data-testid="game-canvas-container"
      onClick={() => {
        const state = useGameStore.getState();
        if (state.screenState === 'playing' && !state.buyMenuOpen) {
          const canvas = mountRef.current?.querySelector('canvas') as HTMLElement | null;
          requestPointerLockSafe(canvas);
        }
      }}
      className="fixed inset-0 w-screen h-screen overflow-hidden"
    />
  );
};
