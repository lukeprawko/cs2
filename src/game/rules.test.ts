import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHitDamage,
  clampMoney,
  ECONOMY_CONSTANTS,
  executeBotAutoBuy,
  getLossBonus,
} from './Economy';
import {
  BOMB_CONSTANTS,
  createInitialBombData,
  getBombBeepInterval,
  getBombExplosionDamage,
} from './BombLogic';
import { getStartingPistol, WEAPONS_DB } from './WeaponsDB';
import { PhysicsWorld } from '../engine/Physics';
import { NavGraph } from '../engine/NavGraph';

test('Economy: money clamping and loss bonus progression', () => {
  assert.equal(clampMoney(-200), 0);
  assert.equal(clampMoney(800), 800);
  assert.equal(clampMoney(22000), ECONOMY_CONSTANTS.MAX_MONEY);

  assert.equal(getLossBonus(1), 1400);
  assert.equal(getLossBonus(2), 1900);
  assert.equal(getLossBonus(5), 3400);
  assert.equal(getLossBonus(8), 3400);
});

test('Damage calculation: headshot multiplier, armor reduction, and AWP one-shot', () => {
  const unarmoredHead = calculateHitDamage('ak47', 'head', 10, 0, false);
  assert.equal(unarmoredHead.isHeadshot, true);
  assert.ok(unarmoredHead.healthDamage >= 130);

  const armoredChest = calculateHitDamage('m4a1s', 'chest', 10, 100, true);
  assert.equal(armoredChest.isHeadshot, false);
  assert.ok(armoredChest.healthDamage < WEAPONS_DB.m4a1s.damage);
  assert.ok(armoredChest.armorDamage > 0);

  const awpChestArmored = calculateHitDamage('awp', 'chest', 25, 100, true);
  assert.ok(awpChestArmored.healthDamage >= 100);
});

test('Bot auto-buy: full buy vs eco round', () => {
  const fullBuy = executeBotAutoBuy(
    {
      money: 5500,
      team: 'CT',
      primary: null,
      secondary: getStartingPistol('CT'),
      grenades: [],
      armor: 0,
      hasHelmet: false,
      hasDefuseKit: false,
    },
    false
  );
  assert.equal(fullBuy.primary, 'm4a1s');
  assert.equal(fullBuy.hasHelmet, true);
  assert.equal(fullBuy.hasDefuseKit, true);
  assert.ok(fullBuy.grenades.length > 0);

  const pistolRound = executeBotAutoBuy(
    {
      money: 800,
      team: 'T',
      primary: null,
      secondary: getStartingPistol('T'),
      grenades: [],
      armor: 0,
      hasHelmet: false,
      hasDefuseKit: false,
    },
    false
  );
  assert.equal(pistolRound.armor, 100);
  assert.equal(pistolRound.money, 150);
});

test('Bomb logic: beep interval acceleration and explosion falloff', () => {
  const b = createInitialBombData('bot_t_1', [0, 0, 36]);
  assert.equal(b.state, 'carried');
  assert.equal(b.timeRemaining, BOMB_CONSTANTS.BOMB_TIMER);

  assert.ok(getBombBeepInterval(35) > getBombBeepInterval(8));
  assert.ok(getBombBeepInterval(8) > getBombBeepInterval(1.5));

  assert.ok(getBombExplosionDamage(2) > 400);
  assert.equal(getBombExplosionDamage(BOMB_CONSTANTS.EXPLOSION_RADIUS + 5), 0);
});

test('Physics & Navigation: raycast and A* pathfinding on Dust Alley', () => {
  const physics = new PhysicsWorld();
  const hits = physics.raycastWorld(3.5, 1.5, 20.2, 0, 0, -1, 100);
  assert.ok(hits.length > 0);

  const nav = new NavGraph();
  const path = nav.findPath(4.5, 26.2, 17.3, -13.9);
  assert.ok(path.length >= 2);
});

test('Arsenal & Spam-fire: CS weapons (AK-47, Galil, FAMAS, SSG-08, P250) and spam spread', () => {
  assert.equal(WEAPONS_DB.ak47.automatic, true);
  assert.equal(WEAPONS_DB.galil.team, 'T');
  assert.equal(WEAPONS_DB.famas.team, 'CT');
  assert.deepEqual(WEAPONS_DB.ssg08.zoomLevels, [30, 12]);
  assert.equal(WEAPONS_DB.p250.canSpamHold, true);
  assert.equal(WEAPONS_DB.glock.canSpamHold, true);
  assert.equal(WEAPONS_DB.usp.canSpamHold, true);
  assert.equal(WEAPONS_DB.deagle.canSpamHold, true);
  assert.ok(WEAPONS_DB.deagle.spamSpreadPerShot > WEAPONS_DB.glock.spamSpreadPerShot);
});

