// src/systems/HandTrackingService.ts

export type HandGesture = "none" | "gun" | "fist" | "victory" | "crossed";

export interface HandState {
  x: number;         // Normalized X (0.0 to 1.0)
  y: number;         // Normalized Y (0.0 to 1.0)
  gesture: HandGesture;
  isActive: boolean;
}

export class HandTrackingService {
  private static instance: HandTrackingService | null = null;
  
  private hands: any = null;
  private camera: any = null;
  private videoElement: HTMLVideoElement | null = null;
  
  // Smoothed state data
  private currentState: HandState = { x: 0.5, y: 0.8, gesture: "none", isActive: false };
  private lerpFactor: number = 0.28; // Controls position tracking responsiveness vs smoothness

  static getInstance(): HandTrackingService {
    if (!HandTrackingService.instance) {
      HandTrackingService.instance = new HandTrackingService();
    }
    return HandTrackingService.instance;
  }

  constructor() {
    this.initVideoElement();
  }

  private initVideoElement(): void {
    // Look for the PIP webcam element we added to index.html
    const previewElement = document.getElementById("webcam-preview") as HTMLVideoElement | null;
    
    if (previewElement) {
      this.videoElement = previewElement;
      
      // CRITICAL: MediaPipe requires intrinsic dimensions to calculate canvas contexts,
      // otherwise it will crash and refuse to process frames.
      this.videoElement.width = 640;
      this.videoElement.height = 480;
    } else {
      // Fallback: Create a hidden one if the HTML element is missing
      this.videoElement = document.createElement("video");
      this.videoElement.style.display = "none";
      this.videoElement.style.position = "absolute";
      this.videoElement.style.pointerEvents = "none";
      this.videoElement.width = 640;
      this.videoElement.height = 480;
      document.body.appendChild(this.videoElement);
    }
  }

  public initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const MPHandCtor = (window as any).Hands;
      const MPCameraCtor = (window as any).Camera;

      if (!MPHandCtor || !MPCameraCtor) {
        console.error("MediaPipe libraries missing from window scope.");
        reject(new Error("MediaPipe dependencies not loaded. Check script elements."));
        return;
      }

      this.hands = new MPHandCtor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      // OPTIMIZATION 1 & 3: Lite Model & Faster Lock-on
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,           // 0 = Lite (Fastest), 1 = Full (Accurate)
        minDetectionConfidence: 0.5,  // Dropped from 0.65
        minTrackingConfidence: 0.5    // Dropped from 0.65
      });

      this.hands.onResults((results: any) => this.handleHandResults(results));

      if (this.videoElement) {
        this.camera = new MPCameraCtor(this.videoElement, {
          onFrame: async () => {
            if (this.videoElement) {
              await this.hands.send({ image: this.videoElement });
            }
          },
          // OPTIMIZATION 2: Cut the processing resolution by 75%
          width: 320,  
          height: 240
        });

        this.camera.start()
          .then(() => {
            console.log("MediaPipe Hand Tracking System initialized successfully.");
            resolve();
          })
          .catch((err: any) => reject(err));
      }
    });
  }

  private handleHandResults(results: any): void {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.currentState.isActive = false;
      this.currentState.gesture = "none";
      return;
    }

    this.currentState.isActive = true;
    const landmarks = results.multiHandLandmarks[0];

    // Landmark 9 represents the Middle Finger MCP joint (center base of palm/fingers)
    const rawX = landmarks[9].x;
    const rawY = landmarks[9].y;

    // Flip X axis for mirrored webcam projection behavior
    const targetX = 1.0 - rawX;
    const targetY = rawY;

    // Apply linear interpolation filtering to eliminate frame noise
    this.currentState.x += (targetX - this.currentState.x) * this.lerpFactor;
    this.currentState.y += (targetY - this.currentState.y) * this.lerpFactor;

    // Detect exact domain pose heuristics
    this.currentState.gesture = this.classifyGesture(landmarks);
  }

  private classifyGesture(landmarks: any[]): HandGesture {
    // MediaPipe normalizes Y coordinates from 0 (top) to 1 (bottom). 
    // An extended finger has a tip position value less than its lower joint position value.
    const isIndexExtended = landmarks[8].y < landmarks[6].y;
    const isMiddleExtended = landmarks[12].y < landmarks[10].y;
    const isRingExtended = landmarks[16].y < landmarks[14].y;
    const isPinkyExtended = landmarks[20].y < landmarks[18].y;

    // 1. Fist (Catastrophe Domain)
    if (!isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return "fist";
    }

    // 2. Twin Finger Differentiators (Victory vs Crossed)
    if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      const horizontalDelta = Math.abs(landmarks[8].x - landmarks[12].x);
      
      // Crossed fingers cross landmarks or pinch together extremely closely
      if (horizontalDelta < 0.026) {
        return "crossed"; // Infinite Void 🤞
      }
      return "victory";   // Mirror Domain ✌️
    }

    // 3. Gun Gesture / Pointing Command (Shoot)
    // Index extended, others are closed down tightly toward palm center
    if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
      return "gun";
    }

    return "none";
  }

  public getHandState(): HandState {
    return { ...this.currentState };
  }
}