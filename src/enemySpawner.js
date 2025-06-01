import * as THREE from 'three';
import Enemy from './enemy.js';
import {
  ENEMY_BOX_SIZE as BOX_SIZE,
  ENEMY_SPAWN_RADIUS as SPAWN_RADIUS,
  ENEMY_NUM_BOXES as NUM_BOXES,
  ENEMY_SPAWN_INTERVAL_MS
} from './settings.js';

class EnemySpawner {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.boxes = [];
    this.spawnIntervals = [];
    this.enemies = [];

    // Spawn boxes at random positions
    for (let i = 0; i < NUM_BOXES; i++) {
      const boxPos = new THREE.Vector3(
        Math.random() * 40 - 20,
        BOX_SIZE / 2,
        Math.random() * 40 - 20
      );
      const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
      const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(boxPos);
      this.scene.add(mesh);

      // Add spawn radius ring
      const ringGeometry = new THREE.RingGeometry(SPAWN_RADIUS - 0.05, SPAWN_RADIUS, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.set(boxPos.x, 0.01, boxPos.z);
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);

      this.boxes.push({ mesh, position: boxPos, ring });

      // Start enemy spawn interval for this box
      const interval = setInterval(() => {
        this.spawnEnemyNearBox(boxPos);
      }, ENEMY_SPAWN_INTERVAL_MS);
      this.spawnIntervals.push(interval);
    }
  }

  spawnEnemyNearBox(boxPos) {
    // Random angle and distance within SPAWN_RADIUS
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * SPAWN_RADIUS;
    const spawnX = boxPos.x + Math.cos(angle) * distance;
    const spawnZ = boxPos.z + Math.sin(angle) * distance;

    // Create enemy at this position
    const enemy = new Enemy(this.scene, this.world, this.player);
    enemy.body.position.set(spawnX, enemy.body.position.y, spawnZ);
    enemy.mesh.position.copy(enemy.body.position);
    this.enemies.push(enemy);
  }

  update(deltaTime) {
    // Update all spawned enemies
    for (const enemy of this.enemies) {
      enemy.update(deltaTime);
    }
  }

  dispose() {
    // Remove boxes, rings and clear intervals
    for (const { mesh, ring } of this.boxes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      if (ring) {
        this.scene.remove(ring);
        if (ring.geometry) ring.geometry.dispose();
        if (ring.material) ring.material.dispose();
      }
    }
    for (const interval of this.spawnIntervals) {
      clearInterval(interval);
    }
    // Dispose all enemies
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.boxes = [];
    this.spawnIntervals = [];
    this.enemies = [];
  }
}

export default EnemySpawner;
