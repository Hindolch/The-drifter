//src/scenes/MainScene.ts

import { AudioManager } from "../systems/AudioManager.js";

import {

  COLORS,

  drawPixelBorder,

  drawPixelCaptionBar,

  drawPixelPanel,

  drawPixelStar,

  drawPixelText,

  formatScore,

  loadHiScore,

  FONT_BODY,

  FONT_HEADING,

  FONT_SMALL,

  FONT_TITLE,

} from "../ui/ArcadeUI.js";



export type MenuAction = "start";



export class MenuScene {

  private canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D;

  private onAction: (action: MenuAction) => void;

  private stars: { x: number; y: number; speed: number; color: string }[] = [];

  private audio = AudioManager.getInstance();

  private frame: number = 0;

  private boundKeydown: (e: KeyboardEvent) => void;

  private boundClick: () => void;



  constructor(

    canvas: HTMLCanvasElement,

    ctx: CanvasRenderingContext2D,

    onAction: (action: MenuAction) => void

  ) {

    this.canvas = canvas;

    this.ctx = ctx;

    this.onAction = onAction;



    const starColors = [COLORS.muted, COLORS.cyan, COLORS.yellow];

    for (let i = 0; i < 70; i++) {

      this.stars.push({

        x: Math.floor(Math.random() * canvas.width),

        y: Math.floor(Math.random() * canvas.height),

        speed: Math.random() < 0.3 ? 2 : 1,

        color: starColors[i % starColors.length],

      });

    }



    this.boundKeydown = (e: KeyboardEvent) => {

      if (e.code === "Space" || e.code === "Enter") this.startGame();

    };

    this.boundClick = () => this.startGame();



    window.addEventListener("keydown", this.boundKeydown);

    canvas.addEventListener("click", this.boundClick);

  }



  destroy(): void {

    window.removeEventListener("keydown", this.boundKeydown);

    this.canvas.removeEventListener("click", this.boundClick);

  }



  update(): void {

    this.frame++;

    for (const star of this.stars) {

      star.y += star.speed;

      if (star.y > this.canvas.height) {

        star.y = 0;

        star.x = Math.floor(Math.random() * this.canvas.width);

      }

    }

  }



  private startGame(): void {

    this.audio.playUiClick();

    this.onAction("start");

  }



  draw(): void {

    const { ctx, canvas } = this;



    ctx.fillStyle = COLORS.bg;

    ctx.fillRect(0, 0, canvas.width, canvas.height);



    for (const star of this.stars) {

      drawPixelStar(ctx, star.x, star.y, star.speed, star.color);

    }



    drawPixelBorder(ctx, 12, 12, canvas.width - 24, canvas.height - 24, COLORS.cyan);



    const titleY = 50;

    drawPixelPanel(ctx, 100, titleY, canvas.width - 200, 140, COLORS.panelHi, COLORS.yellow);

    drawPixelText(ctx, "Drifter", canvas.width / 2, titleY + 52, COLORS.yellow, FONT_TITLE, "center");

    drawPixelText(ctx, "CURSED SHOOTER", canvas.width / 2, titleY + 118, COLORS.ink, FONT_BODY, "center");



    drawPixelPanel(ctx, 80, 270, canvas.width - 160, 80, COLORS.panelHi, COLORS.cyan);

    drawPixelText(

      ctx,

      "ARROWS MOVE   SPACE FIRE   E DOMAIN",

      canvas.width / 2,

      300,

      COLORS.green,

      FONT_BODY,

      "center"

    );

    drawPixelText(

      ctx,

      "BOSS EVERY 3 WAVES   KILL TO CHARGE DOMAIN",

      canvas.width / 2,

      328,

      COLORS.muted,

      FONT_BODY,

      "center"

    );



    if (Math.floor(this.frame / 30) % 2 === 0) {

      drawPixelText(ctx, "> PRESS START <", canvas.width / 2, 395, COLORS.yellow, FONT_HEADING, "center");

    }



    const hiScore = loadHiScore();

    drawPixelPanel(ctx, 48, canvas.height - 108, 220, 56, COLORS.panelHi, COLORS.yellow);

    drawPixelText(ctx, "HI-SCORE", 64, canvas.height - 88, COLORS.orange, FONT_SMALL);

    drawPixelText(ctx, formatScore(hiScore), 64, canvas.height - 62, COLORS.yellow);



    drawPixelPanel(ctx, canvas.width - 268, canvas.height - 108, 220, 56, COLORS.panelHi, COLORS.cyan);

    drawPixelText(ctx, "1UP", canvas.width - 252, canvas.height - 88, COLORS.cyan, FONT_SMALL);

    drawPixelText(ctx, "00000000", canvas.width - 252, canvas.height - 62, COLORS.ink);



    drawPixelCaptionBar(ctx, 120, canvas.height - 52, canvas.width - 240, 40);

    drawPixelText(

      ctx,

      "GRUNT 100   CMD 200   LEAK 50   BOSS 2500",

      canvas.width / 2,

      canvas.height - 38,

      COLORS.yellow,

      FONT_SMALL,

      "center"

    );

    drawPixelText(

      ctx,

      "(C) 8-BIT CURSEWARE  1989",

      canvas.width / 2,

      canvas.height - 20,

      COLORS.muted,

      FONT_SMALL,

      "center"

    );

  }

}


