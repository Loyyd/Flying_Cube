import * as THREE from 'three';
import Spawner from './spawner.js';
import {
  ENEMY_BOX_SIZE as BOX_SIZE,
  ENEMY_NUM_BOXES as NUM_BOXES
} from '../core/settings.js';

class EnemySpawner {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.spawners = [];
    this.enemies = [];

    // Create spawners at random positions
    for (let i = 0; i < NUM_BOXES; i++) {
      const position = new THREE.Vector3(
        Math.random() * 40 - 20,
        BOX_SIZE / 2,
        Math.random() * 40 - 20
      );
      const spawner = new Spawner(scene, world, player, position);
      this.spawners.push(spawner);
    }
  }

  update(deltaTime) {
    // Remove disposed enemies
    this.enemies = this.enemies.filter(enemy => !enemy._disposed);
    
    // Update remaining enemies
    for (const enemy of this.enemies) {
      enemy.update(deltaTime);
    }

    // Track spawned enemies from all spawners
    for (const spawner of this.spawners) {
      const enemy = spawner.spawnEnemy();
      if (enemy) {
        this.enemies.push(enemy);
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
