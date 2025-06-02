import * as THREE from 'three';
import { Obstacle } from './obstacle.js';
import {
  OBSTACLE1_COLOR,
  OBSTACLE2_COLOR,
  NUM_RANDOM_OBSTACLES
} from '../core/settings.js';

export class ObstacleManager {
  constructor(scene, world, gridSize) {
    this.scene = scene;
    this.world = world;
    this.gridSize = gridSize;
    this.obstacles = [];
  }

  createWallObstacles() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.8,
      metalness: 0.1
    });
    const wallGeo = new THREE.BoxGeometry(1, 2, 1);

    for (let i = -this.gridSize / 2; i <= this.gridSize / 2; i++) {
      this.obstacles.push(
        new Obstacle(i, 1, -this.gridSize / 2, wallGeo, wallMaterial, true, this.scene, this.world)
      );
      this.obstacles.push(
        new Obstacle(i, 1, this.gridSize / 2, wallGeo, wallMaterial, true, this.scene, this.world)
      );
      if (i !== -this.gridSize / 2 && i !== this.gridSize / 2) {
        this.obstacles.push(
          new Obstacle(-this.gridSize / 2, 1, i, wallGeo, wallMaterial, true, this.scene, this.world)
        );
        this.obstacles.push(
          new Obstacle(this.gridSize / 2, 1, i, wallGeo, wallMaterial, true, this.scene, this.world)
        );
      }
    }
  }

  createRandomObstacles() {
    const obstacle1Material = new THREE.MeshStandardMaterial({
      color: OBSTACLE1_COLOR,
      roughness: 0.7,
      metalness: 0.1
    });
    const obstacle2Material = new THREE.MeshStandardMaterial({
      color: OBSTACLE2_COLOR,
      roughness: 0.7,
      metalness: 0.1
    });

    const obstacleGeo = new THREE.BoxGeometry(1, 1.5, 1);

    for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
      const x = Math.floor(Math.random() * (this.gridSize - 4) - (this.gridSize / 2 - 2));
      const z = Math.floor(Math.random() * (this.gridSize - 4) - (this.gridSize / 2 - 2));
      if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;

      // Determine obstacle type based on spawn probability
      const isObstacle1 = Math.random() < 0.2;
      const material = isObstacle1 ? obstacle1Material : obstacle2Material;

      this.obstacles.push(
        new Obstacle(x, 1.5 / 2, z, obstacleGeo, material, false, this.scene, this.world)
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
