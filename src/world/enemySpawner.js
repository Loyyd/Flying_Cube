import * as THREE from 'three';
import Spawner from './spawner.js';
import {
  ENEMY_BOX_SIZE as BOX_SIZE,
  ENEMY_NUM_BOXES as NUM_BOXES,
  MIN_SPAWNER_DISTANCE_FROM_PLAYER
} from '../core/settings.js';

class EnemySpawner {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.spawners = [];
    this.enemies = [];

    this.spawnerTimer = 0;
    this.spawnerInterval = 30; // 30 seconds

    // Create initial spawners with distance check
    let attempts = 0;
    while (this.spawners.length < NUM_BOXES && attempts < 100) {
      const position = new THREE.Vector3(
        Math.random() * 40 - 20,
        BOX_SIZE / 2,
        Math.random() * 40 - 20
      );
      
      if (position.distanceTo(player.position) >= MIN_SPAWNER_DISTANCE_FROM_PLAYER) {
        const spawner = new Spawner(scene, world, player, position);
        spawner._spawnTimer = 0;
        spawner._spawnInterval = 3 + Math.random() * 5;
        this.spawners.push(spawner);
      }
      attempts++;
    }
  }

  createSpawnerAtRandomPosition() {
    let position;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      position = new THREE.Vector3(
        Math.random() * 40 - 20,
        BOX_SIZE / 2,
        Math.random() * 40 - 20
      );
      attempts++;
    } while (
      position.distanceTo(this.player.position) < MIN_SPAWNER_DISTANCE_FROM_PLAYER &&
      attempts < maxAttempts
    );

    // Only create spawner if we found a valid position
    if (attempts < maxAttempts) {
      const spawner = new Spawner(this.scene, this.world, this.player, position);
      spawner._spawnTimer = 0; // Initialize spawn timer
      spawner._spawnInterval = 3 + Math.random() * 5; // Randomize spawn interval
      this.spawners.push(spawner);
    }
  }

  update(deltaTime) {
    // Update spawner timer
    this.spawnerTimer += deltaTime;
    if (this.spawnerTimer >= this.spawnerInterval) {
      this.createSpawnerAtRandomPosition();
      this.spawnerTimer = 0;
    }

    // Remove disposed enemies
    this.enemies = this.enemies.filter(enemy => !enemy._disposed);
    
    // Update remaining enemies
    for (const enemy of this.enemies) {
      enemy.update(deltaTime);
    }

    // Track spawned enemies from all spawners
    for (const spawner of this.spawners) {
      spawner._spawnTimer += deltaTime;
      if (spawner._spawnTimer >= spawner._spawnInterval) {
        spawner._spawnTimer = 0;
        const enemy = spawner.spawnEnemy();
        if (enemy) {
          this.enemies.push(enemy);
        }
      }
    }
  }

  hitBox(spawner) {
    if (spawner.hit()) {
      this.spawners = this.spawners.filter(s => s !== spawner);
    }
  }

  dispose() {
    for (const spawner of this.spawners) {
      spawner.destroy();
    }
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.spawners = [];
    this.enemies = [];
  }
}

export default EnemySpawner;
