import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { NavGraph } from './src/engine/NavGraph';
import { PhysicsWorld } from './src/engine/Physics';
import {
  BOMB_CONSTANTS,
  BombData,
  createInitialBombData,
} from './src/game/BombLogic';
import {
  ActorState,
  BOT_NAMES_CT,
  BOT_NAMES_T,
  pickRoundStrategyT,
  RoundStrategyT,
  TacticalRole,
  updateBotAI,
} from './src/game/BotAI';
import {
  calculateHitDamage,
  clampMoney,
  ECONOMY_CONSTANTS,
  EQUIPMENT_DB,
  executeBotAutoBuy,
  getLossBonus,
  HitboxZone,
} from './src/game/Economy';
import { getStartingPistol, Team, WEAPONS_DB, WeaponId } from './src/game/WeaponsDB';
import {
  CT_SPAWNS,
  DUST_ALLEY_BOXES,
  getActiveBombSite,
  PLAYER_DIMENSIONS,
  T_SPAWNS,
} from './src/world/DustAlleyMap';

interface LobbyPlayer {
  id: string;
  name: string;
  team: Team;
  isHost: boolean;
}

// Global crash safeguards so malformed packets / internal errors never exit the server process
process.on('uncaughtException', (err) => {
  console.error('[DustAlley Server SAFEGUARD] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[DustAlley Server SAFEGUARD] Unhandled Rejection:', reason);
});

interface RoomSession {
  code: string;
  hostId: string;
  fillWithBots: boolean;
  players: Map<string, LobbyPlayer>;
  sockets: Map<string, WebSocket>;
  started: boolean;
  roundPhase: 'buy' | 'live' | 'planted' | 'round_end' | 'match_end';
  roundNumber: number;
  ctScore: number;
  tScore: number;
  ctLossStreak: number;
  tLossStreak: number;
  phaseTimer: number;
  tStrategy: RoundStrategyT;
  bomb: BombData;
  actors: ActorState[];
  spawnPositions: Map<string, { x: number; y: number; z: number }>;
  playerInputs: Map<
    string,
    {
      planting: boolean;
      defusing: boolean;
    }
  >;
  lastActivity: number;
}

// Anti-DDoS and rate-limiting limits
const MAX_GLOBAL_ROOMS = 40;
const MAX_CONCURRENT_PER_IP = 8;
const MAX_ROOM_CREATES_PER_MIN = 3;
const MAX_WS_MSG_PER_SEC = 35;

const ipConnections = new Map<string, number>();
const ipRoomCreates = new Map<string, number[]>();

const rooms = new Map<string, RoomSession>();
const clientToRoom = new Map<string, string>();

// Shared server-side physics & navigation for authoritative bot AI & raycasting
const serverPhysics = new PhysicsWorld(DUST_ALLEY_BOXES);
const serverNav = new NavGraph();

let nextClientSeq = 1;

function sendToSocket(ws: WebSocket, type: string, payload?: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload }));
  }
}

function broadcastToRoom(room: RoomSession, type: string, payload?: unknown): void {
  const raw = JSON.stringify({ type, payload });
  for (const ws of room.sockets.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return 'VK6LS';
}

function createServerActor(
  id: string,
  name: string,
  team: Team,
  isBot: boolean,
  role: TacticalRole,
  assignedSite: 'A' | 'B' | 'MID'
): ActorState {
  const starterPistol: WeaponId = getStartingPistol(team);
  const ammoMag = {} as Record<WeaponId, number>;
  const ammoReserve = {} as Record<WeaponId, number>;
  for (const wKey of Object.keys(WEAPONS_DB) as WeaponId[]) {
    ammoMag[wKey] = WEAPONS_DB[wKey].magSize;
    ammoReserve[wKey] = WEAPONS_DB[wKey].reserveAmmo;
  }

  return {
    id,
    name,
    team,
    isBot,
    role,
    alive: true,
    hp: 100,
    armor: 0,
    hasHelmet: false,
    hasDefuseKit: false,
    hasC4: false,
    money: ECONOMY_CONSTANTS.START_MONEY,
    kills: 0,
    deaths: 0,
    assists: 0,
    mvps: 0,
    ping: isBot ? 0 : 18,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    yaw: team === 'CT' ? Math.PI : 0,
    pitch: 0,
    grounded: true,
    crouching: false,
    walking: false,
    walkCycle: 0,
    activeWeapon: starterPistol,
    primaryWeapon: null,
    secondaryWeapon: starterPistol,
    grenades: [],
    ammoMag,
    ammoReserve,
    fireCooldown: 0,
    reloadTimer: 0,
    deployTimer: 0,
    recoilPitch: 0,
    recoilYaw: 0,
    zoomLevel: 0,
    flashBlindTimer: 0,
    hitFlashTimer: 0,
    koTimer: 0,
    spottedUntil: 0,
    path: [],
    pathCursor: 0,
    repathTimer: 0,
    targetEnemyId: null,
    reactionTimer: 0,
    lastKnownEnemyPos: null,
    assignedSite,
    strafeDir: 1,
    strafeTimer: 1,
    utilityCooldown: 0,
  };
}

function setupServerRound(room: RoomSession, isPistolRound: boolean): void {
  room.roundPhase = 'buy';
  room.phaseTimer = 5.0;
  room.tStrategy = pickRoundStrategyT();
  room.spawnPositions.clear();

  let ctIdx = 0;
  let tIdx = 0;
  const tActors: ActorState[] = [];

  for (const actor of room.actors) {
    const survivedPrevious = actor.alive && !isPistolRound;
    actor.alive = true;
    actor.hp = 100;
    actor.velocity = [0, 0, 0];
    actor.crouching = false;
    actor.hasC4 = false;

    if (isPistolRound || !survivedPrevious) {
      actor.armor = 0;
      actor.hasHelmet = false;
      actor.hasDefuseKit = false;
      actor.primaryWeapon = null;
      actor.secondaryWeapon = getStartingPistol(actor.team);
      actor.activeWeapon = actor.secondaryWeapon;
      actor.grenades = [];
      if (isPistolRound) {
        actor.money = ECONOMY_CONSTANTS.START_MONEY;
      }
    }

    // Bots buy equipment automatically when enabled
    if (actor.isBot) {
      const bought = executeBotAutoBuy(
        {
          money: actor.money,
          team: actor.team,
          primary: actor.primaryWeapon,
          secondary: actor.secondaryWeapon,
          grenades: actor.grenades,
          armor: actor.armor,
          hasHelmet: actor.hasHelmet,
          hasDefuseKit: actor.hasDefuseKit,
        },
        actor.role === 'sniper'
      );
      actor.money = bought.money;
      actor.primaryWeapon = bought.primary;
      actor.secondaryWeapon = bought.secondary;
      actor.grenades = bought.grenades;
      actor.armor = bought.armor;
      actor.hasHelmet = bought.hasHelmet;
      actor.hasDefuseKit = bought.hasDefuseKit;
    }

    for (const wKey of Object.keys(WEAPONS_DB) as WeaponId[]) {
      actor.ammoMag[wKey] = WEAPONS_DB[wKey].magSize;
      actor.ammoReserve[wKey] = WEAPONS_DB[wKey].reserveAmmo;
    }

    actor.activeWeapon = actor.primaryWeapon || actor.secondaryWeapon;

    if (actor.team === 'CT') {
      const sp = CT_SPAWNS[ctIdx % CT_SPAWNS.length];
      ctIdx++;
      actor.position = [sp.x, sp.y, sp.z];
      actor.yaw = sp.yaw;
      room.spawnPositions.set(actor.id, { x: sp.x, y: sp.y, z: sp.z });
    } else {
      const sp = T_SPAWNS[tIdx % T_SPAWNS.length];
      tIdx++;
      actor.position = [sp.x, sp.y, sp.z];
      actor.yaw = sp.yaw;
      room.spawnPositions.set(actor.id, { x: sp.x, y: sp.y, z: sp.z });
      tActors.push(actor);
    }
  }

  // Assign C4 to a human T player first if present, otherwise random T actor
  if (tActors.length > 0) {
    const humanT = tActors.find((a) => !a.isBot);
    const carrier = humanT || tActors[Math.floor(Math.random() * tActors.length)];
    carrier.hasC4 = true;
    room.bomb = createInitialBombData(carrier.id, carrier.position);
  } else {
    room.bomb = createInitialBombData(null, [3.5, 0, 20.2]);
  }
}

function buildSnapshot(room: RoomSession) {
  return {
    roundPhase: room.roundPhase,
    roundNumber: room.roundNumber,
    ctScore: room.ctScore,
    tScore: room.tScore,
    phaseTimeRemaining: room.phaseTimer,
    bomb: room.bomb,
    actors: room.actors.map((a) => ({
      id: a.id,
      name: a.name,
      team: a.team,
      isBot: a.isBot,
      alive: a.alive,
      hp: a.hp,
      armor: a.armor,
      hasHelmet: a.hasHelmet,
      hasDefuseKit: a.hasDefuseKit,
      hasC4: a.hasC4,
      money: a.money,
      kills: a.kills,
      deaths: a.deaths,
      assists: a.assists,
      mvps: a.mvps,
      position: a.position,
      velocity: a.velocity,
      yaw: a.yaw,
      pitch: a.pitch,
      crouching: a.crouching,
      activeWeapon: a.activeWeapon,
      primaryWeapon: a.primaryWeapon,
      secondaryWeapon: a.secondaryWeapon,
      grenades: a.grenades,
    })),
  };
}

function emitRoomLobbyState(room: RoomSession): void {
  broadcastToRoom(room, 'room:state', {
    roomCode: room.code,
    hostId: room.hostId,
    fillWithBots: room.fillWithBots,
    players: Array.from(room.players.values()),
  });
}

function handleServerHitscan(
  room: RoomSession,
  shooter: ActorState,
  origin: [number, number, number],
  dir: [number, number, number]
): void {
  const spec = WEAPONS_DB[shooter.activeWeapon];
  const worldHits = serverPhysics.raycastWorld(
    origin[0],
    origin[1],
    origin[2],
    dir[0],
    dir[1],
    dir[2],
    spec.range
  );
  const firstWall = worldHits[0] || null;
  const maxSolidDist =
    firstWall && !firstWall.penetrable ? firstWall.distance : spec.range;

  let hitActor: ActorState | null = null;
  let hitDist = maxSolidDist;
  let hitZone: HitboxZone = 'chest';

  for (const target of room.actors) {
    if (!target.alive || target.id === shooter.id || target.team === shooter.team) {
      continue;
    }

    const actorHeight = target.crouching
      ? PLAYER_DIMENSIONS.HEIGHT_CROUCH
      : PLAYER_DIMENSIONS.HEIGHT_STAND;
    const radius = 0.42;

    const toX = target.position[0] - origin[0];
    const toZ = target.position[2] - origin[2];
    const proj = toX * dir[0] + toZ * dir[2];
    if (proj < 0 || proj > hitDist) continue;

    const closestX = origin[0] + dir[0] * proj;
    const closestY = origin[1] + dir[1] * proj;
    const closestZ = origin[2] + dir[2] * proj;

    const distSqXZ =
      (closestX - target.position[0]) ** 2 +
      (closestZ - target.position[2]) ** 2;

    if (
      distSqXZ <= radius * radius &&
      closestY >= target.position[1] &&
      closestY <= target.position[1] + actorHeight
    ) {
      hitActor = target;
      hitDist = proj;
      const relY = (closestY - target.position[1]) / actorHeight;
      if (relY > 0.78) hitZone = 'head';
      else if (relY > 0.52) hitZone = 'chest';
      else if (relY > 0.34) hitZone = 'stomach';
      else hitZone = 'legs';
    }
  }

  const endTarget: [number, number, number] = [
    origin[0] + dir[0] * hitDist,
    origin[1] + dir[1] * hitDist,
    origin[2] + dir[2] * hitDist,
  ];

  broadcastToRoom(room, 'match:shot', {
    shooterId: shooter.id,
    weaponId: shooter.activeWeapon,
    origin,
    target: endTarget,
  });

  if (!hitActor) return;

  const isWallbang = Boolean(firstWall && firstWall.distance < hitDist);
  const dmg = calculateHitDamage(
    shooter.activeWeapon,
    hitZone,
    hitDist,
    hitActor.armor,
    hitActor.hasHelmet,
    isWallbang ? 0.32 : 0
  );

  hitActor.hp = Math.max(0, hitActor.hp - dmg.healthDamage);
  hitActor.armor = Math.max(0, hitActor.armor - dmg.armorDamage);

  broadcastToRoom(room, 'match:hit', {
    shooterId: shooter.id,
    victimId: hitActor.id,
    isHeadshot: dmg.isHeadshot,
  });

  if (hitActor.hp <= 0) {
    hitActor.alive = false;
    hitActor.deaths += 1;
    // Strip weapons & armor upon death
    hitActor.primaryWeapon = null;
    hitActor.secondaryWeapon = getStartingPistol(hitActor.team);
    hitActor.activeWeapon = hitActor.secondaryWeapon;
    hitActor.grenades = [];
    hitActor.armor = 0;
    hitActor.hasHelmet = false;
    hitActor.hasDefuseKit = false;

    shooter.kills += 1;
    shooter.money = clampMoney(shooter.money + spec.killReward);

    if (hitActor.hasC4) {
      hitActor.hasC4 = false;
      room.bomb.state = 'dropped';
      room.bomb.carrierId = null;
      room.bomb.position = [
        hitActor.position[0],
        hitActor.position[1] + 0.05,
        hitActor.position[2],
      ];
    }

    broadcastToRoom(room, 'match:kill', {
      id: `${Date.now()}_${Math.random()}`,
      killerName: shooter.name,
      killerTeam: shooter.team,
      victimName: hitActor.name,
      victimTeam: hitActor.team,
      weaponId: shooter.activeWeapon,
      isHeadshot: dmg.isHeadshot,
      isWallbang,
      timestamp: Date.now(),
    });

    checkServerTeamElimination(room);
  }
}

function checkServerTeamElimination(room: RoomSession): void {
  if (room.roundPhase !== 'live' && room.roundPhase !== 'planted') return;
  const ctTotal = room.actors.filter((a) => a.team === 'CT').length;
  const tTotal = room.actors.filter((a) => a.team === 'T').length;
  if (ctTotal > 0 && tTotal > 0) {
    const ctAlive = room.actors.filter((a) => a.team === 'CT' && a.alive).length;
    const tAlive = room.actors.filter((a) => a.team === 'T' && a.alive).length;
    if (ctAlive === 0) {
      endServerRound(room, 'T', 'Oddział antyterrorystów wyeliminowany');
    } else if (tAlive === 0 && room.bomb.state !== 'planted') {
      endServerRound(room, 'CT', 'Oddział terrorystów wyeliminowany');
    }
  }
}

function endServerRound(
  room: RoomSession,
  winner: Team,
  reason: string
): void {
  if (room.roundPhase === 'round_end' || room.roundPhase === 'match_end') return;
  room.roundPhase = 'round_end';
  room.phaseTimer = 5.0;

  if (winner === 'CT') {
    room.ctScore += 1;
    room.ctLossStreak = 0;
    room.tLossStreak += 1;
  } else {
    room.tScore += 1;
    room.tLossStreak = 0;
    room.ctLossStreak += 1;
  }

  const winReward =
    room.bomb.state === 'defused'
      ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_DEFUSED
      : room.bomb.state === 'exploded'
      ? ECONOMY_CONSTANTS.WIN_REWARD_BOMB_EXPLODED
      : ECONOMY_CONSTANTS.WIN_REWARD_ELIMINATION;

  const lossBonus =
    winner === 'CT'
      ? getLossBonus(room.tLossStreak) +
        (room.bomb.state === 'defused'
          ? ECONOMY_CONSTANTS.BOMB_PLANT_TEAM_BONUS_ON_LOSS
          : 0)
      : getLossBonus(room.ctLossStreak);

  for (const a of room.actors) {
    if (a.team === winner) {
      a.money = clampMoney(a.money + winReward);
    } else {
      a.money = clampMoney(a.money + lossBonus);
    }
  }

  const winningActors = room.actors.filter((a) => a.team === winner);
  const mvp = winningActors[0] || room.actors[0];
  if (mvp) mvp.mvps += 1;

  broadcastToRoom(room, 'match:round_end', {
    winner,
    reason,
    mvpName: mvp ? mvp.name : 'Operator',
    mvpReason: 'Największy wkład w wygraną rundy',
  });
}

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname !== '/ws-game') {
      socket.destroy();
      return;
    }

    const ip = getClientIp(request);
    const currentIpConns = ipConnections.get(ip) || 0;
    if (currentIpConns >= MAX_CONCURRENT_PER_IP) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: rooms.size,
      uptime: Math.round(process.uptime()),
    });
  });

  // Background cleaner for empty / inactive rooms every 30s
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms.entries()) {
      if (room.players.size === 0 || now - room.lastActivity > 600000) {
        rooms.delete(code);
      }
    }
  }, 30000);

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const ip = getClientIp(req);
    ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);

    const clientId = `player_${nextClientSeq++}_${Math.random().toString(36).slice(2, 6)}`;
    sendToSocket(ws, 'welcome', { clientId });

    let msgCountInSec = 0;
    let secWindowStart = Date.now();
    let violationStrikes = 0;

    const cleanupClient = () => {
      const cur = ipConnections.get(ip) || 1;
      if (cur <= 1) ipConnections.delete(ip);
      else ipConnections.set(ip, cur - 1);
      removeClientFromCurrentRoom();
    };

    const removeClientFromCurrentRoom = () => {
      const code = clientToRoom.get(clientId);
      if (!code) return;
      clientToRoom.delete(clientId);
      const room = rooms.get(code);
      if (!room) return;
      room.players.delete(clientId);
      room.sockets.delete(clientId);
      room.playerInputs.delete(clientId);
      if (room.players.size === 0) {
        rooms.delete(code);
      } else {
        if (room.hostId === clientId) {
          const first = room.players.values().next().value;
          if (first) {
            room.hostId = first.id;
            first.isHost = true;
          }
        }
        emitRoomLobbyState(room);
      }
    };

    ws.on('close', cleanupClient);
    ws.on('error', cleanupClient);

    ws.on('message', (rawBuf) => {
      const now = Date.now();
      if (now - secWindowStart >= 1000) {
        secWindowStart = now;
        msgCountInSec = 0;
      }
      msgCountInSec++;

      // Anti-DDoS packet flooder protection
      if (msgCountInSec > MAX_WS_MSG_PER_SEC) {
        violationStrikes++;
        if (violationStrikes > 3) {
          try {
            ws.close(1008, 'Rate limit exceeded');
          } catch {}
        }
        return;
      }

      let packet: { type: string; payload?: Record<string, unknown> };
      try {
        packet = JSON.parse(String(rawBuf));
      } catch {
        return;
      }
      if (!packet || typeof packet !== 'object') return;

      const { type, payload = {} } = packet;

      if (type === 'room:create') {
        if (rooms.size >= MAX_GLOBAL_ROOMS) {
          sendToSocket(ws, 'room:error', {
            message: 'Serwer osiągnął limit aktywnych pokojów. Spróbuj za chwilę.',
          });
          return;
        }

        const createTimes = (ipRoomCreates.get(ip) || []).filter(
          (t) => now - t < 60000
        );
        if (createTimes.length >= MAX_ROOM_CREATES_PER_MIN) {
          sendToSocket(ws, 'room:error', {
            message: 'Zbyt częste tworzenie pokojów. Odczekaj chwilę.',
          });
          return;
        }
        createTimes.push(now);
        ipRoomCreates.set(ip, createTimes);

        removeClientFromCurrentRoom();
        const code = generateRoomCode();
        const name = String(payload.name || 'Gracz').trim().slice(0, 18);
        const team: Team = payload.team === 'T' ? 'T' : 'CT';
        const fillWithBots = Boolean(payload.fillWithBots);

        const player: LobbyPlayer = {
          id: clientId,
          name: name || 'Gracz',
          team,
          isHost: true,
        };

        const room: RoomSession = {
          code,
          hostId: clientId,
          fillWithBots,
          players: new Map([[clientId, player]]),
          sockets: new Map([[clientId, ws]]),
          started: false,
          roundPhase: 'buy',
          roundNumber: 1,
          ctScore: 0,
          tScore: 0,
          ctLossStreak: 0,
          tLossStreak: 0,
          phaseTimer: 5.0,
          tStrategy: 'RUSH_A',
          bomb: createInitialBombData(null, [3.5, 0, 20.2]),
          actors: [],
          spawnPositions: new Map(),
          playerInputs: new Map(),
          lastActivity: Date.now(),
        };

        rooms.set(code, room);
        clientToRoom.set(clientId, code);
        emitRoomLobbyState(room);
        return;
      }

      if (type === 'room:join') {
        const code = String(payload.roomCode || '').toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendToSocket(ws, 'room:error', {
            message: 'Nie znaleziono pokoju o podanym kodzie.',
          });
          return;
        }

        removeClientFromCurrentRoom();
        const player: LobbyPlayer = {
          id: clientId,
          name: String(payload.name || 'Operator').slice(0, 18),
          team: payload.team === 'T' ? 'T' : 'CT',
          isHost: false,
        };
        room.players.set(clientId, player);
        room.sockets.set(clientId, ws);
        clientToRoom.set(clientId, code);
        emitRoomLobbyState(room);

        if (room.started && !room.actors.some((a) => a.id === clientId)) {
          const spList = player.team === 'CT' ? CT_SPAWNS : T_SPAWNS;
          const sp = spList[room.actors.length % spList.length];
          const newActor = createServerActor(
            player.id,
            player.name,
            player.team,
            false,
            'entry',
            'A'
          );
          newActor.position = [sp.x, sp.y, sp.z];
          newActor.yaw = sp.yaw;
          room.spawnPositions.set(newActor.id, { x: sp.x, y: sp.y, z: sp.z });
          room.actors.push(newActor);
          sendToSocket(ws, 'match:start', buildSnapshot(room));
        }
        return;
      }

      if (type === 'room:team') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;
        const p = room.players.get(clientId);
        if (p) {
          p.team = payload.team === 'T' ? 'T' : 'CT';
          emitRoomLobbyState(room);
        }
        return;
      }

      if (type === 'room:bot_toggle') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.hostId !== clientId) return;
        room.fillWithBots = Boolean(payload.fillWithBots);
        emitRoomLobbyState(room);
        return;
      }

      if (type === 'room:start') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.hostId !== clientId) return;

        if (typeof payload.fillWithBots === 'boolean') {
          room.fillWithBots = payload.fillWithBots;
        }

        room.started = true;
        room.actors = [];

        const roles: TacticalRole[] = ['entry', 'support', 'sniper', 'lurker', 'anchor'];
        const sites: Array<'A' | 'B' | 'MID'> = ['A', 'A', 'MID', 'B', 'B'];

        const ctHumans = Array.from(room.players.values()).filter((p) => p.team === 'CT');
        const tHumans = Array.from(room.players.values()).filter((p) => p.team === 'T');

        if (room.fillWithBots) {
          for (let i = 0; i < 5; i++) {
            const h = ctHumans[i];
            if (h) {
              room.actors.push(
                createServerActor(h.id, h.name, 'CT', false, roles[i], sites[i])
              );
            } else {
              room.actors.push(
                createServerActor(
                  `bot_ct_${i}`,
                  BOT_NAMES_CT[i],
                  'CT',
                  true,
                  roles[i],
                  sites[i]
                )
              );
            }
          }

          for (let i = 0; i < 5; i++) {
            const h = tHumans[i];
            if (h) {
              room.actors.push(
                createServerActor(h.id, h.name, 'T', false, roles[i], sites[i])
              );
            } else {
              room.actors.push(
                createServerActor(
                  `bot_t_${i}`,
                  BOT_NAMES_T[i],
                  'T',
                  true,
                  roles[i],
                  sites[i]
                )
              );
            }
          }
        } else {
          // Pure human multiplayer (no bots unless fillWithBots is enabled)
          ctHumans.forEach((h, i) => {
            room.actors.push(
              createServerActor(
                h.id,
                h.name,
                'CT',
                false,
                roles[i % roles.length],
                sites[i % sites.length]
              )
            );
          });
          tHumans.forEach((h, i) => {
            room.actors.push(
              createServerActor(
                h.id,
                h.name,
                'T',
                false,
                roles[i % roles.length],
                sites[i % sites.length]
              )
            );
          });
        }

        setupServerRound(room, true);
        broadcastToRoom(room, 'match:start', buildSnapshot(room));
        return;
      }

      if (type === 'player:skip_buy') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        if (room.roundPhase === 'buy') {
          room.roundPhase = 'live';
          room.phaseTimer = 115;
          broadcastToRoom(room, 'match:snapshot', buildSnapshot(room));
        }
        return;
      }

      if (type === 'player:input') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started) return;
        room.lastActivity = Date.now();

        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;

        const pos = payload.position as [number, number, number] | undefined;
        const vel = payload.velocity as [number, number, number] | undefined;

        // During buy phase, freeze movement at spawn coordinates
        if (room.roundPhase === 'buy') {
          const sp = room.spawnPositions.get(actor.id);
          if (sp) {
            actor.position = [sp.x, sp.y, sp.z];
          }
          actor.velocity = [0, 0, 0];
        } else if (
          pos &&
          vel &&
          Array.isArray(pos) &&
          Array.isArray(vel) &&
          Number.isFinite(pos[0]) &&
          Number.isFinite(pos[1]) &&
          Number.isFinite(pos[2])
        ) {
          actor.position = [pos[0], pos[1], pos[2]];
          actor.velocity = [vel[0], vel[1], vel[2]];
        }

        if (typeof payload.yaw === 'number' && Number.isFinite(payload.yaw)) {
          actor.yaw = payload.yaw;
        }
        if (typeof payload.pitch === 'number' && Number.isFinite(payload.pitch)) {
          actor.pitch = payload.pitch;
        }
        actor.crouching = Boolean(payload.crouching);
        if (typeof payload.activeWeapon === 'string' && payload.activeWeapon in WEAPONS_DB) {
          actor.activeWeapon = payload.activeWeapon as WeaponId;
        }

        room.playerInputs.set(clientId, {
          planting: Boolean(payload.planting),
          defusing: Boolean(payload.defusing),
        });

        if (actor.hasC4 && room.bomb.state === 'carried') {
          room.bomb.position = [...actor.position];
        }
        return;
      }

      if (type === 'player:fire') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started || room.roundPhase === 'buy') return;
        room.lastActivity = Date.now();

        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;

        // Anti-fire-flood rate limit
        if (actor.fireCooldown > 0) return;
        const spec = WEAPONS_DB[actor.activeWeapon];
        actor.fireCooldown = spec ? Math.max(0.05, (60 / spec.fireRate) * 0.75) : 0.08;

        if (typeof payload.weaponId === 'string' && payload.weaponId in WEAPONS_DB) {
          actor.activeWeapon = payload.weaponId as WeaponId;
        }
        const origin = payload.origin as [number, number, number] | undefined;
        const dir = payload.dir as [number, number, number] | undefined;
        if (
          origin &&
          dir &&
          Array.isArray(origin) &&
          Array.isArray(dir) &&
          Number.isFinite(origin[0]) &&
          Number.isFinite(dir[0])
        ) {
          handleServerHitscan(room, actor, origin, dir);
        }
        return;
      }

      if (type === 'player:throw_grenade') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || !room.started || room.roundPhase === 'buy') return;
        room.lastActivity = Date.now();

        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;

        const nadeId = String(payload.nadeId || '') as WeaponId;
        const idx = actor.grenades.indexOf(nadeId);
        if (idx === -1) return; // Player doesn't own this grenade!

        if (actor.utilityCooldown > 0) return;
        actor.utilityCooldown = 0.5;

        // Remove grenade from server inventory so future snapshots don't return it
        actor.grenades.splice(idx, 1);
        actor.activeWeapon = actor.primaryWeapon || actor.secondaryWeapon;

        const origin = payload.origin as [number, number, number] | undefined;
        const velocity = payload.velocity as [number, number, number] | undefined;
        if (origin && velocity) {
          for (const [sId, sWs] of room.sockets.entries()) {
            if (sId !== clientId && sWs.readyState === WebSocket.OPEN) {
              sWs.send(
                JSON.stringify({
                  type: 'match:throw_grenade',
                  payload: {
                    throwerId: clientId,
                    throwerTeam: actor.team,
                    nadeId,
                    origin,
                    velocity,
                  },
                })
              );
            }
          }
        }
        return;
      }

      if (type === 'player:buy') {
        const code = clientToRoom.get(clientId);
        if (!code) return;
        const room = rooms.get(code);
        if (!room || room.roundPhase !== 'buy') return;
        room.lastActivity = Date.now();
        const actor = room.actors.find((a) => a.id === clientId);
        if (!actor || !actor.alive) return;

        const itemId = String(payload.itemId || '');

        // Equipment purchases
        if (itemId in EQUIPMENT_DB) {
          const eq = EQUIPMENT_DB[itemId as keyof typeof EQUIPMENT_DB];
          if (eq.team !== 'BOTH' && eq.team !== actor.team) return;

          if (itemId === 'kevlar') {
            if (actor.armor >= 100 || actor.money < eq.price) return;
            actor.money -= eq.price;
            actor.armor = 100;
            return;
          }
          if (itemId === 'kevlar_helmet') {
            const upgradeCost = actor.armor >= 100 && !actor.hasHelmet ? 350 : eq.price;
            if ((actor.armor >= 100 && actor.hasHelmet) || actor.money < upgradeCost) return;
            actor.money -= upgradeCost;
            actor.armor = 100;
            actor.hasHelmet = true;
            return;
          }
          if (itemId === 'defuse_kit') {
            if (actor.team !== 'CT' || actor.hasDefuseKit || actor.money < eq.price) return;
            actor.money -= eq.price;
            actor.hasDefuseKit = true;
            return;
          }
        }

        // Weapon & Grenade purchases
        if (itemId in WEAPONS_DB) {
          const spec = WEAPONS_DB[itemId as WeaponId];
          if (spec.team !== 'BOTH' && spec.team !== actor.team) return;
          if (spec.price <= 0 || actor.money < spec.price) return;

          if (spec.category === 'grenade') {
            if (actor.grenades.length >= ECONOMY_CONSTANTS.MAX_GRENADES) return;
            const sameCount = actor.grenades.filter((g) => g === spec.id).length;
            const maxSame = spec.id === 'flashbang' ? 2 : 1;
            if (sameCount >= maxSame) return;
            actor.money -= spec.price;
            actor.grenades.push(spec.id);
            actor.activeWeapon = spec.id;
            return;
          }

          if (spec.slot === 1) {
            if (actor.primaryWeapon === spec.id) return;
            actor.money -= spec.price;
            actor.primaryWeapon = spec.id;
          } else if (spec.slot === 2) {
            if (actor.secondaryWeapon === spec.id) return;
            actor.money -= spec.price;
            actor.secondaryWeapon = spec.id;
          }
          actor.ammoMag[spec.id] = spec.magSize;
          actor.ammoReserve[spec.id] = spec.reserveAmmo;
          actor.activeWeapon = spec.id;
        }
        return;
      }

      if (type === 'room:leave') {
        cleanupClient();
      }
    });

    ws.on('close', cleanupClient);
  });

  // Authoritative 20 Hz server simulation & snapshot broadcast loop
  const TICK_DT = 0.05;
  setInterval(() => {
    const nowSec = performance.now() / 1000;
    for (const [code, room] of rooms.entries()) {
      try {
        if (!room.started) continue;

        room.phaseTimer -= TICK_DT;

        if (room.roundPhase === 'buy' && room.phaseTimer <= 0) {
          room.roundPhase = 'live';
          room.phaseTimer = 115;
        } else if (room.roundPhase === 'live' && room.phaseTimer <= 0) {
          endServerRound(room, 'CT', 'Czas rundy dobiegł końca — obrona CT');
        } else if (room.roundPhase === 'round_end' && room.phaseTimer <= 0) {
          broadcastToRoom(room, 'match:round_end', null);
          room.roundNumber += 1;
          setupServerRound(room, false);
        }

        // Update cooldowns for all actors & run bot AI
        for (const actor of room.actors) {
          actor.fireCooldown = Math.max(0, actor.fireCooldown - TICK_DT);
          actor.utilityCooldown = Math.max(0, actor.utilityCooldown - TICK_DT);
          if (actor.isBot && actor.alive) {
            actor.reloadTimer = Math.max(0, actor.reloadTimer - TICK_DT);
            updateBotAI(
              actor,
              room.actors,
              room.bomb,
              room.roundPhase,
              room.tStrategy,
              'medium',
              serverPhysics,
              serverNav,
              [],
              nowSec,
              TICK_DT,
              {
                onFireWeapon: (bot) => {
                  if (bot.fireCooldown > 0) return;
                  const spec = WEAPONS_DB[bot.activeWeapon];
                  bot.fireCooldown = 60 / spec.fireRate;
                  const origin: [number, number, number] = [
                    bot.position[0],
                    bot.position[1] + 1.5,
                    bot.position[2],
                  ];
                  const dir: [number, number, number] = [
                    -Math.sin(bot.yaw) * Math.cos(bot.pitch),
                    Math.sin(bot.pitch),
                    -Math.cos(bot.yaw) * Math.cos(bot.pitch),
                  ];
                  handleServerHitscan(room, bot, origin, dir);
                },
                onThrowGrenade: () => {},
                onRadioCallout: () => {},
              }
            );
          }
        }

      // Dropped C4 pickup by alive T players
      if (room.bomb.state === 'dropped') {
        for (const actor of room.actors) {
          if (actor.alive && actor.team === 'T') {
            const dist = Math.hypot(
              actor.position[0] - room.bomb.position[0],
              actor.position[2] - room.bomb.position[2]
            );
            if (dist < 1.8) {
              actor.hasC4 = true;
              room.bomb.state = 'carried';
              room.bomb.carrierId = actor.id;
              break;
            }
          }
        }
      }

      // Handle C4 Plant & Defuse in live/planted phases
      if (room.roundPhase === 'live' && room.bomb.state === 'carried') {
        let planter: ActorState | undefined;
        let activeSite: 'A' | 'B' | null = null;

        for (const actor of room.actors) {
          if (!actor.alive || actor.team !== 'T' || !actor.hasC4) continue;
          const site = getActiveBombSite(actor.position[0], actor.position[2]);
          const inp = room.playerInputs.get(actor.id);
          const wantsPlant = actor.isBot
            ? Boolean(
                site &&
                  Math.hypot(actor.velocity[0], actor.velocity[2]) < 0.6
              )
            : Boolean(site && inp?.planting);
          if (wantsPlant && site) {
            planter = actor;
            activeSite = site;
            break;
          }
        }

        if (planter && activeSite) {
          room.bomb.planterId = planter.id;
          room.bomb.plantProgress += TICK_DT / BOMB_CONSTANTS.PLANT_TIME;
          if (room.bomb.plantProgress >= 1.0) {
            room.bomb.state = 'planted';
            room.bomb.site = activeSite;
            room.bomb.carrierId = null;
            room.bomb.planterId = null;
            room.bomb.plantProgress = 0;
            room.bomb.timeRemaining = BOMB_CONSTANTS.BOMB_TIMER;
            room.bomb.position = [
              planter.position[0],
              planter.position[1] + 0.05,
              planter.position[2],
            ];
            planter.hasC4 = false;
            planter.money = clampMoney(
              planter.money + ECONOMY_CONSTANTS.BOMB_PLANT_INDIVIDUAL
            );
            room.roundPhase = 'planted';
            room.phaseTimer = BOMB_CONSTANTS.BOMB_TIMER;
          }
        } else {
          room.bomb.planterId = null;
          room.bomb.plantProgress = 0;
        }
      }

      if (room.roundPhase === 'planted' && room.bomb.state === 'planted') {
        room.bomb.timeRemaining = Math.max(0, room.bomb.timeRemaining - TICK_DT);
        room.phaseTimer = room.bomb.timeRemaining;

        let defuser: ActorState | undefined;
        for (const actor of room.actors) {
          if (!actor.alive || actor.team !== 'CT') continue;
          const dist = Math.hypot(
            actor.position[0] - room.bomb.position[0],
            actor.position[2] - room.bomb.position[2]
          );
          const inp = room.playerInputs.get(actor.id);
          const wantsDefuse = actor.isBot
            ? dist <= BOMB_CONSTANTS.INTERACTION_RADIUS &&
              Math.hypot(actor.velocity[0], actor.velocity[2]) < 0.6
            : dist <= BOMB_CONSTANTS.INTERACTION_RADIUS && Boolean(inp?.defusing);
          if (wantsDefuse) {
            defuser = actor;
            break;
          }
        }

        if (defuser) {
          room.bomb.defuserId = defuser.id;
          room.bomb.defuserHasKit = defuser.hasDefuseKit;
          const defuseDur = defuser.hasDefuseKit
            ? BOMB_CONSTANTS.DEFUSE_TIME_WITH_KIT
            : BOMB_CONSTANTS.DEFUSE_TIME_NO_KIT;
          room.bomb.defuseProgress += TICK_DT / defuseDur;
          if (room.bomb.defuseProgress >= 1.0) {
            room.bomb.state = 'defused';
            room.bomb.defuserId = null;
            room.bomb.defuseProgress = 0;
            defuser.money = clampMoney(
              defuser.money + ECONOMY_CONSTANTS.BOMB_DEFUSE_INDIVIDUAL
            );
            endServerRound(room, 'CT', 'Ładunek C4 został rozbrojony!');
          }
        } else {
          room.bomb.defuserId = null;
          room.bomb.defuseProgress = 0;
        }

        if (room.bomb.state === 'planted' && room.bomb.timeRemaining <= 0) {
          room.bomb.state = 'exploded';
          endServerRound(room, 'T', 'Ładunek C4 eksplodował!');
        }
      }

      // Check team elimination (if all CTs die even after bomb is planted, T wins immediately)
      checkServerTeamElimination(room);

      broadcastToRoom(room, 'match:snapshot', buildSnapshot(room));
      } catch (err) {
        console.error(`[SIMULATION ERROR in room ${code}]:`, err);
      }
    }
  }, 50);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n[BŁĄD] Port ${PORT} jest już zajęty przez inny proces node.exe!` +
        `\nZamknij inne okno terminala lub uruchom: npx kill-port ${PORT}\n`
      );
    } else {
      console.error('Server error:', err);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Dust Alley Server listening on http://localhost:${PORT}`);
  });
}

startServer();
