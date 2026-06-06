//src/entities/player.ts
export interface Position {
    x: number;
    y: number;
}

//Player class represents the player's ship
export class Player{
    public x: number;
    public y: number;
    public width: number = 40;
    public height: number = 36;
    public speed: number = 5;
    public alive: boolean = true;
    public shootCooldown: number = 0;
    private readonly SHOOT_DELAY: number = 15; //frames between shots

    constructor(x: number, y: number){
        this.x = x;
        this.y = y;
    }

    moveLeft(speedMultiplier: number = 1): void{
        this.x = Math.max(this.width / 2, this.x - this.speed * speedMultiplier);
    }

    moveRight(canvasWidth: number, speedMultiplier: number = 1): void{
        this.x = Math.min(canvasWidth - this.width / 2, this.x + this.speed * speedMultiplier);
    }

    moveUp(minY: number = this.height / 2, speedMultiplier: number = 1): void{
        this.y = Math.max(minY, this.y - this.speed * speedMultiplier);
    }

    moveDown(canvasHeight: number, speedMultiplier: number = 1): void{
        this.y = Math.min(canvasHeight - this.height / 2, this.y + this.speed * speedMultiplier);
    }

    canShoot(): boolean{
        return this.shootCooldown <= 0;
    }

    triggerShootCooldown(): void{
        this.shootCooldown = this.SHOOT_DELAY;
    }

    update(): void{
        if(this.shootCooldown > 0){
            this.shootCooldown--;
        }
    }

    //returns top-center of the ship for bullet spawn position
    getBulletOrigin(): Position{
        return {x: this.x, y: this.y - this.height / 2};
    }

    //axis- aligned bounding box for collision
    getBounds(): {left: number, right: number, top: number, bottom: number}{
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2,
        };
    }
    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.alive) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Cursed-energy aura
        ctx.strokeStyle = "rgba(124,255,225,0.45)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 24 + i * 7, Math.PI * 0.12, Math.PI * 1.82);
            ctx.stroke();
        }
     
        // Engine glow
        const glow = ctx.createRadialGradient(0, 10, 2, 0, 10, 22);
        glow.addColorStop(0, "rgba(255,54,95,0.9)");
        glow.addColorStop(0.45, "rgba(181,76,255,0.45)");
        glow.addColorStop(1, "rgba(0,180,255,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.ellipse(0, 14, 14, 14, 0, 0, Math.PI * 2);
        ctx.fill();
     
        // Ship body
        ctx.fillStyle = "#7cffe1";
        ctx.shadowColor = "#7cffe1";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -18);       // nose
        ctx.lineTo(12, 8);        // right wing tip
        ctx.lineTo(8, 4);         // right wing inner
        ctx.lineTo(5, 18);        // right engine
        ctx.lineTo(-5, 18);       // left engine
        ctx.lineTo(-8, 4);        // left wing inner
        ctx.lineTo(-12, 8);       // left wing tip
        ctx.closePath();
        ctx.fill();
     
        // Cockpit
        ctx.fillStyle = "#12030f";
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, -4, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
     
        // Cockpit shine
        ctx.fillStyle = "rgba(255,54,95,0.55)";
        ctx.beginPath();
        ctx.ellipse(-1, -6, 1.5, 2.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
     
        ctx.restore();
      }

}
