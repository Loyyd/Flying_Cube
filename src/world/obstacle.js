import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  OBSTACLE_WALL_COLOR,
  OBSTACLE_RANDOM_COLOR,
  NUM_RANDOM_OBSTACLES,
  defaultMaterial
} from '../core/settings.js';

export class Obstacle {
  constructor(x, y, z, geometry, material, isStatic, scene, world) {
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(x, y, z);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    const halfExtents = new CANNON.Vec3(
      geometry.parameters.width / 2,
      geometry.parameters.height / 2,
      geometry.parameters.depth / 2
    );
    const boxShape = new CANNON.Box(halfExtents);
    this.body = new CANNON.Body({ mass: isStatic ? 0 : 1, material: defaultMaterial });
    this.body.addShape(boxShape);
    this.body.position.set(x, y, z);
    world.addBody(this.body);
  }

  synchronize() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }
}

export function initializeObstacles(scene, world, defaultMaterial, GRID_SIZE, obstacleBodies) {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: OBSTACLE_WALL_COLOR,
    roughness: 0.2,
    metalness: 0.0
  });
  const randomObstacleMaterial = new THREE.MeshStandardMaterial({
    color: OBSTACLE_RANDOM_COLOR,
    roughness: 0.3,
    metalness: 0.0
  });
  const wallGeo = new THREE.BoxGeometry(1, 2, 1);
  const randomObstacleGeo = new THREE.BoxGeometry(1, 1.5, 1);

  // Create wall obstacles
  for (let i = -GRID_SIZE / 2; i <= GRID_SIZE / 2; i++) {
    new Obstacle(i, 1, -GRID_SIZE / 2, wallGeo, wallMaterial, true, scene, world, defaultMaterial);
    new Obstacle(i, 1, GRID_SIZE / 2, wallGeo, wallMaterial, true, scene, world, defaultMaterial);
    if (i !== -GRID_SIZE / 2 && i !== GRID_SIZE / 2) {
      new Obstacle(-GRID_SIZE / 2, 1, i, wallGeo, wallMaterial, true, scene, world, defaultMaterial);
      new Obstacle(GRID_SIZE / 2, 1, i, wallGeo, wallMaterial, true, scene, world, defaultMaterial);
    }
  }

  // Create random obstacles
  for (let i = 0; i < NUM_RANDOM_OBSTACLES; i++) {
    const x = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
    const z = Math.floor(Math.random() * (GRID_SIZE - 4) - (GRID_SIZE / 2 - 2));
    if (Math.abs(x) < 3 && Math.abs(z) < 3) continue;
    new Obstacle(x, 1.5 / 2, z, randomObstacleGeo, randomObstacleMaterial, false, scene, world, defaultMaterial);
  }
}
