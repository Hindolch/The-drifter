//src/entities/Boss.ts
export type BossType = "memoryLeak" | "stackOverflow" | "nullPointer";

export interface BossSpawnRequest {
  minions: { x: number; y: number }[];
  bullets: { x: number; y: number; vx: number; vy: number }[];
}

export const BOSS_INFO: Record<BossType, { name: string; color: string; subtitle: string }> = {
  memoryLeak: {
    name: "MEMORY LEAK",
    color: "#9d6bff",
    subtitle: "SPAWNS ENDLESS MINI-ENEMIES",
  },
  stackOverflow: {
    name: "STACK OVERFLOW",
    color: "#ff6b35",
    subtitle: "BULLET SPIRALS",
  },
  nullPointer: {
    name: "NULL POINTER",
    color: "#00e5ff",
    subtitle: "TELEPORTS UNPREDICTABLY",
  },
};

const BOSS_TYPES: BossType[] = ["memoryLeak", "stackOverflow", "nullPointer"];

export function getBossTypeForEncounter(encounterIndex: number): BossType {
  return BOSS_TYPES[encounterIndex % BOSS_TYPES.length];
}

export class Boss {
  public x: number;
  public y: number;
  public alive: boolean = true;
  public readonly type: BossType;
  public hp: number;
  public readonly maxHp: number;
  public teleportFlash: number = 0;

  private actionTimer: number = 0;
  private spiralAngle: number = 0;
  private orbitPhase: number = 0;
  private driftTimer: number = 0;
  private driftTargetX: number;
  private pending: BossSpawnRequest = { minions: [], bullets: [] };

  constructor(x: number, y: number, type: BossType, encounterIndex: number = 0) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.driftTargetX = x;
    this.maxHp = 35 + encounterIndex * 12;
    this.hp = this.maxHp;
  }

  takeDamage(amount: number = 1): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  consumeSpawnRequest(): BossSpawnRequest {
    const request = this.pending;
    this.pending = { minions: [], bullets: [] };
    return request;
  }

  update(
    canvasWidth: number,
    canvasHeight: number,
    frame: number,
    speedMultiplier: number = 1
  ): void {
    if (!this.alive) return;

    this.pending = { minions: [], bullets: [] };
    if (this.teleportFlash > 0) this.teleportFlash -= speedMultiplier;

    this.actionTimer += speedMultiplier;
    this.orbitPhase += 0.02 * speedMultiplier;

    switch (this.type) {
      case "memoryLeak":
        this.updateMemoryLeak(canvasWidth, speedMultiplier);
        break;
      case "stackOverflow":
        this.updateStackOverflow(canvasWidth, canvasHeight, speedMultiplier);
        break;
      case "nullPointer":
        this.updateNullPointer(canvasWidth, canvasHeight, speedMultiplier);
        break;
    }

    this.x = Math.max(70, Math.min(canvasWidth - 70, this.x));
    this.y = Math.max(70, Math.min(canvasHeight * 0.42, this.y));
  }

  private updateMemoryLeak(canvasWidth: number, speedMultiplier: number): void {
    this.x += Math.sin(this.orbitPhase) * 1.4 * speedMultiplier;
    this.driftTargetX = canvasWidth / 2 + Math.sin(this.orbitPhase * 0.7) * 120;
    this.x += (this.driftTargetX - this.x) * 0.02 * speedMultiplier;

    if (this.actionTimer >= 38) {
      this.actionTimer = 0;
      const spread = (Math.random() - 0.5) * 80;
      this.pending.minions.push({
        x: this.x + spread,
        y: this.y + 28 + Math.random() * 20,
      });
      if (Math.random() < 0.35) {
        this.pending.minions.push({
          x: this.x - spread * 0.6,
          y: this.y + 40,
        });
      }
    }
  }

  private updateStackOverflow(
    canvasWidth: number,
    canvasHeight: number,
    speedMultiplier: number
  ): void {
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight * 0.22;
    this.x = centerX + Math.sin(this.orbitPhase * 1.4) * 90;
    this.y = centerY + Math.sin(this.orbitPhase * 2.1) * 28;

    if (this.actionTimer >= 7) {
      this.actionTimer = 0;
      const arms = 3;
      for (let i = 0; i < arms; i++) {
        const angle = this.spiralAngle + (i * Math.PI * 2) / arms;
        const speed = 4.2;
        this.pending.bullets.push({
          x: this.x,
          y: this.y + 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + 1.2,
        });
      }
      this.spiralAngle += 0.28 * speedMultiplier;
    }
  }

  private updateNullPointer(
    canvasWidth: number,
    canvasHeight: number,
    speedMultiplier: number
  ): void {
    this.driftTimer += speedMultiplier;

    if (this.actionTimer >= 55) {
      this.actionTimer = 0;
      this.teleportFlash = 22;
      this.x = 80 + Math.random() * (canvasWidth - 160);
      this.y = 70 + Math.random() * (canvasHeight * 0.28);
    } else if (this.driftTimer >= 18) {
      this.driftTimer = 0;
      this.x += (Math.random() - 0.5) * 90;
      this.y += (Math.random() - 0.5) * 50;
    } else {
      this.x += (Math.random() - 0.5) * 2.8 * speedMultiplier;
      this.y += (Math.random() - 0.5) * 1.6 * speedMultiplier;
    }
  }

  getBounds(): { left: number; right: number; top: number; bottom: number } {
    const half = this.type === "stackOverflow" ? 44 : 38;
    return {
      left: this.x - half,
      right: this.x + half,
      top: this.y - half,
      bottom: this.y + half,
    };
  }

  draw(ctx: CanvasRenderingContext2D, frame: number): void {
    if (!this.alive) return;

    const info = BOSS_INFO[this.type];
    const pulse = 0.6 + Math.sin(frame * 0.12) * 0.4;

    if (this.teleportFlash > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 * (this.teleportFlash / 22);
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 8]);
      ctx.strokeRect(
        this.getBounds().left - 8,
        this.getBounds().top - 8,
        96,
        96
      );
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = info.color;
    ctx.shadowBlur = 22;

    switch (this.type) {
      case "memoryLeak":
        this.drawMemoryLeak(ctx, pulse, info.color);
        break;
      case "stackOverflow":
        this.drawStackOverflow(ctx, pulse, info.color, frame);
        break;
      case "nullPointer":
        this.drawNullPointer(ctx, pulse, info.color, frame);
        break;
    }

    ctx.restore();

    this.drawNameplate(ctx, info.name, info.color);
  }

  private drawNameplate(ctx: CanvasRenderingContext2D, name: string, color: string): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.font = "bold 11px 'Courier New', monospace";
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(name, this.x, this.y - 52);
    ctx.restore();
  }

  private drawMemoryLeak(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    color: string
  ): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + pulse;
      const dist = 26 + pulse * 8;
      ctx.fillStyle = "rgba(157,107,255,0.35)";
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(24, 10);
    ctx.lineTo(0, 22);
    ctx.lineTo(-24, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a0030";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("MEM", 0, 6);
  }

  private drawStackOverflow(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    color: string,
    frame: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    for (let ring = 0; ring < 4; ring++) {
      const radius = 18 + ring * 10 + pulse * 6;
      ctx.beginPath();
      ctx.arc(0, 0, radius, frame * 0.04 + ring, frame * 0.04 + ring + Math.PI * 1.4);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.fillStyle = "#1a0800";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("{}", 0, 5);
  }

  private drawNullPointer(
    ctx: CanvasRenderingContext2D,
    pulse: number,
    color: string,
    frame: number
  ): void {
    const glitch = (Math.random() - 0.5) * (this.teleportFlash > 0 ? 10 : 2);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(glitch, glitch, 30 + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0,229,255,0.25)";
    ctx.fillRect(-34, -8, 68, 16);
    ctx.fillStyle = color;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("null", glitch, 6);

    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#ffffff";
    ctx.fillText("null", -glitch * 1.5, -glitch);
    ctx.globalAlpha = 1;
  }
}
