//src/entities/bullet.ts
export type BulletOwner = "player" | "enemy";

export interface BulletUpdateOptions {
  ricochet?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

export class Bullet {
  public x: number;
  public y: number;
  public alive: boolean = true;
  public owner: BulletOwner;
  public vx: number;
  public vy: number;

  private readonly width: number = 4;
  private readonly height: number = 14;
  private trailPoints: { x: number; y: number }[] = [];

  constructor(x: number, y: number, owner: BulletOwner, vx?: number, vy?: number) {
    this.x = x;
    this.y = y;
    this.owner = owner;
    if (vx !== undefined && vy !== undefined) {
      this.vx = vx;
      this.vy = vy;
    } else {
      this.vx = 0;
      this.vy = owner === "player" ? -9 : 5;
    }
  }

  static createDirected(
    x: number,
    y: number,
    owner: BulletOwner,
    vx: number,
    vy: number
  ): Bullet {
    return new Bullet(x, y, owner, vx, vy);
  }

  update(speedMultiplier: number = 1, options?: BulletUpdateOptions): void {
    this.trailPoints.unshift({ x: this.x, y: this.y });
    if (this.trailPoints.length > 6) this.trailPoints.pop();

    this.x += this.vx * speedMultiplier;
    this.y += this.vy * speedMultiplier;

    if (options?.ricochet && options.canvasWidth && options.canvasHeight) {
      this.reflectInBounds(options.canvasWidth, options.canvasHeight);
    }
  }

  convertToPlayer(): void {
    if (this.owner !== "enemy") return;
    this.owner = "player";
    this.vy = -Math.abs(this.vy || 5);
    this.vx *= 0.35;
  }

  randomizeRicochet(): void {
    const speed = Math.hypot(this.vx, this.vy) || 7;
    const angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  private reflectInBounds(canvasWidth: number, canvasHeight: number): void {
    const bounds = this.getBounds();
    if (bounds.left < 0) {
      this.x += -bounds.left;
      this.vx = Math.abs(this.vx);
    } else if (bounds.right > canvasWidth) {
      this.x -= bounds.right - canvasWidth;
      this.vx = -Math.abs(this.vx);
    }

    if (bounds.top < 0) {
      this.y += -bounds.top;
      this.vy = Math.abs(this.vy);
    } else if (bounds.bottom > canvasHeight) {
      this.y -= bounds.bottom - canvasHeight;
      this.vy = -Math.abs(this.vy);
    }
  }

  isOffScreen(canvasWidth: number, canvasHeight: number, ricochetActive: boolean = false): boolean {
    if (ricochetActive) return false;
    return (
      this.y < -20 ||
      this.y > canvasHeight + 20 ||
      this.x < -20 ||
      this.x > canvasWidth + 20
    );
  }

  getBounds(): { left: number; right: number; top: number; bottom: number } {
    return {
      left: this.x - this.width / 2,
      right: this.x + this.width / 2,
      top: this.y - this.height / 2,
      bottom: this.y + this.height / 2,
    };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    const isPlayer = this.owner === "player";
    const color = isPlayer ? "#00ffcc" : "#ff3366";
    const glowColor = isPlayer ? "rgba(0,255,200,0.6)" : "rgba(255,51,102,0.6)";

    this.trailPoints.forEach((pt, i) => {
      const alpha = (1 - i / this.trailPoints.length) * 0.4;
      const scale = 1 - i / this.trailPoints.length;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(
        pt.x - (this.width * scale) / 2,
        pt.y - (this.height * scale) / 2,
        this.width * scale,
        this.height * scale
      );
      ctx.restore();
    });

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 10);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(1, "transparent");
    ctx.fillStyle = grad;
    ctx.fillRect(this.x - 10, this.y - 10, 20, 20);

    ctx.fillStyle = color;
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(this.x - 1, this.y - this.height / 2, 2, this.height);

    ctx.restore();
  }
}
