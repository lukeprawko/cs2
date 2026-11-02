import { audioEngine } from '../engine/AudioEngine';
import { BombData } from './BombLogic';
import { KillFeedEntry, RoundEndSummary, RoundPhase, useGameStore } from '../store/useGameStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { Team, WeaponId } from './WeaponsDB';

export interface NetActorSnapshot {
  id: string;
  name: string;
  team: Team;
  isBot: boolean;
  alive: boolean;
  hp: number;
  armor: number;
  hasHelmet: boolean;
  hasDefuseKit: boolean;
  hasC4: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  position: [number, number, number];
  velocity: [number, number, number];
  yaw: number;
  pitch: number;
  crouching: boolean;
  activeWeapon: WeaponId;
  primaryWeapon: WeaponId | null;
  secondaryWeapon: WeaponId;
  grenades: WeaponId[];
}

export interface RoomMatchSnapshot {
  roundPhase: RoundPhase;
  roundNumber: number;
  ctScore: number;
  tScore: number;
  phaseTimeRemaining: number;
  bomb: BombData;
  actors: NetActorSnapshot[];
}

interface WsPacket {
  type: string;
  payload?: unknown;
}

class MultiplayerClientManager {
  private ws: WebSocket | null = null;
  private pendingQueue: string[] = [];
  public localPlayerId = 'local_player';
  public latestSnapshot: RoomMatchSnapshot | null = null;
  public onMatchStartCallback: ((snap: RoomMatchSnapshot) => void) | null = null;
  public onRemoteShotCallback:
    | ((
        shooterId: string,
        weaponId: WeaponId,
        origin: [number, number, number],
        target: [number, number, number]
      ) => void)
    | null = null;

  public connect(): WebSocket | null {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return this.ws;
    }

    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const url = isLocal
      ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws-game`
      : 'wss://cs2-dust-alley-server-ldgh.onrender.com/ws-game';

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.addEventListener('open', () => {
        useGameStore.getState().setLobbyState({
          connected: true,
          error: null,
        });
        while (this.pendingQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const msg = this.pendingQueue.shift();
          if (msg) ws.send(msg);
        }
      });

      ws.addEventListener('error', () => {
        useGameStore.getState().setLobbyState({
          connected: false,
          error: 'Brak połączenia z serwerem',
        });
      });

      ws.addEventListener('close', () => {
        useGameStore.getState().setLobbyState({
          connected: false,
          inRoom: false,
          roomCode: '',
          isHost: false,
          players: [],
        });
      });

      ws.addEventListener('message', (event) => {
        try {
          const packet = JSON.parse(String(event.data)) as WsPacket;
          this.handleServerPacket(packet);
        } catch {
          // Ignore malformed packet
        }
      });

      return ws;
    } catch (e) {
      useGameStore.getState().setLobbyState({
        connected: false,
        error: 'Brak połączenia z serwerem',
      });
      return null;
    }
  }

  private emit(type: string, payload?: unknown): void {
    const raw = JSON.stringify({ type, payload });
    const ws = this.connect();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    } else {
      this.pendingQueue.push(raw);
    }
  }

  private handleServerPacket(packet: WsPacket): void {
    const { type, payload } = packet;

    if (type === 'welcome') {
      const data = payload as { clientId: string };
      if (data?.clientId) {
        this.localPlayerId = data.clientId;
      }
      return;
    }

    if (type === 'room:state') {
      const data = payload as {
        roomCode: string;
        hostId: string;
        fillWithBots?: boolean;
        players: Array<{ id: string; name: string; team: Team; isHost: boolean }>;
      };
      useGameStore.getState().setLobbyState({
        inRoom: true,
        roomCode: data.roomCode,
        isHost: data.hostId === this.localPlayerId,
        fillWithBots: Boolean(data.fillWithBots),
        players: data.players,
        error: null,
      });
      return;
    }

    if (type === 'room:error') {
      const data = payload as { message: string };
      useGameStore.getState().setLobbyState({
        error: data.message,
      });
      return;
    }

    if (type === 'match:start') {
      const snap = payload as RoomMatchSnapshot;
      this.latestSnapshot = snap;
      useGameStore.getState().updateHUD({
        isMultiplayer: true,
        screenState: 'playing',
        roundEndSummary: null,
      });
      if (this.onMatchStartCallback) {
        this.onMatchStartCallback(snap);
      }
      return;
    }

    if (type === 'match:snapshot') {
      this.latestSnapshot = payload as RoomMatchSnapshot;
      return;
    }

    if (type === 'match:kill') {
      useGameStore.getState().pushKillFeed(payload as KillFeedEntry);
      return;
    }

    if (type === 'match:hit') {
      const data = payload as {
        shooterId: string;
        victimId: string;
        isHeadshot: boolean;
      };
      if (data.shooterId === this.localPlayerId) {
        audioEngine.playHitMarker(data.isHeadshot);
        useGameStore.getState().updateHUD({
          hitMarker: data.isHeadshot ? 'headshot' : 'normal',
        });
        setTimeout(() => {
          useGameStore.getState().updateHUD({ hitMarker: 'none' });
        }, 140);
      }
      return;
    }

    if (type === 'match:shot') {
      const data = payload as {
        shooterId: string;
        weaponId: WeaponId;
        origin: [number, number, number];
        target: [number, number, number];
      };
      if (data.shooterId !== this.localPlayerId && data.weaponId !== 'knife') {
        audioEngine.playGunshot(data.weaponId, data.origin);
      }
      if (this.onRemoteShotCallback && data.weaponId !== 'knife') {
        this.onRemoteShotCallback(
          data.shooterId,
          data.weaponId,
          data.origin,
          data.target
        );
      }
      return;
    }

    if (type === 'match:round_end') {
      useGameStore
        .getState()
        .updateHUD({ roundEndSummary: (payload as RoundEndSummary) || null });
    }
  }

  public onMatchStart(cb: (snap: RoomMatchSnapshot) => void): void {
    this.onMatchStartCallback = cb;
  }

  public createRoom(name: string, team: Team, fillWithBots = false): void {
    this.emit('room:create', { name, team, fillWithBots });
  }

  public joinRoom(roomCode: string, name: string, team: Team): void {
    this.emit('room:join', {
      roomCode: roomCode.trim().toUpperCase(),
      name,
      team,
    });
  }

  public switchTeam(team: Team): void {
    this.emit('room:team', { team });
  }

  public setFillWithBots(fillWithBots: boolean): void {
    this.emit('room:bot_toggle', { fillWithBots });
  }

  public startMatch(fillWithBots?: boolean): void {
    const currentBots =
      fillWithBots !== undefined
        ? fillWithBots
        : useGameStore.getState().lobby.fillWithBots;
    this.emit('room:start', { fillWithBots: currentBots });
  }

  public skipBuyPhase(): void {
    this.emit('player:skip_buy');
  }

  public leaveRoom(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'room:leave' }));
    }
    this.latestSnapshot = null;
    useGameStore.getState().setLobbyState({
      inRoom: false,
      roomCode: '',
      isHost: false,
      fillWithBots: false,
      players: [],
    });
    useGameStore.getState().updateHUD({
      isMultiplayer: false,
    });
  }

  public sendInput(payload: {
    position: [number, number, number];
    velocity: [number, number, number];
    yaw: number;
    pitch: number;
    crouching: boolean;
    activeWeapon: WeaponId;
    firing: boolean;
    planting: boolean;
    defusing: boolean;
  }): void {
    if (!useGameStore.getState().isMultiplayer) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'player:input', payload }));
    }
  }

  public sendFire(payload: {
    origin: [number, number, number];
    dir: [number, number, number];
    weaponId: WeaponId;
  }): void {
    if (!useGameStore.getState().isMultiplayer) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'player:fire', payload }));
    }
  }

  public sendBuy(itemId: string): void {
    if (!useGameStore.getState().isMultiplayer) return;
    this.emit('player:buy', { itemId });
  }
}

export const multiplayerClient = new MultiplayerClientManager();
