//src/scenes/GameScene.ts
import { Player } from "../entities/player.js";
import { Enemy, EnemyType } from "../entities/enemy.js";
import { Bullet } from "../entities/bullet.js";
import { Boss, BOSS_INFO, getBossTypeForEncounter } from "../entities/Boss.js";
import {
  COLORS,
  FONT_BODY,
  FONT_LABEL,
  FONT_SMALL,
  FONT_VALUE,
  drawPixelMeter,
  drawPixelPanel,
  drawPixelScanlines,
  drawPixelShipIcon,
  drawPixelText,
  formatScore,
  loadHiScore,
  saveHiScore,
} from "../ui/ArcadeUI.js";
import { AudioManager } from "../systems/AudioManager.js";
import { CollisionSystem } from "../systems/CollisionSystem.js";
import { HandTrackingService } from "../systems/HandTrackingService.js";
import rickrollMp3Url from "../assets/8bit-rickroll.mp3";

export type GameResult = "menu";

interface Explosion {
  x: number;
  y: number;
  particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[];
  life: number;
}

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
}

type DomainType = "infiniteVoid" | "mirror" | "catastrophe";

interface VoidSymbol {
  x: number;
  y: number;
  char: string;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
}

const DOMAIN_INFO: Record<DomainType, { name: string; subtitle: string; unlockScore: number }> = {
  infiniteVoid: { name: "INFINITE VOID", subtitle: "EVERYTHING SLOWS", unlockScore: 0 },
  mirror: { name: "MIRROR DOMAIN", subtitle: "ENEMY BULLETS BECOME YOURS", unlockScore: 800 },
  catastrophe: { name: "CATASTROPHE DOMAIN", subtitle: "ALL BULLETS RICOCHET", unlockScore: 1600 },
};

const VOID_GLYPHS = ["呪", "縛", "封", "禁", "滅", "虚", "無", "域"];
const DOMAIN_ORDER: DomainType[] = ["infiniteVoid", "mirror", "catastrophe"];

const WAVE_LAYOUTS: EnemyType[][] = [
  [
    "grunt","grunt","grunt","grunt","grunt","grunt","grunt","grunt",
    "grunt","grunt","grunt","grunt","grunt","grunt","grunt","grunt",
  ],
  [
    "commander","commander","commander","commander",
    "grunt","grunt","grunt","grunt","grunt","grunt","grunt","grunt",
    "commander","commander","commander","commander",
  ],
];

const MAX_LEAK_MINIONS = 18;
const BOSS_KILL_SCORE = 2500;

export class GameScene {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onEnd: (result: GameResult) => void;

  private player!: Player;
  private audio = AudioManager.getInstance();
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private bossEncounterIndex: number = 0;
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private stars: { x: number; y: number; size: number; speed: number }[] = [];

  private score: number = 0;
  private hiScore: number = 0;
  private lives: number = 3;
  private wave: number = 0;
  private frame: number = 0;
  private curseEnergy: number = 0;
  private domainReady: boolean = false;
  private domainActive: boolean = false;
  private activeDomainType: DomainType | null = null;
  private domainTimer: number = 0;
  private domainCastIndex: number = 0;
  private voidSymbols: VoidSymbol[] = [];
  private readonly DOMAIN_DURATION = 600;
  private readonly DOMAIN_METER_PER_KILL = 14;
  private tempoShiftClaimed: boolean = false;
  private dimensionGlitchTimer: number = 0;
  private reversedTechniqueClaimed: boolean = false;
  private reversedTechniqueActive: boolean = false;
  private reversedTechniqueTimer: number = 0;
  private readonly REVERSED_TECHNIQUE_DURATION = 600;
  private state: "playing" | "rickrollCurse" | "victory" = "playing";
  private stateTimer: number = 0;
  private curseAudio: HTMLAudioElement | null = null;
  private curseAudioClip: HTMLAudioElement | null = null;
  private curseAudioLoadFailed: boolean = false;
  private curseAudioCtx: AudioContext | null = null;
  private curseSynthTimers: number[] = [];
  private readonly CURSE_SKIP_DELAY = 300;
  private enemyShootTimer: number = 0;
  private readonly ENEMY_SHOOT_INTERVAL = 90;
  private diveTimer: number = 0;
  private readonly DIVE_INTERVAL = 180;

  private input: InputState = { left: false, right: false, up: false, down: false, fire: false };
  private boundKeydown: (e: KeyboardEvent) => void;
  private boundKeyup: (e: KeyboardEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    onEnd: (result: GameResult) => void
  ) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onEnd = onEnd;

    this.boundKeydown = (e: KeyboardEvent) => this.handleKeydown(e);
    this.boundKeyup = (e: KeyboardEvent) => this.handleKeyup(e);
    window.addEventListener("keydown", this.boundKeydown);
    window.addEventListener("keyup", this.boundKeyup);

    this.hiScore = loadHiScore();

    this.initCurseAudioClip();
    this.initStars();
    this.spawnPlayer();
    this.spawnWave(this.wave);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundKeydown);
    window.removeEventListener("keyup", this.boundKeyup);
    this.stopCurseAudio();
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.state === "rickrollCurse") {
      if (e.code === "Space" || e.code === "Enter" || e.code === "Escape") {
        e.preventDefault();
        this.audio.playUiClick();
        this.trySkipCurse();
      }
      return;
    }

    if (e.code === "ArrowLeft" || e.code === "KeyA") this.input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.input.right = true;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.input.up = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.input.down = true;
    if (e.code === "Space") { e.preventDefault(); this.input.fire = true; }
    if (e.code === "KeyE") {
      e.preventDefault();
      if (this.domainReady && !this.domainActive) this.audio.playUiClick();
      this.castDomainExpansion();
    }
  }

  private handleKeyup(e: KeyboardEvent): void {
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.input.right = false;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.input.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") this.input.down = false;
    if (e.code === "Space") this.input.fire = false;
  }

  private initStars(): void {
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 1.8 + 0.3,
        speed: Math.random() * 0.8 + 0.2,
      });
    }
  }

  private spawnPlayer(): void {
    this.player = new Player(this.canvas.width / 2, this.canvas.height - 60);
  }

  private isBossWave(waveIndex: number): boolean {
    return (waveIndex + 1) % 3 === 0;
  }

  private spawnWave(waveIndex: number): void {
    this.enemies = [];
    this.boss = null;

    if (this.isBossWave(waveIndex)) {
      const type = getBossTypeForEncounter(this.bossEncounterIndex);
      this.boss = new Boss(
        this.canvas.width / 2,
        this.canvas.height * 0.2,
        type,
        this.bossEncounterIndex
      );
      this.bossEncounterIndex++;
      this.audio.playBossWarning();
      this.dimensionGlitchTimer = Math.max(this.dimensionGlitchTimer, 150);
      return;
    }

    const layout = WAVE_LAYOUTS[waveIndex % WAVE_LAYOUTS.length];
    const cols = 8;
    const spacingX = 60;
    const spacingY = 55;
    const startX = (this.canvas.width - spacingX * (cols - 1)) / 2;
    const startY = 80;

    layout.forEach((type, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      this.enemies.push(new Enemy(x, y, type));
    });
  }

  private spawnExplosion(x: number, y: number, color: string): void {
    const particles = Array.from({ length: 18 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      return {
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
      };
    });
    this.explosions.push({ x, y, particles, life: 1 });
  }

  private playerShoot(): void {
    if (!this.player.alive || !this.player.canShoot()) return;
    const origin = this.player.getBulletOrigin();
    this.bullets.push(new Bullet(origin.x, origin.y, "player"));
    this.player.triggerShootCooldown();
  }

  private enemyShoot(): void {
    const alive = this.enemies.filter(e => e.alive);
    if (alive.length === 0) return;
    const shooter = alive[Math.floor(Math.random() * alive.length)];
    const bullet = new Bullet(shooter.x, shooter.y + 16, "enemy");
    if (this.domainActive && this.activeDomainType === "mirror") {
      bullet.convertToPlayer();
    }
    this.bullets.push(bullet);
  }

  private triggerDive(): void {
    const alive = this.enemies.filter(e => e.alive && !e.diving);
    if (alive.length === 0) return;
    // 1-3 enemies dive
    const count = Math.min(Math.floor(Math.random() * 3) + 1, alive.length);
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      shuffled[i].startDive(this.canvas.width);
    }
  }

  update(): void {
    this.frame++;
    const speedMultiplier = this.getGameSpeedMultiplier();

    if (this.state !== "playing") {
      this.stateTimer++;
      return;
    }

    this.updateThresholdEffects();

    const worldSpeed = speedMultiplier * this.getDomainWorldSpeedMultiplier();
    const playerMoveSpeed = this.getDomainPlayerMoveMultiplier();

    // Scroll stars
    for (const star of this.stars) {
      star.y += star.speed * worldSpeed;
      if (star.y > this.canvas.height) star.y = 0;
    }

    if (this.domainActive) {
      this.domainTimer--;
      this.updateVoidSymbols(worldSpeed);
      if (this.domainTimer <= 0) {
        this.endDomainExpansion();
      }
    }

    if (this.dimensionGlitchTimer > 0) this.dimensionGlitchTimer--;

    if (this.reversedTechniqueActive) {
      this.reversedTechniqueTimer--;
      if (this.reversedTechniqueTimer <= 0) {
        this.reversedTechniqueActive = false;
        this.reversedTechniqueTimer = 0;
        this.player.y = this.canvas.height - 60;
      }
    }

    const cvService = HandTrackingService.getInstance();
    const hand = cvService.getHandState();

    if (hand.isActive) {
      // 1. Translate Normalized Position over Canvas safely
      const computedTargetX = hand.x * this.canvas.width;
      
      // Clamp values cleanly within ship boundaries matching Player movement controls
      this.player.x = Math.max(this.player.width / 2, Math.min(this.canvas.width - this.player.width / 2, computedTargetX));

      // Vertical movement override checks if Reversed Curse Technique is currently running
      if (this.reversedTechniqueActive) {
        const computedTargetY = hand.y * this.canvas.height;
        this.player.y = Math.max(82, Math.min(this.canvas.height - this.player.height / 2, computedTargetY));
      } else {
        // Enforce baseline bound placement if vertical travel is locked
        this.player.y = this.canvas.height - 60;
      }

      // 2. Map Actions & Core Gun Gestures
      if (hand.gesture === "gun") {
        this.input.fire = true;
      } else {
        // Fall back to spatial keyboard mapping if not actively forming a gun shape
        this.input.fire = this.input.fire && !hand.isActive; 
      }

      // 3. Domain Expansion Pose Routing Checks
      if (this.domainReady && !this.domainActive) {
        if (hand.gesture === "crossed") {
          this.castForcedDomainGesture("infiniteVoid");
        } else if (hand.gesture === "victory") {
          this.castForcedDomainGesture("mirror");
        } else if (hand.gesture === "fist") {
          this.castForcedDomainGesture("catastrophe");
        }
      }
    } else {
      // Fallback: Default directly to classic standard Keyboard configurations if hand leaves frame completely
      if (this.input.left) this.player.moveLeft(playerMoveSpeed);
      if (this.input.right) this.player.moveRight(this.canvas.width, playerMoveSpeed);
      if (this.reversedTechniqueActive && this.input.up) this.player.moveUp(82, playerMoveSpeed);
      if (this.reversedTechniqueActive && this.input.down) this.player.moveDown(this.canvas.height, playerMoveSpeed);
    }

    if (this.input.fire) this.playerShoot();
    this.player.update();

    // Enemy updates
    for (const enemy of this.enemies) {
      enemy.update(this.canvas.width, this.canvas.height, worldSpeed);
    }

    // Enemy shooting
    this.enemyShootTimer += worldSpeed;
    if (this.enemyShootTimer >= this.ENEMY_SHOOT_INTERVAL) {
      this.enemyShootTimer = 0;
      this.enemyShoot();
    }

    // Boss update
    this.updateBoss(worldSpeed);

    // Enemy diving (not during dedicated boss waves)
    if (!this.boss) {
      this.diveTimer += worldSpeed;
      if (this.diveTimer >= this.DIVE_INTERVAL) {
        this.diveTimer = 0;
        this.triggerDive();
      }
    }

    // Bullet updates
    const ricochetActive = this.isRicochetDomainActive();
    const enemyBulletSpeed = speedMultiplier * this.getDomainEnemyBulletSpeedMultiplier();
    for (const bullet of this.bullets) {
      const bulletSpeed = bullet.owner === "enemy" ? enemyBulletSpeed : speedMultiplier;
      bullet.update(bulletSpeed, {
        ricochet: ricochetActive,
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
      });
      if (bullet.isOffScreen(this.canvas.width, this.canvas.height, ricochetActive)) {
        bullet.alive = false;
      }
    }

    // Collisions: player bullets vs enemies
    for (const bullet of this.bullets) {
      if (!bullet.alive || bullet.owner !== "player") continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        if (CollisionSystem.overlaps(bullet.getBounds(), enemy.getBound())) {
          bullet.alive = false;
          enemy.alive = false;
          this.score += enemy.config.points;
          this.updateScoreRewards();
          this.audio.playHit("enemy");
          this.spawnExplosion(enemy.x, enemy.y, enemy.config.color);
        }
      }

      if (this.boss?.alive && CollisionSystem.overlaps(bullet.getBounds(), this.boss.getBounds())) {
        bullet.alive = false;
        const killed = this.boss.takeDamage(1);
        this.audio.playHit("enemy");
        this.spawnExplosion(bullet.x, bullet.y, BOSS_INFO[this.boss.type].color);
        if (killed) {
          this.onBossDefeated();
        }
      }
    }

    // Collisions: bullets vs player
    if (this.player.alive) {
      for (const bullet of this.bullets) {
        if (!bullet.alive) continue;
        const hostileBullet = bullet.owner === "enemy" ||
          (this.isRicochetDomainActive() && bullet.owner === "player");
        if (!hostileBullet) continue;
        if (CollisionSystem.overlaps(bullet.getBounds(), this.player.getBounds())) {
          bullet.alive = false;
          this.playerHit();
        }
      }

      // Enemy collides with player (dive-bomb)
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.diving) continue;
        if (CollisionSystem.overlaps(enemy.getBound(), this.player.getBounds())) {
          enemy.alive = false;
          this.spawnExplosion(enemy.x, enemy.y, enemy.config.color);
          this.playerHit();
        }
      }

      if (this.boss?.alive && CollisionSystem.overlaps(this.boss.getBounds(), this.player.getBounds())) {
        this.playerHit();
      }
    }

    // Update explosions
    for (const explosion of this.explosions) {
      explosion.life -= 0.025;
      for (const p of explosion.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.life -= 0.03;
        p.vx *= 0.97;
      }
    }

    // Cleanup dead objects
    this.bullets = this.bullets.filter(b => b.alive);
    this.explosions = this.explosions.filter(e => e.life > 0);

    // Check wave clear
    if (this.isWaveCleared()) {
      this.wave++;
      this.spawnWave(this.wave);
    }
  }

  private isWaveCleared(): boolean {
    if (this.boss) return !this.boss.alive;
    return this.enemies.every(e => !e.alive);
  }

  private updateBoss(speedMultiplier: number): void {
    if (!this.boss?.alive) return;

    this.boss.update(this.canvas.width, this.canvas.height, this.frame, speedMultiplier);
    const spawn = this.boss.consumeSpawnRequest();
    let leakCount = this.enemies.filter(e => e.alive && e.config.type === "leak").length;

    for (const minion of spawn.minions) {
      if (leakCount >= MAX_LEAK_MINIONS) break;
      this.enemies.push(new Enemy(minion.x, minion.y, "leak"));
      leakCount++;
    }

    for (const shot of spawn.bullets) {
      const bullet = Bullet.createDirected(shot.x, shot.y, "enemy", shot.vx, shot.vy);
      if (this.domainActive && this.activeDomainType === "mirror") {
        bullet.convertToPlayer();
      }
      this.bullets.push(bullet);
    }
  }

  private onBossDefeated(): void {
    if (!this.boss) return;

    const { x, y, type } = this.boss;
    const color = BOSS_INFO[type].color;
    for (let i = 0; i < 4; i++) {
      window.setTimeout(() => {
        this.spawnExplosion(
          x + (Math.random() - 0.5) * 60,
          y + (Math.random() - 0.5) * 40,
          color
        );
      }, i * 80);
    }

    this.score += BOSS_KILL_SCORE;
    this.curseEnergy = Math.min(100, this.curseEnergy + 35);
    if (this.curseEnergy >= 100) this.domainReady = true;
    this.audio.playHit("shield");
  }

  private playerHit(): void {
    if (this.reversedTechniqueActive) {
      this.audio.playHit("shield");
      this.spawnExplosion(this.player.x, this.player.y, "#f5fffb");
      return;
    }

    this.spawnExplosion(this.player.x, this.player.y, "#00cfff");
    this.audio.playHit("player");
    this.lives--;
    if (this.lives <= 0) {
      this.player.alive = false;
      saveHiScore(this.score);
      this.startRickrollCurse();
    } else {
      // Respawn at center
      this.player.x = this.canvas.width / 2;
    }
  }

  private updateScoreRewards(): void {
    this.curseEnergy = Math.min(100, this.curseEnergy + this.DOMAIN_METER_PER_KILL);
    if (this.curseEnergy >= 100 && !this.domainActive) {
      this.domainReady = true;
    }
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      saveHiScore(this.score);
    }
  }

  private updateThresholdEffects(): void {
    if (this.score >= 1000 && !this.tempoShiftClaimed) {
      this.tempoShiftClaimed = true;
      this.dimensionGlitchTimer = 150;
    }

    if (this.score >= 1200 && !this.reversedTechniqueClaimed) {
      this.reversedTechniqueClaimed = true;
      this.reversedTechniqueActive = true;
      this.reversedTechniqueTimer = this.REVERSED_TECHNIQUE_DURATION;
      this.dimensionGlitchTimer = Math.max(this.dimensionGlitchTimer, 90);
    }
  }

  private castDomainExpansion(): void {
    if (this.state !== "playing" || !this.domainReady || this.domainActive) return;

    const unlocked = this.getUnlockedDomains();
    if (unlocked.length === 0) return;

    this.activeDomainType = unlocked[this.domainCastIndex % unlocked.length];
    this.domainCastIndex++;

    this.domainReady = false;
    this.domainActive = true;
    this.domainTimer = this.DOMAIN_DURATION;
    this.curseEnergy = 0;
    this.voidSymbols = [];
    this.activateDomainEffects();
    this.audio.playDomainActivation();
  }

  public castForcedDomainGesture(type: DomainType): void {
    if (this.state !== "playing" || !this.domainReady || this.domainActive) return;

    // Enforce original progression boundaries: ensure score requirement is satisfied
    if (this.score < DOMAIN_INFO[type].unlockScore) return;

    this.activeDomainType = type;
    this.domainReady = false;
    this.domainActive = true;
    this.domainTimer = this.DOMAIN_DURATION;

    this.activateDomainEffects();
    this.audio.playDomainActivation();
  }

  private endDomainExpansion(): void {
    this.domainActive = false;
    this.domainTimer = 0;
    this.activeDomainType = null;
    this.voidSymbols = [];
  }

  private getUnlockedDomains(): DomainType[] {
    return DOMAIN_ORDER.filter(type => this.score >= DOMAIN_INFO[type].unlockScore);
  }

  private getNextDomainPreview(): DomainType {
    const unlocked = this.getUnlockedDomains();
    return unlocked[this.domainCastIndex % unlocked.length];
  }

  private activateDomainEffects(): void {
    if (!this.activeDomainType) return;

    if (this.activeDomainType === "mirror") {
      for (const bullet of this.bullets) {
        bullet.convertToPlayer();
      }
    }

    if (this.activeDomainType === "catastrophe") {
      for (const bullet of this.bullets) {
        bullet.randomizeRicochet();
      }
    }

    if (this.activeDomainType === "infiniteVoid") {
      this.initVoidSymbols();
    }
  }

  private initVoidSymbols(): void {
    this.voidSymbols = Array.from({ length: 28 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      char: VOID_GLYPHS[Math.floor(Math.random() * VOID_GLYPHS.length)],
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.03,
    }));
  }

  private updateVoidSymbols(speedMultiplier: number): void {
    for (const symbol of this.voidSymbols) {
      symbol.x += symbol.vx * speedMultiplier;
      symbol.y += symbol.vy * speedMultiplier;
      symbol.rot += symbol.spin * speedMultiplier;
      if (symbol.x < -20) symbol.x = this.canvas.width + 20;
      if (symbol.x > this.canvas.width + 20) symbol.x = -20;
      if (symbol.y < -20) symbol.y = this.canvas.height + 20;
      if (symbol.y > this.canvas.height + 20) symbol.y = -20;
    }
  }

  private getDomainWorldSpeedMultiplier(): number {
    if (!this.domainActive || this.activeDomainType !== "infiniteVoid") return 1;
    return 0.35;
  }

  private getDomainEnemyBulletSpeedMultiplier(): number {
    if (!this.domainActive || this.activeDomainType !== "infiniteVoid") return 1;
    return 0.12;
  }

  private getDomainPlayerMoveMultiplier(): number {
    if (!this.domainActive || this.activeDomainType !== "infiniteVoid") return 1;
    return 1.85;
  }

  private isRicochetDomainActive(): boolean {
    return this.domainActive && this.activeDomainType === "catastrophe";
  }

  private getGameSpeedMultiplier(): number {
    return this.score >= 1000 ? 1.2 : 1;
  }

  private startRickrollCurse(): void {
    this.state = "rickrollCurse";
    this.stateTimer = 0;
    this.bullets = [];
    for (const enemy of this.enemies) enemy.diving = false;
    this.startCurseAudio();
  }

  private trySkipCurse(): void {
    if (this.stateTimer < this.CURSE_SKIP_DELAY) return;
    this.stopCurseAudio();
    this.onEnd("menu");
  }

  private initCurseAudioClip(): void {
    const audio = new Audio(rickrollMp3Url);
    audio.loop = true;
    audio.volume = 0.7;
    audio.preload = "auto";

    audio.addEventListener("error", () => {
      this.curseAudioLoadFailed = true;
    });

    audio.load();
    this.curseAudioClip = audio;
  }

  private waitForCurseAudioReady(audio: HTMLAudioElement): Promise<void> {
    if (this.curseAudioLoadFailed) return Promise.resolve();
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return Promise.resolve();

    return new Promise(resolve => {
      const done = (): void => {
        audio.removeEventListener("canplaythrough", onReady);
        audio.removeEventListener("error", onError);
        resolve();
      };
      const onReady = (): void => done();
      const onError = (): void => {
        this.curseAudioLoadFailed = true;
        done();
      };

      audio.addEventListener("canplaythrough", onReady, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.load();
    });
  }

  private async startCurseAudio(): Promise<void> {
    if (this.curseAudioLoadFailed || !this.curseAudioClip) {
      this.startCurseSynth();
      return;
    }

    const audio = this.curseAudioClip;
    audio.currentTime = 0;
    this.curseAudio = audio;

    await this.waitForCurseAudioReady(audio);

    if (this.curseAudioLoadFailed) {
      this.curseAudio = null;
      this.startCurseSynth();
      return;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await audio.play();
        return;
      } catch {
        await new Promise(resolve => window.setTimeout(resolve, 80));
      }
    }

    this.curseAudio = null;
    this.startCurseSynth();
  }

  private startCurseSynth(): void {
    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor = globalThis.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioCtx = new AudioContextCtor();
    this.curseAudioCtx = audioCtx;

    const notes = [392, 440, 523.25, 440, 659.25, 659.25, 587.33, 440];
    const noteMs = 220;

    const playNote = (frequency: number, delayMs: number): void => {
      const timer = window.setTimeout(() => {
        if (!this.curseAudioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.type = "square";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
      }, delayMs);

      this.curseSynthTimers.push(timer);
    };

    for (let loop = 0; loop < 40; loop++) {
      notes.forEach((note, i) => playNote(note, (loop * notes.length + i) * noteMs));
    }
  }

  private stopCurseAudio(): void {
    if (this.curseAudio) {
      this.curseAudio.pause();
      this.curseAudio.currentTime = 0;
      this.curseAudio = null;
    }

    for (const timer of this.curseSynthTimers) {
      window.clearTimeout(timer);
    }
    this.curseSynthTimers = [];

    if (this.curseAudioCtx) {
      void this.curseAudioCtx.close();
      this.curseAudioCtx = null;
    }
  }

  draw(): void {
    const { ctx } = this;

    this.drawCursedBackground();

    for (const star of this.stars) {
      const size = star.size >= 1.5 ? 2 : 1;
      ctx.fillStyle = size === 2 ? COLORS.cyan : COLORS.ink;
      ctx.fillRect(Math.floor(star.x), Math.floor(star.y), size, size);
    }

    // Game entities
    this.player.draw(ctx);
    for (const enemy of this.enemies) enemy.draw(ctx);
    this.boss?.draw(ctx, this.frame);
    for (const bullet of this.bullets) bullet.draw(ctx);

    // Explosions
    for (const explosion of this.explosions) {
      for (const p of explosion.particles) {
        if (p.life <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.life * explosion.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (this.domainActive) this.drawDomainExpansion();
    if (this.reversedTechniqueActive) this.drawReversedTechnique();
    this.drawAnimeFrameTreatment();

    // HUD
    this.drawHUD();

    if (this.dimensionGlitchTimer > 0) this.drawDimensionGlitch();
    if (this.boss?.alive) this.drawBossHealthBar();

    // Overlay states
    if (this.state === "rickrollCurse") this.drawRickrollCurse();
    if (this.state === "victory") this.drawVictory();

    drawPixelScanlines(this.ctx, this.canvas.width, this.canvas.height);
  }

  private drawDimensionGlitch(): void {
    const { ctx, canvas } = this;
    const intensity = this.dimensionGlitchTimer / 150;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 18; i++) {
      const y = Math.random() * canvas.height;
      const h = 4 + Math.random() * 28;
      const offset = (Math.random() - 0.5) * 70 * intensity;
      ctx.globalAlpha = 0.08 + Math.random() * 0.18;
      ctx.fillStyle = i % 2 === 0 ? "#ff365f" : "#7cffe1";
      ctx.fillRect(offset, y, canvas.width, h);
    }

    ctx.globalAlpha = 0.22 * intensity;
    ctx.fillStyle = "#ffffff";
    for (let y = 0; y < canvas.height; y += 18) {
      ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ff365f";
    ctx.fillStyle = "#f5fffb";
    ctx.font = "bold 28px 'Courier New', monospace";
    ctx.fillText("DIMENSION FRACTURE", canvas.width / 2 + Math.sin(this.frame * 0.6) * 8, 112);
    ctx.fillStyle = "#7cffe1";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText("CURSED TEMPO HAS AWAKENED", canvas.width / 2, 138);
    ctx.restore();
  }

  private drawBossHealthBar(): void {
    if (!this.boss?.alive) return;

    const { ctx, canvas } = this;
    const info = BOSS_INFO[this.boss.type];
    const barW = 280;
    const barH = 10;
    const x = canvas.width / 2 - barW / 2;
    const y = 50;

    drawPixelPanel(ctx, x - 8, y - 8, barW + 16, 36, COLORS.panelHi, COLORS.yellow);
    drawPixelMeter(ctx, x, y, barW, barH, this.boss.hp / this.boss.maxHp, 28, COLORS.yellow);
    drawPixelText(ctx, info.subtitle, canvas.width / 2, y + 24, COLORS.ink, FONT_SMALL, "center");
  }

  private drawReversedTechnique(): void {
    const { ctx, canvas } = this;
    const progress = this.reversedTechniqueTimer / this.REVERSED_TECHNIQUE_DURATION;
    const pulse = 0.6 + Math.sin(this.frame * 0.18) * 0.4;
    const { x: px, y: py } = this.player;

    ctx.save();
    ctx.globalAlpha = 0.18;
    const healGrad = ctx.createRadialGradient(
      px,
      py,
      10,
      px,
      py,
      170
    );
    healGrad.addColorStop(0, "rgba(255,255,255,0.5)");
    healGrad.addColorStop(0.35, "rgba(124,255,225,0.35)");
    healGrad.addColorStop(1, "rgba(124,255,225,0)");
    ctx.fillStyle = healGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "#7cffe1";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f5fffb";
    ctx.font = "bold 20px 'Courier New', monospace";
    ctx.fillText("REVERSED CURSE TECHNIQUE", canvas.width / 2, canvas.height - 124);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7cffe1";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`VERTICAL MOVEMENT + NO LIFE LOSS ${(progress * 10).toFixed(1)}s`, canvas.width / 2, canvas.height - 100);
    ctx.restore();
  }

  private drawDomainExpansion(): void {
    if (!this.activeDomainType) return;

    switch (this.activeDomainType) {
      case "infiniteVoid":
        this.drawInfiniteVoidDomain();
        break;
      case "mirror":
        this.drawMirrorDomain();
        break;
      case "catastrophe":
        this.drawCatastropheDomain();
        break;
    }

    this.drawDomainBanner();
  }

  private drawDomainBanner(): void {
    if (!this.activeDomainType) return;

    const { ctx, canvas } = this;
    const info = DOMAIN_INFO[this.activeDomainType];
    const secondsLeft = (this.domainTimer / 60).toFixed(1);

    ctx.save();
    ctx.shadowColor = "#b54cff";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#f5fffb";
    ctx.font = "bold 24px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillText(info.name, canvas.width / 2, canvas.height - 86);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#7cffe1";
    ctx.font = "14px 'Courier New', monospace";
    ctx.fillText(`${info.subtitle}  |  ${secondsLeft}s`, canvas.width / 2, canvas.height - 58);
    ctx.restore();
  }

  private drawInfiniteVoidDomain(): void {
    const { ctx, canvas } = this;
    const pulse = 0.65 + Math.sin(this.frame * 0.16) * 0.35;
    const { x: px, y: py } = this.player;
    const warp = Math.sin(this.frame * 0.09) * 4;

    ctx.save();
    ctx.globalAlpha = 0.28;
    const domainGrad = ctx.createRadialGradient(px, py, 20, px, py, canvas.width * 0.75);
    domainGrad.addColorStop(0, "rgba(124,255,225,0.5)");
    domainGrad.addColorStop(0.4, "rgba(90,80,255,0.38)");
    domainGrad.addColorStop(1, "rgba(20,0,60,0.15)");
    ctx.fillStyle = domainGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const symbol of this.voidSymbols) {
      ctx.save();
      ctx.translate(symbol.x + warp, symbol.y);
      ctx.rotate(symbol.rot);
      ctx.globalAlpha = 0.22 + pulse * 0.18;
      ctx.fillStyle = "#dbe7ff";
      ctx.font = "bold 22px serif";
      ctx.textAlign = "center";
      ctx.fillText(symbol.char, 0, 8);
      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let y = 0; y < canvas.height; y += 6) {
      const offset = Math.sin(y * 0.04 + this.frame * 0.08) * (8 + pulse * 6);
      ctx.fillStyle = y % 12 === 0 ? "rgba(181,76,255,0.35)" : "rgba(124,255,225,0.2)";
      ctx.fillRect(offset, y, canvas.width, 2);
    }
    ctx.restore();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-this.frame * 0.012);
    ctx.strokeStyle = `rgba(181,76,255,${0.4 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 48 + i * 30 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMirrorDomain(): void {
    const { ctx, canvas } = this;
    const pulse = 0.5 + Math.sin(this.frame * 0.22) * 0.5;

    ctx.save();
    ctx.globalAlpha = 0.2 + pulse * 0.12;
    ctx.fillStyle = "rgba(181,76,255,0.35)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#7cffe1";
    ctx.fillRect(canvas.width / 2, 0, canvas.width / 2, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#ff365f";
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const y = (i * 37 + this.frame * 3) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y + Math.sin(this.frame * 0.1 + i) * 40);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#f5fffb";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawCatastropheDomain(): void {
    const { ctx, canvas } = this;
    const shakeX = (Math.random() - 0.5) * 10;
    const shakeY = (Math.random() - 0.5) * 10;
    const pulse = 0.5 + Math.sin(this.frame * 0.35) * 0.5;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.globalAlpha = 0.24;
    const chaosGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    chaosGrad.addColorStop(0, "rgba(255,54,95,0.35)");
    chaosGrad.addColorStop(0.5, "rgba(255,200,0,0.2)");
    chaosGrad.addColorStop(1, "rgba(124,255,225,0.3)");
    ctx.fillStyle = chaosGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.2 + pulse * 0.15;
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + this.frame * 11) % canvas.width;
      const y = (i * 53 + this.frame * 7) % canvas.height;
      ctx.strokeStyle = i % 3 === 0 ? "#ff365f" : i % 3 === 1 ? "#ffd34d" : "#7cffe1";
      ctx.lineWidth = 1 + (i % 4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sin(this.frame * 0.2 + i) * 80, y + Math.cos(this.frame * 0.17 + i) * 60);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let y = 0; y < canvas.height; y += 4) {
      const offset = Math.sin(y * 0.08 + this.frame * 0.3) * 18;
      ctx.fillStyle = y % 8 === 0 ? "#ffffff" : "#ff365f";
      ctx.fillRect(offset, y, canvas.width, 1);
    }
    ctx.restore();
  }

  private drawAnimeFrameTreatment(): void {
    const { ctx, canvas } = this;
    const actionActive =
      this.getGameSpeedMultiplier() > 1 || this.domainActive || this.reversedTechniqueActive;
    const barHeight = actionActive ? 12 : 8;

    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(0, 0, canvas.width, barHeight);
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
    ctx.fillStyle = actionActive ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, barHeight - 2, canvas.width, 2);
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, 2);
  }

  private drawCursedBackground(): void {
    const { ctx, canvas } = this;
    const pulse = 0.5 + Math.sin(this.frame * 0.018) * 0.5;

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "#07020d");
    bg.addColorStop(0.48, "#0c0716");
    bg.addColorStop(1, "#010006");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#ff365f";
    ctx.lineWidth = 1;
    for (let y = 72; y < canvas.height; y += 92) {
      ctx.beginPath();
      for (let x = 0; x <= canvas.width; x += 24) {
        const wobble = Math.sin(x * 0.018 + y * 0.02 + this.frame * 0.025) * 8;
        if (x === 0) ctx.moveTo(x, y + wobble);
        else ctx.lineTo(x, y + wobble);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height * 0.54);
    ctx.rotate(this.frame * 0.0015);
    for (let i = 0; i < 6; i++) {
      const radius = 120 + i * 58 + pulse * 10;
      ctx.strokeStyle = i % 2 === 0 ? "rgba(124,255,225,0.12)" : "rgba(255,54,95,0.11)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawHUD(): void {
    const { canvas } = this;
    const hudH = 92;

    drawPixelPanel(this.ctx, 0, 0, canvas.width, hudH, COLORS.panelHi, COLORS.cyan);
    this.ctx.fillStyle = COLORS.yellow;
    this.ctx.fillRect(0, hudH - 3, canvas.width, 3);

    drawPixelText(this.ctx, "1UP", 12, 20, COLORS.cyan, FONT_LABEL);
    drawPixelText(this.ctx, formatScore(this.score), 12, 40, COLORS.yellow, FONT_VALUE);

    drawPixelText(this.ctx, "HI", 12, 62, COLORS.orange, FONT_LABEL);
    drawPixelText(
      this.ctx,
      formatScore(Math.max(this.hiScore, this.score)),
      12,
      82,
      COLORS.ink,
      FONT_BODY
    );

    const centerLabel = this.boss?.alive
      ? `BOSS ${BOSS_INFO[this.boss.type].name}`
      : `WAVE ${this.wave + 1}`;
    drawPixelText(
      this.ctx,
      centerLabel,
      canvas.width / 2,
      26,
      this.boss?.alive ? COLORS.yellow : COLORS.ink,
      FONT_BODY,
      "center"
    );

    const meterX = Math.floor(canvas.width / 2 - 105);
    const meterFill = this.domainActive
      ? this.domainTimer / this.DOMAIN_DURATION
      : this.curseEnergy / 100;
    drawPixelMeter(
      this.ctx,
      meterX,
      42,
      210,
      10,
      meterFill,
      20,
      this.domainReady ? COLORS.green : COLORS.cyan
    );

    const nextDomain = this.getNextDomainPreview();
    const domainText = this.domainActive && this.activeDomainType
      ? `${DOMAIN_INFO[this.activeDomainType].name} ${Math.ceil(this.domainTimer / 60)}S`
      : this.domainReady
        ? `DOMAIN READY [E] ${DOMAIN_INFO[nextDomain].name}`
        : `DOMAIN ${Math.floor(this.curseEnergy)}%`;
    drawPixelText(
      this.ctx,
      domainText,
      canvas.width / 2,
      66,
      COLORS.muted,
      FONT_SMALL,
      "center"
    );

    drawPixelText(this.ctx, "SHIPS", canvas.width - 104, 20, COLORS.red, FONT_LABEL);
    for (let i = 0; i < this.lives; i++) {
      drawPixelShipIcon(this.ctx, canvas.width - 88 + i * 18, 32, COLORS.red);
    }

    if (this.getGameSpeedMultiplier() > 1) {
      drawPixelText(this.ctx, "TEMPO +20%", canvas.width - 12, 62, COLORS.yellow, FONT_SMALL, "right");
    }

    if (this.reversedTechniqueActive) {
      drawPixelText(
        this.ctx,
        `RCT ${Math.ceil(this.reversedTechniqueTimer / 60)}S`,
        canvas.width - 12,
        82,
        COLORS.green,
        FONT_SMALL,
        "right"
      );
    }
  }

  private drawRickrollCurse(): void {
    const { canvas } = this;
    const canSkip = this.stateTimer >= this.CURSE_SKIP_DELAY;
    const secondsLeft = Math.ceil((this.CURSE_SKIP_DELAY - this.stateTimer) / 60);
    const cy = canvas.height / 2;

    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPixelPanel(this.ctx, 80, cy - 120, canvas.width - 160, 220, COLORS.panelHi, COLORS.red);

    drawPixelText(this.ctx, "GAME OVER LMAO", canvas.width / 2, cy - 88, COLORS.red, "bold 32px 'Courier New', monospace", "center");
    drawPixelText(this.ctx, "RICKROLL CURSE", canvas.width / 2, cy - 48, COLORS.yellow, "bold 26px 'Courier New', monospace", "center");
    //drawPixelText(this.ctx, "NEVER GONNA GIVE YOU UP", canvas.width / 2, cy - 16, COLORS.ink, FONT_BODY, "center");
    drawPixelText(this.ctx, `SCORE ${formatScore(this.score)}`, canvas.width / 2, cy + 20, COLORS.cyan, FONT_BODY, "center");
    drawPixelText(
      this.ctx,
      canSkip ? "PRESS START TO EXIT" : `WAIT ${secondsLeft}S`,
      canvas.width / 2,
      cy + 56,
      canSkip ? COLORS.green : COLORS.muted,
      FONT_BODY,
      "center"
    );
  }

  private drawVictory(): void {
    const { canvas } = this;
    const cy = canvas.height / 2;

    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPixelPanel(this.ctx, 120, cy - 80, canvas.width - 240, 140, COLORS.panelHi, COLORS.yellow);

    drawPixelText(this.ctx, "STAGE CLEAR!", canvas.width / 2, cy - 36, COLORS.yellow, "bold 36px 'Courier New', monospace", "center");
    drawPixelText(this.ctx, formatScore(this.score), canvas.width / 2, cy + 8, COLORS.cyan, "bold 26px 'Courier New', monospace", "center");
    drawPixelText(this.ctx, "RETURNING TO TITLE...", canvas.width / 2, cy + 44, COLORS.muted, FONT_BODY, "center");
  }
}