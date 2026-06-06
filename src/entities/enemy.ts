//src/entities/enemy.ts
export type EnemyType = "grunt" | "commander" | "boss" | "leak";

export interface EnemyConfig{
    type: EnemyType;
    points: number;
    speed: number;
    color: string;
    size: number;
}

const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
    grunt: { type: "grunt", points: 100, speed: 1.0, color: "#b54cff", size: 28 },
    commander: { type: "commander", points: 200, speed: 1.4, color: "#ff365f", size: 32 },
    boss: { type: "boss", points: 400, speed: 0.8, color: "#7cffe1", size: 38 },
    leak: { type: "leak", points: 50, speed: 1.9, color: "#9d6bff", size: 18 },
};

export class Enemy{
    public x: number;
    public y: number;
    public alive: boolean = true;
    public config: EnemyConfig;

    //dive-bomb state
    public diving: boolean = false;
    public diveAngle: number = 0;
    public diveSpeed: number = 4;
    private diveDrift: number = 0;
    private diveWobble: number = 1;

    //FORMATION position(home position)
    public formationX: number;
    public formationY: number;

    //wing-flap animation
    private flapTimer: number = Math.random() * Math.PI * 2;

    constructor(x: number, y: number, type: EnemyType = "grunt"){
        this.x = x;
        this.y = y;
        this.formationX = x;
        this.formationY = y;
        this.config = ENEMY_CONFIGS[type];
    }

    update(canvasWidth: number, canvasHeight: number, speedMultiplier: number = 1): void{
        this.flapTimer += 0.08 * speedMultiplier;

        if(this.diving){
            //dive downward in an arc
            this.x += (Math.sin(this.diveAngle) * this.diveWobble + this.diveDrift) * this.diveSpeed * speedMultiplier;
            this.y += this.diveSpeed * 1.5 * speedMultiplier;
            this.diveAngle += 0.025 * speedMultiplier;

            //wrap around if exits canvas
            if (this.y > canvasHeight + 50){
                //return to formation position from top
                this.y = -50;
                this.x = this.formationX;
                this.diving = false;
                this.diveAngle = 0;
                this.diveDrift = 0;
                this.diveWobble = 1;
            }
            if(this.x < -50) this.x = canvasWidth + 50;
            if (this.x > canvasWidth + 50) this.x = -50;
        } else{
            //drift gently toward formation position
            this.x += (this.formationX - this.x) * 0.05 * speedMultiplier;
            this.y += (this.formationY - this.y) * 0.05 * speedMultiplier;
        }
    }

    startDive(canvasWidth: number): void{
        this.diving = true;
        this.diveAngle = Math.random() * Math.PI * 2;
        this.diveWobble = 0.45 + Math.random() * 1.1;

        const entry = Math.floor(Math.random() * 3);
        if (entry === 0) {
            this.x = Math.random() * canvasWidth;
            this.y = -40 - Math.random() * 80;
            this.diveDrift = (Math.random() - 0.5) * 0.45;
        } else if (entry === 1) {
            this.x = -50;
            this.y = 60 + Math.random() * 180;
            this.diveDrift = 0.25 + Math.random() * 0.35;
        } else {
            this.x = canvasWidth + 50;
            this.y = 60 + Math.random() * 180;
            this.diveDrift = -0.25 - Math.random() * 0.35;
        }
    }

    getBound(): {left: number, right: number, top: number, bottom: number}{
        const half = this.config.size / 2;
        return {
            left: this.x - half,
            right: this.x + half,
            top: this.y - half,
            bottom: this.y + half,
        };

    }
    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x, this.y);
     
        const s = this.config.size / 2;
        const flap = Math.sin(this.flapTimer) * 0.3; // wing flap factor
        const color = this.config.color;
     
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
     
        if (this.config.type === "grunt" || this.config.type === "leak") {
          this.drawGrunt(ctx, s, flap, color);
        } else if (this.config.type === "commander") {
          this.drawCommander(ctx, s, flap, color);
        } else {
          this.drawBoss(ctx, s, flap, color);
        }
     
        ctx.restore();
      }
     
      private drawGrunt(ctx: CanvasRenderingContext2D, s: number, flap: number, color: string): void {
        ctx.strokeStyle = "rgba(0,0,0,0.65)";
        ctx.lineWidth = 2;

        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.5, s * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
     
        // Wings (flapping)
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, -s * 0.1);
        ctx.lineTo(-s * (0.9 + flap), -s * 0.4);
        ctx.lineTo(-s * (0.9 + flap), s * 0.4);
        ctx.lineTo(-s * 0.4, s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
     
        ctx.beginPath();
        ctx.moveTo(s * 0.4, -s * 0.1);
        ctx.lineTo(s * (0.9 + flap), -s * 0.4);
        ctx.lineTo(s * (0.9 + flap), s * 0.4);
        ctx.lineTo(s * 0.4, s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cursed feelers
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.18, -s * 0.55);
          ctx.quadraticCurveTo(i * s * 0.55, -s * (1.0 + flap), i * s * 0.75, -s * 0.72);
          ctx.stroke();
        }
     
        // Eyes
        ctx.fillStyle = "#f8fff8";
        ctx.beginPath();
        ctx.arc(-s * 0.18, -s * 0.1, s * 0.15, 0, Math.PI * 2);
        ctx.arc(s * 0.18, -s * 0.1, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#050008";
        ctx.beginPath();
        ctx.arc(-s * 0.18, -s * 0.08, s * 0.08, 0, Math.PI * 2);
        ctx.arc(s * 0.18, -s * 0.08, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
     
      private drawCommander(ctx: CanvasRenderingContext2D, s: number, flap: number, color: string): void {
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 2;

        // Main body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.6, -s * 0.3);
        ctx.lineTo(s * (0.9 + flap), 0);
        ctx.lineTo(s * 0.6, s * 0.5);
        ctx.lineTo(0, s * 0.8);
        ctx.lineTo(-s * 0.6, s * 0.5);
        ctx.lineTo(-s * (0.9 + flap), 0);
        ctx.lineTo(-s * 0.6, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Jaw mark
        ctx.strokeStyle = "#12030f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.35, s * 0.28);
        ctx.lineTo(0, s * 0.52);
        ctx.lineTo(s * 0.35, s * 0.28);
        ctx.stroke();
     
        // Center gem
        ctx.fillStyle = "#f5fff9";
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
     
      private drawBoss(ctx: CanvasRenderingContext2D, s: number, flap: number, color: string): void {
        // Outer ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.95, 0, Math.PI * 2);
        ctx.stroke();

        // Barrier slashes
        ctx.strokeStyle = "rgba(255,54,95,0.55)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = this.flapTimer * 0.3 + i * Math.PI * 0.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * s * 0.2, Math.sin(angle) * s * 0.2);
          ctx.lineTo(Math.cos(angle) * s * 1.15, Math.sin(angle) * s * 1.15);
          ctx.stroke();
        }
     
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.8);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? s * 0.8 : s * 0.4;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
     
        // Pulsing core
        const pulse = 0.6 + Math.sin(this.flapTimer * 2) * 0.2;
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.35 * pulse);
        coreGrad.addColorStop(0, "#ffffff");
        coreGrad.addColorStop(1, color);
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.35 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
}
