import * as THREE from 'three';
import { Obstacle } from './obstacle.js';

export const OBSTACLE_WALL_COLOR = 0x666666;
export const OBSTACLE_RANDOM_COLOR = 0x5070C0;
export const NUM_RANDOM_OBSTACLES = 50;

export class ObstacleManager {
  constructor(scene, world, defaultMaterial, gridSize) {
    this.scene = scene;
    this.world = world;
    this.defaultMaterial = defaultMaterial;
    this.gridSize = gridSize;
    this.obstacles = [];
  }

  createWallObstacles() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: OBSTACLE_WALL_COLOR,
      roughness: 0.8,
      metalness: 0.1
    });
    const wallGeo = new THREE.BoxGeometry(1, 2, 1);

    for (let i = -this.gridSize / 2; i <= this.gridSize / 2; i++) {
      this.obstacles.push(
        new Obstacle(i, 1, -this.gridSize / 2, wallGeo, wallMaterial, true, this.scene, this.world, this.defaultMaterial)
      );
      this.obstacles.push(
        new Obstacle(i, 1, this.gridSize / 2, wallGeo, wallMaterial, true, this.scene, this.world, this.defaultMaterial)
      );
      if (i !== -this.gridSize / 2 && i !== this.gridSize / 2) {
        this.obstacles.push(
          new Obstacle(-this.gridSize / 2, 1, i, wallGeo, wallMaterial, true, this.scene, this.world, this.defaultMaterial)
        );
        this.obstacles.push(
          new Obstacle(this.gridSize / 2, 1, i, wallGeo, wallMaterial, true, this.scene, this.world, this.defaultMaterial)
        );
      }
    }
  }

  createRandomObstacles() {
    const randomObstacleMaterial = new THREE.MeshStandardMaterial({
      color: OBSTACLE_RANDOM_COLOR,
      roughness: 0.7,
      metalness: 0.1
    });
    const randomObstacleGeo = new THREE.BoxGeometry(1, 1.5, 1);

    for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
      const x = Math.floor(Math.random() * (this.gridSize - 4) - (this.gridSize / 2 - 2));
      const z = Math.floor(Math.random() * (this.gridSize - 4) - (this.gridSize / 2 - 2));
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
      this.obstacles.push(
        new Obstacle(x, 1.5 / 2, z, randomObstacleGeo, randomObstacleMaterial, false, this.scene, this.world, this.defaultMaterial)
      );
    }
  }

  synchronizeObstacles() {
    this.obstacles.forEach(obstacle => obstacle.synchronize());
  }

  initializeObstacles() {
    this.createWallObstacles();
    this.createRandomObstacles();
  }
}
