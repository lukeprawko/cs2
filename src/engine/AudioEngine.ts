import { useSettingsStore } from '../store/useSettingsStore';
import { WEAPONS_DB, WeaponId } from '../game/WeaponsDB';

/**
 * Pure Web Audio API Procedural Sound Synthesizer with 3D spatial PannerNode,
 * master DynamicsCompressorNode, soft-clipping WaveShaper saturation,
 * multi-layered weapon acoustics, 3-stage mechanical reload sequences,
 * and dual-layer tactical footsteps.
 * Zero external audio files required.
 */
class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private saturationCurve: Float32Array<ArrayBuffer> | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -14;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createWhiteNoiseBuffer(this.ctx, 2.0);
      this.saturationCurve = this.createSoftClipCurve(2.6);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.masterGain && this.ctx) {
      const { volume, muted } = useSettingsStore.getState();
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : Math.max(0, Math.min(1, volume)),
        this.ctx.currentTime,
        0.015
      );
    }
    return this.ctx;
  }

  private getOutputBus(): AudioNode | null {
    return this.compressor || this.masterGain;
  }

  private createWhiteNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createSoftClipCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 1024;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = Math.tanh(x * amount);
    }
    return curve;
  }

  public setVolume(vol: number, mutedOverride?: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const isMuted =
      mutedOverride !== undefined
        ? mutedOverride
        : useSettingsStore.getState().muted;
    this.masterGain.gain.setTargetAtTime(
      isMuted ? 0 : Math.max(0, Math.min(1, vol)),
      this.ctx.currentTime,
      0.015
    );
  }

  public updateListener(
    posX: number,
    posY: number,
    posZ: number,
    fwdX: number,
    fwdY: number,
    fwdZ: number
  ): void {
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    const t = this.ctx.currentTime;
    try {
      if (listener.positionX) {
        listener.positionX.setValueAtTime(posX, t);
        listener.positionY.setValueAtTime(posY, t);
        listener.positionZ.setValueAtTime(posZ, t);
        listener.forwardX.setValueAtTime(fwdX, t);
        listener.forwardY.setValueAtTime(fwdY, t);
        listener.forwardZ.setValueAtTime(fwdZ, t);
        listener.upX.setValueAtTime(0, t);
        listener.upY.setValueAtTime(1, t);
        listener.upZ.setValueAtTime(0, t);
      } else {
        listener.setPosition(posX, posY, posZ);
        listener.setOrientation(fwdX, fwdY, fwdZ, 0, 1, 0);
      }
    } catch {
      // Ignore WebAudio listener orientation edge cases
    }
  }

  private createPanner(pos?: [number, number, number], maxDist = 75): AudioNode {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus) {
      throw new Error('AudioContext unavailable');
    }
    if (!pos) return bus;

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 3.5;
    panner.maxDistance = maxDist;
    panner.rolloffFactor = 1.15;
    panner.positionX.value = pos[0];
    panner.positionY.value = pos[1];
    panner.positionZ.value = pos[2];
    panner.connect(bus);
    return panner;
  }

  /**
   * Dedicated realistic combat knife audio synthesis:
   * - Light slash: crisp aerodynamic blade whoosh + high steel harmonic shimmer
   * - Heavy thrust: deeper, aggressive air displacement + steel ring
   * - Flesh hit: visceral low-end impact thud + sharp blade cut transient
   * - Wall hit: metallic spark clink against concrete/steel
   */
  public playKnifeAttack(
    isHeavy: boolean,
    hitType: 'none' | 'flesh' | 'wall' = 'none',
    worldPos?: [number, number, number]
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const dest = this.createPanner(worldPos, 35);
    const t = ctx.currentTime;
    const pitchJitter = 0.95 + Math.random() * 0.1;

    // 1. Aerodynamic blade whoosh (filtered noise sweep)
    const whooshNoise = ctx.createBufferSource();
    whooshNoise.buffer = this.noiseBuffer;

    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'bandpass';
    const startFreq = (isHeavy ? 1450 : 2100) * pitchJitter;
    const endFreq = (isHeavy ? 340 : 520) * pitchJitter;
    const dur = isHeavy ? 0.22 : 0.14;
    whooshFilter.frequency.setValueAtTime(startFreq, t);
    whooshFilter.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    whooshFilter.Q.value = isHeavy ? 1.8 : 2.4;

    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.001, t);
    whooshGain.gain.linearRampToValueAtTime(isHeavy ? 0.42 : 0.3, t + 0.018);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    whooshNoise.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    whooshGain.connect(dest);
    whooshNoise.start(t);
    whooshNoise.stop(t + dur + 0.02);

    // 2. Subtle steel blade harmonic shimmer
    const steelOsc = ctx.createOscillator();
    steelOsc.type = 'sine';
    steelOsc.frequency.setValueAtTime((isHeavy ? 2650 : 3200) * pitchJitter, t);
    steelOsc.frequency.exponentialRampToValueAtTime(1400, t + 0.09);

    const steelGain = ctx.createGain();
    steelGain.gain.setValueAtTime(0.055, t);
    steelGain.gain.exponentialRampToValueAtTime(0.0008, t + 0.095);

    steelOsc.connect(steelGain);
    steelGain.connect(dest);
    steelOsc.start(t);
    steelOsc.stop(t + 0.1);

    // 3. Impact acoustics (flesh vs wall/surface)
    if (hitType === 'flesh') {
      const thudOsc = ctx.createOscillator();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(isHeavy ? 155 : 135, t + 0.02);
      thudOsc.frequency.exponentialRampToValueAtTime(36, t + 0.15);

      const thudGain = ctx.createGain();
      thudGain.gain.setValueAtTime(isHeavy ? 0.62 : 0.46, t + 0.02);
      thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      thudOsc.connect(thudGain);
      thudGain.connect(dest);
      thudOsc.start(t + 0.02);
      thudOsc.stop(t + 0.17);

      const sliceNoise = ctx.createBufferSource();
      sliceNoise.buffer = this.noiseBuffer;
      const sliceFilter = ctx.createBiquadFilter();
      sliceFilter.type = 'bandpass';
      sliceFilter.frequency.setValueAtTime(1250, t + 0.02);
      sliceFilter.Q.value = 1.6;

      const sliceGain = ctx.createGain();
      sliceGain.gain.setValueAtTime(0.38, t + 0.02);
      sliceGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      sliceNoise.connect(sliceFilter);
      sliceFilter.connect(sliceGain);
      sliceGain.connect(dest);
      sliceNoise.start(t + 0.02);
      sliceNoise.stop(t + 0.13);
    } else if (hitType === 'wall') {
      const sparkOsc = ctx.createOscillator();
      sparkOsc.type = 'triangle';
      sparkOsc.frequency.setValueAtTime(3450 * pitchJitter, t + 0.02);
      sparkOsc.frequency.exponentialRampToValueAtTime(1180, t + 0.085);

      const sparkGain = ctx.createGain();
      sparkGain.gain.setValueAtTime(0.26, t + 0.02);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      sparkOsc.connect(sparkGain);
      sparkGain.connect(dest);
      sparkOsc.start(t + 0.02);
      sparkOsc.stop(t + 0.095);
    }
  }

  /**
   * Multi-layered realistic firearm synthesis:
   * 1. High-energy gunpowder muzzle blast with mid-range presence EQ & soft-clipping saturation
   * 2. Deep chest-thumping chamber pressure transient (50–190 Hz)
   * 3. Crisp metallic bolt-carrier / slide cycling transient (filtered noise + resonant steel body)
   * 4. Multi-stage outdoor courtyard acoustic reflection tail
   */
  public playGunshot(weaponId: WeaponId, worldPos?: [number, number, number]): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    if (weaponId === 'knife') {
      this.playKnifeAttack(false, 'none', worldPos);
      return;
    }

    const dest = this.createPanner(worldPos, 95);
    const t = ctx.currentTime;

    const isSuppressed = weaponId === 'usp' || weaponId === 'm4a1s';
    const isHeavySniper = weaponId === 'awp' || weaponId === 'ssg08';
    const isScopedRifle = weaponId === 'aug' || weaponId === 'ssg08';
    const isHeavyPistol = weaponId === 'deagle' || weaponId === 'p250';
    const isShotgun = weaponId === 'nova';
    const isAk = weaponId === 'ak47' || weaponId === 'galil';
    const isRifle =
      isAk ||
      weaponId === 'm4a1s' ||
      weaponId === 'famas' ||
      weaponId === 'aug';

    const pitchJitter = 0.96 + Math.random() * 0.08;

    // 1. GUNPOWDER MUZZLE BLAST & SUPERSONIC CRACK (highpass + peaking presence + lowpass sweep)
    const blastNoise = ctx.createBufferSource();
    blastNoise.buffer = this.noiseBuffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(isSuppressed ? 420 : isHeavySniper ? 75 : 115, t);

    const presenceFilter = ctx.createBiquadFilter();
    presenceFilter.type = 'peaking';
    presenceFilter.frequency.setValueAtTime(
      (isAk ? 1650 : isHeavySniper ? 1350 : isSuppressed ? 2300 : 1950) * pitchJitter,
      t
    );
    presenceFilter.Q.value = 1.4;
    presenceFilter.gain.value = isSuppressed ? 4 : 8;

    const blastFilter = ctx.createBiquadFilter();
    blastFilter.type = 'lowpass';
    const startCutoff = isSuppressed
      ? 2450
      : isHeavySniper
      ? 5600
      : isAk || isHeavyPistol
      ? 4600
      : isRifle
      ? 4200
      : 3600;
    blastFilter.frequency.setValueAtTime(startCutoff * pitchJitter, t);
    blastFilter.frequency.exponentialRampToValueAtTime(
      isSuppressed ? 580 : 220,
      t + (isHeavySniper ? 0.36 : isShotgun ? 0.28 : isAk ? 0.2 : 0.16)
    );
    blastFilter.Q.value = isSuppressed ? 1.8 : 0.9;

    const shaper = ctx.createWaveShaper();
    if (this.saturationCurve) {
      shaper.curve = this.saturationCurve;
    }

    const blastGain = ctx.createGain();
    const peakGain = isSuppressed
      ? 0.28
      : isHeavySniper
      ? 0.92
      : isHeavyPistol || isShotgun
      ? 0.78
      : isAk
      ? 0.72
      : isRifle
      ? 0.62
      : 0.48;
    const blastDur = isSuppressed
      ? 0.085
      : isHeavySniper
      ? 0.38
      : isShotgun
      ? 0.28
      : isAk
      ? 0.21
      : 0.165;

    blastGain.gain.setValueAtTime(0.001, t);
    blastGain.gain.linearRampToValueAtTime(peakGain, t + 0.0015);
    blastGain.gain.exponentialRampToValueAtTime(0.001, t + blastDur);

    blastNoise.connect(highpass);
    highpass.connect(presenceFilter);
    presenceFilter.connect(blastFilter);
    blastFilter.connect(shaper);
    shaper.connect(blastGain);
    blastGain.connect(dest);
    blastNoise.start(t);
    blastNoise.stop(t + blastDur + 0.02);

    // 2. DEEP CHAMBER PRESSURE PUNCH (gives heavy physical chest thump to shots)
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'triangle';
    const startFreq =
      (isHeavySniper
        ? 135
        : isShotgun || weaponId === 'deagle'
        ? 155
        : isAk
        ? 168
        : isRifle
        ? 185
        : isSuppressed
        ? 220
        : 200) * pitchJitter;
    bodyOsc.frequency.setValueAtTime(startFreq, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(
      34,
      t + (isHeavySniper ? 0.24 : isAk ? 0.14 : 0.11)
    );

    const bodyGain = ctx.createGain();
    const bodyPeak = isSuppressed
      ? 0.26
      : isHeavySniper
      ? 0.85
      : isAk || weaponId === 'deagle'
      ? 0.64
      : 0.52;
    const bodyDur = isHeavySniper ? 0.26 : isAk ? 0.15 : 0.12;
    bodyGain.gain.setValueAtTime(bodyPeak, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + bodyDur);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(dest);
    bodyOsc.start(t);
    bodyOsc.stop(t + bodyDur + 0.01);

    // 3. METALLIC BOLT CARRIER / SLIDE SNAP (crisp filtered mechanical transient)
    const mechNoise = ctx.createBufferSource();
    mechNoise.buffer = this.noiseBuffer;

    const mechFilter = ctx.createBiquadFilter();
    mechFilter.type = 'bandpass';
    mechFilter.frequency.setValueAtTime((isSuppressed ? 3100 : 2650) * pitchJitter, t + 0.016);
    mechFilter.Q.value = 3.2;

    const mechGain = ctx.createGain();
    mechGain.gain.setValueAtTime(0.0001, t);
    mechGain.gain.setValueAtTime(isSuppressed ? 0.22 : 0.16, t + 0.016);
    mechGain.gain.exponentialRampToValueAtTime(0.001, t + 0.052);

    mechNoise.connect(mechFilter);
    mechFilter.connect(mechGain);
    mechGain.connect(dest);
    mechNoise.start(t + 0.015);
    mechNoise.stop(t + 0.056);

    // 4. URBAN COURTYARD ACOUSTIC REFLECTION TAIL (distant slapback echo for unsuppressed weapons)
    if (!isSuppressed) {
      const tailNoise = ctx.createBufferSource();
      tailNoise.buffer = this.noiseBuffer;

      const tailFilter = ctx.createBiquadFilter();
      tailFilter.type = 'bandpass';
      tailFilter.frequency.setValueAtTime(isHeavySniper ? 580 : 720, t + 0.028);
      tailFilter.frequency.exponentialRampToValueAtTime(220, t + (isHeavySniper ? 0.62 : 0.38));
      tailFilter.Q.value = 0.75;

      const tailGain = ctx.createGain();
      const tailPeak = isHeavySniper ? 0.26 : isShotgun || isHeavyPistol || isAk ? 0.18 : 0.13;
      const tailDur = isHeavySniper ? 0.64 : 0.38;
      tailGain.gain.setValueAtTime(0.001, t);
      tailGain.gain.linearRampToValueAtTime(tailPeak, t + 0.042);
      tailGain.gain.exponentialRampToValueAtTime(0.0008, t + tailDur);

      tailNoise.connect(tailFilter);
      tailFilter.connect(tailGain);
      tailGain.connect(dest);
      tailNoise.start(t + 0.025);
      tailNoise.stop(t + tailDur + 0.02);
    }

    // 5. BRASS SHELL CASING TINK ON FLOOR (local player first-person detail)
    if (!worldPos) {
      const shellDelay = isHeavySniper || isScopedRifle ? 0.42 : 0.22 + Math.random() * 0.05;
      const shellOsc = ctx.createOscillator();
      shellOsc.type = 'sine';
      shellOsc.frequency.setValueAtTime(3850 + Math.random() * 450, t + shellDelay);
      shellOsc.frequency.exponentialRampToValueAtTime(2900, t + shellDelay + 0.045);

      const shellGain = ctx.createGain();
      shellGain.gain.setValueAtTime(0.0001, t);
      shellGain.gain.setValueAtTime(0.045, t + shellDelay);
      shellGain.gain.exponentialRampToValueAtTime(0.0008, t + shellDelay + 0.05);

      shellOsc.connect(shellGain);
      shellGain.connect(dest);
      shellOsc.start(t + shellDelay);
      shellOsc.stop(t + shellDelay + 0.055);
    }
  }

  /**
   * Plays a realistic 3-stage mechanical reload sequence synchronized to the weapon's reloadTime:
   * 1. Magazine catch release & hollow mag slide-out
   * 2. Fresh magazine insertion slap & lock click
   * 3. Charging handle / slide rack pull & snap forward
   */
  public playReload(weaponId: WeaponId = 'ak47'): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus || !this.noiseBuffer) return;

    const spec = WEAPONS_DB[weaponId];
    const reloadDur = spec && spec.reloadTime > 0 ? spec.reloadTime : 2.2;
    const t = ctx.currentTime;

    // Helper for crisp mechanical click + filtered scrape
    const scheduleMechSound = (
      offsetSec: number,
      freqStart: number,
      freqEnd: number,
      dur: number,
      vol: number,
      noiseCutoff = 1800
    ) => {
      const start = t + offsetSec;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqStart, start);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);

      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);

      osc.connect(g);
      g.connect(bus);
      osc.start(start);
      osc.stop(start + dur + 0.01);

      if (this.noiseBuffer) {
        const n = ctx.createBufferSource();
        n.buffer = this.noiseBuffer;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = noiseCutoff;
        f.Q.value = 2.8;

        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.7, start);
        ng.gain.exponentialRampToValueAtTime(0.001, start + dur * 0.9);

        n.connect(f);
        f.connect(ng);
        ng.connect(bus);
        n.start(start);
        n.stop(start + dur);
      }
    };

    // Stage 1 (16% into reload): Mag release button click + magazine slide out
    scheduleMechSound(reloadDur * 0.14, 680, 260, 0.11, 0.22, 1450);

    // Stage 2 (54% into reload): Heavy magazine slap in + metallic catch lock
    scheduleMechSound(reloadDur * 0.52, 165, 95, 0.08, 0.34, 900);
    scheduleMechSound(reloadDur * 0.55, 1650, 2150, 0.055, 0.24, 2600);

    // Stage 3 (78% into reload): Bolt carrier / slide pull back & spring snap forward
    scheduleMechSound(reloadDur * 0.76, 1250, 1850, 0.065, 0.24, 2900);
    scheduleMechSound(reloadDur * 0.83, 2400, 1100, 0.075, 0.28, 3400);
  }

  /**
   * Subtle weapon draw / equip cloth rustle + safety click.
   */
  public playWeaponDeploy(isKnife = false): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus || !this.noiseBuffer) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = isKnife ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isKnife ? 1900 : 820, t);
    osc.frequency.exponentialRampToValueAtTime(isKnife ? 3200 : 1450, t + 0.065);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + 0.075);
  }

  /**
   * Dual-layer tactical footstep:
   * - Low boot heel thump (105Hz -> 42Hz)
   * - Dry sandstone grit crunch (bandpass 1350Hz)
   */
  public playFootstep(worldPos?: [number, number, number], volumeScale = 1.0): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const dest = this.createPanner(worldPos, 28);
    const t = ctx.currentTime;
    const pitchVar = 0.92 + Math.random() * 0.16;

    // 1. Heel impact thump
    const heelOsc = ctx.createOscillator();
    heelOsc.type = 'sine';
    heelOsc.frequency.setValueAtTime(105 * pitchVar, t);
    heelOsc.frequency.exponentialRampToValueAtTime(42, t + 0.065);

    const heelGain = ctx.createGain();
    heelGain.gain.setValueAtTime(0.18 * volumeScale, t);
    heelGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    heelOsc.connect(heelGain);
    heelGain.connect(dest);
    heelOsc.start(t);
    heelOsc.stop(t + 0.075);

    // 2. Sandstone grit scuff
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1350 * pitchVar;
    filter.Q.value = 2.4;

    const gritGain = ctx.createGain();
    gritGain.gain.setValueAtTime(0.14 * volumeScale, t + 0.005);
    gritGain.gain.exponentialRampToValueAtTime(0.001, t + 0.068);

    noise.connect(filter);
    filter.connect(gritGain);
    gritGain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.075);
  }

  public playHitMarker(isHeadshot: boolean): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus) return;

    const t = ctx.currentTime;

    if (isHeadshot) {
      // Crisp dual-harmonic metallic helmet "dink"
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(2380, t);
      osc1.frequency.exponentialRampToValueAtTime(1720, t + 0.11);
      osc2.frequency.setValueAtTime(3560, t);
      osc2.frequency.exponentialRampToValueAtTime(2890, t + 0.09);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.32, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.115);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(bus);
      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.12);
      osc2.stop(t + 0.12);
    } else {
      // Tactile body hit confirmation tick
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.055);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

      osc.connect(gain);
      gain.connect(bus);
      osc.start(t);
      osc.stop(t + 0.065);
    }
  }

  public playBombBeep(worldPos?: [number, number, number], urgent = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const dest = this.createPanner(worldPos, 65);
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 2680 : 2120, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(urgent ? 0.28 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  public playPlantOrDefuseTone(
    isDefuse: boolean,
    worldPos?: [number, number, number]
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const dest = this.createPanner(worldPos, 45);
    const t = ctx.currentTime;
    const notes = isDefuse ? [980, 1320, 1760] : [1480, 1180, 880];

    notes.forEach((freq, idx) => {
      const start = t + idx * 0.075;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.07);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(start);
      osc.stop(start + 0.075);
    });
  }

  public playRoundEndSting(playerWon: boolean): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus) return;

    const t = ctx.currentTime;
    const chord = playerWon ? [220, 277.18, 329.63, 440] : [196, 233.08, 293.66];

    chord.forEach((freq, idx) => {
      const start = t + idx * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.65);

      osc.connect(gain);
      gain.connect(bus);
      osc.start(start);
      osc.stop(start + 0.7);
    });
  }

  public playExplosion(worldPos?: [number, number, number], isC4 = false): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const dest = this.createPanner(worldPos, 120);
    const t = ctx.currentTime;
    const dur = isC4 ? 1.9 : 0.95;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isC4 ? 1100 : 1400, t);
    filter.frequency.exponentialRampToValueAtTime(55, t + dur);

    const shaper = ctx.createWaveShaper();
    if (this.saturationCurve) {
      shaper.curve = this.saturationCurve;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isC4 ? 0.92 : 0.68, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(shaper);
    shaper.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + dur + 0.05);

    // Sub-bass shockwave
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(isC4 ? 95 : 120, t);
    subOsc.frequency.exponentialRampToValueAtTime(28, t + dur * 0.65);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(isC4 ? 0.75 : 0.55, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.68);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(t);
    subOsc.stop(t + dur * 0.7);
  }

  public playFlashbangRing(intensity: number): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus || intensity <= 0.05) return;

    const t = ctx.currentTime;
    const dur = Math.min(3.5, 1.5 + intensity * 2.0);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3950, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16 * intensity, t);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + dur);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + dur);
  }

  public playSmokePop(worldPos?: [number, number, number]): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const dest = this.createPanner(worldPos, 45);
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, t);
    filter.Q.value = 1.1;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(t);
    noise.stop(t + 0.9);
  }

  public playUIClick(accent = false): void {
    const ctx = this.ensureContext();
    const bus = this.getOutputBus();
    if (!ctx || !bus) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 880 : 540, t);
    osc.frequency.exponentialRampToValueAtTime(accent ? 1320 : 380, t + 0.045);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + 0.055);
  }
}

export const audioEngine = new ProceduralAudioEngine();
