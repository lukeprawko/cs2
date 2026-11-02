/**
 * Unified Input Manager with held and edge-triggered (justPressed) tracking,
 * mouse look deltas, scroll wheel weapon cycling, and focus-loss safety.
 */
let programmaticUnlock = false;
let lastUserUnlockTimestamp = -10000;

/**
 * Safely exits Pointer Lock and marks the exit as programmatic so it isn't
 * treated as a user-initiated Escape key exit.
 */
export function exitPointerLockSafe(): void {
  if (typeof document === 'undefined') return;
  if (document.pointerLockElement) {
    programmaticUnlock = true;
    try {
      document.exitPointerLock?.();
    } catch {
      programmaticUnlock = false;
    }
  }
}

/**
 * Safely requests fullscreen mode and keyboard lock to prevent accidental
 * browser exits during intense FPS gameplay.
 */
export function requestFullscreenSafe(): void {
  if (typeof document === 'undefined') return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      const p = document.documentElement.requestFullscreen();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Ignore if blocked in headless or restricted environment
        });
      }
    }
    const nav = navigator as unknown as {
      keyboard?: { lock?: (keys?: string[]) => Promise<void> };
    };
    if (nav.keyboard && typeof nav.keyboard.lock === 'function') {
      nav.keyboard.lock(['Escape', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD']).catch(() => {});
    }
  } catch {
    // Ignore synchronous fullscreen restrictions
  }
}

/**
 * Safely requests Pointer Lock (and Fullscreen) on the game canvas, respecting
 * the browser's security cooldown after a user-initiated Escape exit and catching
 * any rejected Promises so no unhandled SecurityError is ever thrown.
 */
export function requestPointerLockSafe(target?: HTMLElement | null): void {
  if (typeof document === 'undefined') return;
  requestFullscreenSafe();

  const el =
    target ??
    (document.querySelector(
      '[data-testid="game-canvas-container"] canvas'
    ) as HTMLElement | null);
  if (!el || document.pointerLockElement === el) return;

  // Browsers enforce a ~1.25s security cooldown after the user exits lock with Escape
  if (performance.now() - lastUserUnlockTimestamp < 1350) {
    return;
  }

  try {
    const maybePromise = el.requestPointerLock?.() as unknown as
      | Promise<void>
      | undefined;
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {
        // Ignore SecurityError when user exits lock before request completes
      });
    }
  } catch {
    // Ignore synchronous DOMException
  }
}

export class InputManager {
  public keysHeld: Set<string> = new Set();
  public keysJustPressed: Set<string> = new Set();
  public mouseButtonsHeld: Set<number> = new Set();
  public mouseButtonsJustPressed: Set<number> = new Set();
  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  public wheelDelta = 0;
  public isPointerLocked = false;
  public onUserExitedPointerLock: (() => void) | null = null;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundPointerLockChange: () => void;
  private boundPointerLockError: () => void;
  private boundBlur: () => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundPointerLockChange = this.onPointerLockChange.bind(this);
    this.boundPointerLockError = this.onPointerLockError.bind(this);
    this.boundBlur = this.clearAll.bind(this);
  }

  public attach(): void {
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('mousedown', this.boundMouseDown);
    window.addEventListener('mouseup', this.boundMouseUp);
    window.addEventListener('mousemove', this.boundMouseMove);
    window.addEventListener('wheel', this.boundWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.boundPointerLockChange);
    document.addEventListener('pointerlockerror', this.boundPointerLockError);
    window.addEventListener('blur', this.boundBlur);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('mousedown', this.boundMouseDown);
    window.removeEventListener('mouseup', this.boundMouseUp);
    window.removeEventListener('mousemove', this.boundMouseMove);
    window.removeEventListener('wheel', this.boundWheel);
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange);
    document.removeEventListener('pointerlockerror', this.boundPointerLockError);
    window.removeEventListener('blur', this.boundBlur);
  }

  public clearAll(): void {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.mouseButtonsHeld.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
  }

  public endFrame(): void {
    this.keysJustPressed.clear();
    this.mouseButtonsJustPressed.clear();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
  }

  public consumeKey(code: string): boolean {
    if (this.keysJustPressed.has(code)) {
      this.keysJustPressed.delete(code);
      return true;
    }
    return false;
  }

  public consumeMouseButton(button: number): boolean {
    if (this.mouseButtonsJustPressed.has(button)) {
      this.mouseButtonsJustPressed.delete(button);
      return true;
    }
    return false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Tab') {
      e.preventDefault();
    }
    if (!this.keysHeld.has(e.code)) {
      this.keysJustPressed.add(e.code);
    }
    this.keysHeld.add(e.code);
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.code);
  }

  private onMouseDown(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, [data-ui-interactive="true"]')) {
      return;
    }
    if (!this.mouseButtonsHeld.has(e.button)) {
      this.mouseButtonsJustPressed.add(e.button);
    }
    this.mouseButtonsHeld.add(e.button);
  }

  private onMouseUp(e: MouseEvent): void {
    this.mouseButtonsHeld.delete(e.button);
  }

  private onMouseMove(e: MouseEvent): void {
    if (document.pointerLockElement) {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    }
  }

  private onWheel(e: WheelEvent): void {
    this.wheelDelta += Math.sign(e.deltaY);
  }

  private onPointerLockChange(): void {
    const wasLocked = this.isPointerLocked;
    this.isPointerLocked = Boolean(document.pointerLockElement);
    if (wasLocked && !this.isPointerLocked) {
      if (programmaticUnlock) {
        programmaticUnlock = false;
      } else {
        lastUserUnlockTimestamp = performance.now();
        this.onUserExitedPointerLock?.();
      }
    }
  }

  private onPointerLockError(): void {
    this.isPointerLocked = Boolean(document.pointerLockElement);
  }
}
