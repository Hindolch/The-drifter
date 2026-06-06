// A generic AABB (Axis-Aligned Bounding Box) collision check.
// Returns true if the two rectangles overlap.
//src/systems/CollisionSystem.ts

interface Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }
  
  export class CollisionSystem {
    static overlaps(a: Bounds, b: Bounds): boolean {
      return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
      );
    }
  }