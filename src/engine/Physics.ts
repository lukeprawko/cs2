import {
  DUST_ALLEY_BOXES,
  MapBox,
  PLAYER_DIMENSIONS,
} from '../world/DustAlleyMap';

export interface AABB {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  penetrable: boolean;
  isRamp: boolean;
  rampDir?: '+z' | '-z' | '+x' | '-x';
}

export interface RaycastHit {
  distance: number;
  point: [number, number, number];
  normal: [number, number, number];
  boxId: string;
  penetrable: boolean;
}

export interface MoveState {
  position: [number, number, number]; // bottom-center of player capsule
  velocity: [number, number, number];
  grounded: boolean;
  crouching: boolean;
}

/**
 * Spatial Grid + AABB Physics & Raycast Engine
 * Zero garbage collection in hot loop.
 */
export class PhysicsWorld {
  public colliders: AABB[] = [];
  private cellSize = 8.0;
  private grid: Map<string, AABB[]> = new Map();

  constructor(boxes: MapBox[] = DUST_ALLEY_BOXES) {
    this.buildFromBoxes(boxes);
  }

  public buildFromBoxes(boxes: MapBox[]): void {
    this.colliders = [];
    this.grid.clear();

    for (const b of boxes) {
      if (b.noCollide) continue;
      const aabb: AABB = {
        id: b.id,
        minX: b.x - b.w * 0.5,
        maxX: b.x + b.w * 0.5,
        minY: b.y - b.h * 0.5,
        maxY: b.y + b.h * 0.5,
        minZ: b.z - b.d * 0.5,
        maxZ: b.z + b.d * 0.5,
        penetrable: Boolean(b.penetrable),
        isRamp: Boolean(b.isRamp),
        rampDir: b.rampDir,
      };
      this.colliders.push(aabb);

      const minCellX = Math.floor(aabb.minX / this.cellSize);
      const maxCellX = Math.floor(aabb.maxX / this.cellSize);
      const minCellZ = Math.floor(aabb.minZ / this.cellSize);
      const maxCellZ = Math.floor(aabb.maxZ / this.cellSize);

      for (let cx = minCellX; cx <= maxCellX; cx++) {
        for (let cz = minCellZ; cz <= maxCellZ; cz++) {
          const key = `${cx},${cz}`;
          let cell = this.grid.get(key);
          if (!cell) {
            cell = [];
            this.grid.set(key, cell);
          }
          cell.push(aabb);
        }
      }
    }
  }

  public getNearbyColliders(x: number, z: number, radius: number): AABB[] {
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellZ = Math.floor((z - radius) / this.cellSize);
    const maxCellZ = Math.floor((z + radius) / this.cellSize);

    const result: AABB[] = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cz = minCellZ; cz <= maxCellZ; cz++) {
        const cell = this.grid.get(`${cx},${cz}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            const c = cell[i];
            if (!result.includes(c)) {
              result.push(c);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Computes exact ground height at (x, z) including ramps and platforms.
   */
  public getGroundHeightAt(x: number, z: number, currentY = 0): number {
    let highest = 0;
    const nearby = this.getNearbyColliders(x, z, 0.5);
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) {
        if (c.isRamp && c.rampDir) {
          let t = 0;
          if (c.rampDir === '+z') t = (z - c.minZ) / (c.maxZ - c.minZ);
          else if (c.rampDir === '-z') t = (c.maxZ - z) / (c.maxZ - c.minZ);
          else if (c.rampDir === '+x') t = (x - c.minX) / (c.maxX - c.minX);
          else if (c.rampDir === '-x') t = (c.maxX - x) / (c.maxX - c.minX);
          const rampY = c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
          if (rampY <= currentY + PLAYER_DIMENSIONS.STEP_HEIGHT + 0.35 && rampY > highest) {
            highest = rampY;
          }
        } else if (c.maxY <= currentY + PLAYER_DIMENSIONS.STEP_HEIGHT + 0.25 && c.maxY > highest) {
          highest = c.maxY;
        }
      }
    }
    return highest;
  }

  /**
   * FPS Kinematic Character Controller with friction, acceleration, air-strafe,
   * gravity, jump, crouch, auto-step on stairs/ramps, and smooth slide collision.
   */
  public stepCharacter(
    state: MoveState,
    wishDirX: number,
    wishDirZ: number,
    maxSpeed: number,
    jumpPressed: boolean,
    dt: number
  ): void {
    const gravity = 20.5;
    const groundFriction = 10.5;
    const groundAccel = 14.0;
    const airAccel = 4.2;
    const jumpVelocity = 6.9;

    const radius = PLAYER_DIMENSIONS.RADIUS;
    const height = state.crouching
      ? PLAYER_DIMENSIONS.HEIGHT_CROUCH
      : PLAYER_DIMENSIONS.HEIGHT_STAND;

    let [px, py, pz] = state.position;
    let [vx, vy, vz] = state.velocity;

    // Apply friction when grounded
    if (state.grounded) {
      const speed = Math.hypot(vx, vz);
      if (speed > 0.001) {
        const drop = speed * groundFriction * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        vx *= newSpeed;
        vz *= newSpeed;
      } else {
        vx = 0;
        vz = 0;
      }
    }

    // Accelerate along wish direction (CS-style dot product acceleration + air strafe)
    const wishLen = Math.hypot(wishDirX, wishDirZ);
    if (wishLen > 0.001) {
      const nx = wishDirX / wishLen;
      const nz = wishDirZ / wishLen;
      const currentSpeedInWish = vx * nx + vz * nz;
      const effectiveMax = state.grounded ? maxSpeed : Math.min(maxSpeed, 4.2);
      const addSpeed = effectiveMax - currentSpeedInWish;
      if (addSpeed > 0) {
        const accel = state.grounded ? groundAccel : airAccel;
        const accelSpeed = Math.min(addSpeed, accel * maxSpeed * dt);
        vx += accelSpeed * nx;
        vz += accelSpeed * nz;
      }
    }

    // Jump
    if (state.grounded && jumpPressed) {
      vy = jumpVelocity;
      state.grounded = false;
    }

    // Gravity
    vy -= gravity * dt;

    // Move horizontally and resolve collisions
    px += vx * dt;
    pz += vz * dt;

    const nearby = this.getNearbyColliders(px, pz, radius + 1.2);

    // Check ramps & auto-step
    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];

      // If it's a ramp and we are within its XZ footprint, lift Y smoothly
      if (c.isRamp && c.rampDir) {
        if (px >= c.minX - radius * 0.4 && px <= c.maxX + radius * 0.4 &&
            pz >= c.minZ - radius * 0.4 && pz <= c.maxZ + radius * 0.4) {
          let t = 0;
          if (c.rampDir === '+z') t = (pz - c.minZ) / (c.maxZ - c.minZ);
          else if (c.rampDir === '-z') t = (c.maxZ - pz) / (c.maxZ - c.minZ);
          else if (c.rampDir === '+x') t = (px - c.minX) / (c.maxX - c.minX);
          else if (c.rampDir === '-x') t = (c.maxX - px) / (c.maxX - c.minX);
          const rampY = c.minY + Math.max(0, Math.min(1, t)) * (c.maxY - c.minY);
          if (py >= rampY - 0.55 && py <= rampY + 0.35 && vy <= 0.1) {
            py = rampY;
            vy = 0;
            state.grounded = true;
          }
          continue;
        }
      }

      // Check vertical overlap with cylinder [py, py + height]
      if (py + height <= c.minY + 0.02 || py >= c.maxY - 0.02) {
        continue;
      }

      // Closest point on AABB in XZ plane to circle (px, pz, radius)
      const closestX = Math.max(c.minX, Math.min(px, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        // Auto-step onto low ledges/platforms (<= STEP_HEIGHT)
        const stepDelta = c.maxY - py;
        if (stepDelta > 0 && stepDelta <= PLAYER_DIMENSIONS.STEP_HEIGHT && vy <= 0.5) {
          py = c.maxY;
          vy = 0;
          state.grounded = true;
          continue;
        }

        // Push out horizontally without sticking
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = radius - dist;
          const nx = dx / dist;
          const nz = dz / dist;
          px += nx * overlap;
          pz += nz * overlap;
          // Slide velocity along normal
          const vn = vx * nx + vz * nz;
          if (vn < 0) {
            vx -= vn * nx;
            vz -= vn * nz;
          }
        } else {
          // Center is inside box; push out along minimum penetration axis
          const penLeft = px - c.minX + radius;
          const penRight = c.maxX - px + radius;
          const penBack = pz - c.minZ + radius;
          const penFront = c.maxZ - pz + radius;
          const minPen = Math.min(penLeft, penRight, penBack, penFront);
          if (minPen === penLeft) { px = c.minX - radius; vx = Math.min(0, vx); }
          else if (minPen === penRight) { px = c.maxX + radius; vx = Math.max(0, vx); }
          else if (minPen === penBack) { pz = c.minZ - radius; vz = Math.min(0, vz); }
          else { pz = c.maxZ + radius; vz = Math.max(0, vz); }
        }
      }
    }

    // Apply vertical displacement & ground check
    py += vy * dt;
    let floorY = 0;

    for (let i = 0; i < nearby.length; i++) {
      const c = nearby[i];
      if (c.isRamp) continue;
      const closestX = Math.max(c.minX, Math.min(px, c.maxX));
      const closestZ = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      if (dx * dx + dz * dz < (radius * 0.85) * (radius * 0.85)) {
        // Landing on top of box
        if (py >= c.maxY - 0.35 && py <= c.maxY + 0.15 && vy <= 0) {
          if (c.maxY > floorY) floorY = c.maxY;
        }
        // Hitting head on ceiling (e.g. B tunnels roof)
        if (py + height > c.minY && py < c.minY && vy > 0) {
          py = c.minY - height;
          vy = 0;
        }
      }
    }

    // Also check ramp height at final XZ
    const rampFloor = this.getGroundHeightAt(px, pz, py);
    if (rampFloor > floorY) {
      floorY = rampFloor;
    }

    if (py <= floorY) {
      py = floorY;
      vy = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }

    state.position[0] = px;
    state.position[1] = py;
    state.position[2] = pz;
    state.velocity[0] = vx;
    state.velocity[1] = vy;
    state.velocity[2] = vz;
  }

  /**
   * Fast slab-method Ray vs AABB intersection for hitscan weapons,
   * line-of-sight checks, and wallbang penetration.
   */
  public raycastWorld(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number
  ): RaycastHit[] {
    const hits: RaycastHit[] = [];
    const invX = Math.abs(dx) > 1e-6 ? 1 / dx : 1e9;
    const invY = Math.abs(dy) > 1e-6 ? 1 / dy : 1e9;
    const invZ = Math.abs(dz) > 1e-6 ? 1 / dz : 1e9;

    // Ground plane intersection (y = 0)
    if (dy < -1e-5 && oy > 0) {
      const tGround = -oy / dy;
      if (tGround > 0 && tGround <= maxDist) {
        hits.push({
          distance: tGround,
          point: [ox + dx * tGround, 0, oz + dz * tGround],
          normal: [0, 1, 0],
          boxId: 'ground',
          penetrable: false,
        });
      }
    }

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const t1 = (c.minX - ox) * invX;
      const t2 = (c.maxX - ox) * invX;
      const t3 = (c.minY - oy) * invY;
      const t4 = (c.maxY - oy) * invY;
      const t5 = (c.minZ - oz) * invZ;
      const t6 = (c.maxZ - oz) * invZ;

      const tmin = Math.max(
        Math.min(t1, t2),
        Math.min(t3, t4),
        Math.min(t5, t6)
      );
      const tmax = Math.min(
        Math.max(t1, t2),
        Math.max(t3, t4),
        Math.max(t5, t6)
      );

      if (tmax >= 0 && tmin <= tmax && tmin <= maxDist) {
        const hitDist = tmin >= 0 ? tmin : 0;
        const hx = ox + dx * hitDist;
        const hy = oy + dy * hitDist;
        const hz = oz + dz * hitDist;

        // Compute face normal
        let nx = 0;
        let ny = 0;
        let nz = 0;
        const eps = 0.002;
        if (Math.abs(hx - c.minX) < eps) nx = -1;
        else if (Math.abs(hx - c.maxX) < eps) nx = 1;
        else if (Math.abs(hy - c.minY) < eps) ny = -1;
        else if (Math.abs(hy - c.maxY) < eps) ny = 1;
        else if (Math.abs(hz - c.minZ) < eps) nz = -1;
        else nz = 1;

        hits.push({
          distance: hitDist,
          point: [hx, hy, hz],
          normal: [nx, ny, nz],
          boxId: c.id,
          penetrable: c.penetrable,
        });
      }
    }

    hits.sort((a, b) => a.distance - b.distance);
    return hits;
  }

  /**
   * Checks clear line of sight between two 3D points, also checking active smoke clouds.
   */
  public hasLineOfSight(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    smokeClouds: Array<{ position: [number, number, number]; radius: number }> = []
  ): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.01) return true;

    const nx = dx / dist;
    const ny = dy / dist;
    const nz = dz / dist;

    // Check smoke clouds first
    for (let i = 0; i < smokeClouds.length; i++) {
      const s = smokeClouds[i];
      const sx = s.position[0] - ax;
      const sy = s.position[1] - ay;
      const sz = s.position[2] - az;
      const proj = sx * nx + sy * ny + sz * nz;
      if (proj > 0 && proj < dist) {
        const perpSq = sx * sx + sy * sy + sz * sz - proj * proj;
        if (perpSq < s.radius * s.radius) {
          return false; // Blocked by smoke grenade
        }
      }
    }

    const hits = this.raycastWorld(ax, ay, az, nx, ny, nz, dist - 0.05);
    return hits.length === 0;
  }
}
