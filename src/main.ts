// //src/main.ts
// import { MenuScene } from "./scenes/MenuScene.js";
// import { GameScene } from "./scenes/GameScene.js";

// type Scene = "menu" | "game";

// class Game {
//   private canvas: HTMLCanvasElement;
//   private ctx: CanvasRenderingContext2D;
//   private currentScene: Scene = "menu";
//   private menuScene: MenuScene | null = null;
//   private gameScene: GameScene | null = null;
//   private animFrameId: number = 0;

//   constructor(canvasId: string) {
//     const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
//     if (!canvas) throw new Error(`Canvas #${canvasId} not found`);
//     const ctx = canvas.getContext("2d");
//     if (!ctx) throw new Error("Failed to get 2D context");

//     this.canvas = canvas;
//     this.ctx = ctx;
//     this.ctx.imageSmoothingEnabled = false;

//     this.goToMenu();
//     this.loop();
//   }

//   private goToMenu(): void {
//     this.gameScene?.destroy();
//     this.gameScene = null;
//     this.currentScene = "menu";
//     this.menuScene = new MenuScene(this.canvas, this.ctx, (action) => {
//       if (action === "start") this.goToGame();
//     });
//   }

//   private goToGame(): void {
//     this.menuScene?.destroy();
//     this.menuScene = null;
//     this.currentScene = "game";
//     this.gameScene = new GameScene(this.canvas, this.ctx, (_result) => {
//       this.goToMenu();
//     });
//   }

//   private loop(): void {
//     this.animFrameId = requestAnimationFrame(() => this.loop());

//     if (this.currentScene === "menu" && this.menuScene) {
//       this.menuScene.update();
//       this.menuScene.draw();
//     } else if (this.currentScene === "game" && this.gameScene) {
//       this.gameScene.update();
//       this.gameScene.draw();
//     }
//   }
// }

// // Bootstrap
// window.addEventListener("DOMContentLoaded", () => {
//   new Game("gameCanvas");
// });


//src/main.ts
import { MenuScene } from "./scenes/MenuScene.js";
import { GameScene } from "./scenes/GameScene.js";
import { HandTrackingService } from "./systems/HandTrackingService.js";

type Scene = "menu" | "game";

class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentScene: Scene = "menu";
  private menuScene: MenuScene | null = null;
  private gameScene: GameScene | null = null;
  private animFrameId: number = 0;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) throw new Error(`Canvas #${canvasId} not found`);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D context");

    this.canvas = canvas;
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    // Initialize CV tracking before the looping transitions begin
    this.initHandTracking();

    this.goToMenu();
    this.loop();
  }

  private initHandTracking(): void {
    const tracking = HandTrackingService.getInstance();
    tracking.initialize()
      .then(() => console.log("Webcam Gesture Interface Ready."))
      .catch(err => console.warn("Webcam blocked or library loading error: ", err));
  }

  private goToMenu(): void {
    this.gameScene?.destroy();
    this.gameScene = null;
    this.currentScene = "menu";
    this.menuScene = new MenuScene(this.canvas, this.ctx, (action) => {
      if (action === "start") this.goToGame();
    });
  }

  private goToGame(): void {
    this.menuScene?.destroy();
    this.menuScene = null;
    this.currentScene = "game";
    this.gameScene = new GameScene(this.canvas, this.ctx, (_result) => {
      this.goToMenu();
    });
  }

  private loop(): void {
    this.animFrameId = requestAnimationFrame(() => this.loop());

    if (this.currentScene === "menu" && this.menuScene) {
      this.menuScene.update();
      this.menuScene.draw();
    } else if (this.currentScene === "game" && this.gameScene) {
      this.gameScene.update();
      this.gameScene.draw();
    }
  }
}

// Bootstrap
window.addEventListener("DOMContentLoaded", () => {
  new Game("gameCanvas");
});