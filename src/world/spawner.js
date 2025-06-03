import * as THREE from 'three';
import Enemy from './enemy.js';
import {
  ENEMY_BOX_SIZE as BOX_SIZE,
  ENEMY_SPAWN_RADIUS as SPAWN_RADIUS,
  ENEMY_SPAWN_INTERVAL_MS
} from '../core/settings.js';

class Spawner {
  constructor(scene, world, player, position) {
    this.scene = scene;
    this.world = world;
    this.player = player;
    this.position = position;
    this.maxHealth = 3;
    this.health = this.maxHealth;
    this.active = true;
    this.lastSpawnTime = Date.now();
    this.spawnInterval = ENEMY_SPAWN_INTERVAL_MS; // 3000ms from settings
    
    // Create box mesh
    const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(position);
    this.scene.add(this.mesh);

    // Create spawn radius ring
    const ringGeometry = new THREE.RingGeometry(SPAWN_RADIUS - 0.05, SPAWN_RADIUS, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ring.position.set(position.x, 0.01, position.z);
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);

    // Create health bar
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 20;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    this.healthBar = {
      sprite: new THREE.Sprite(spriteMaterial),
      context: context,
      texture: texture
    };
    this.healthBar.sprite.position.set(position.x, BOX_SIZE + 1, position.z);
    this.healthBar.sprite.scale.set(2, 0.2, 1);
    this.scene.add(this.healthBar.sprite);
    this.updateHealthBar(1);
  }

  updateHealthBar(healthPercent) {
    const ctx = this.healthBar.context;
    ctx.clearRect(0, 0, 200, 20);
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 200, 20);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 200 * healthPercent, 20);
    this.healthBar.texture.needsUpdate = true;
  }

  spawnEnemy() {
    if (!this.active) return null;
    
    const currentTime = Date.now();
    if (currentTime - this.lastSpawnTime < this.spawnInterval) {
      return null;
    }
    
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * SPAWN_RADIUS;
    const spawnX = this.position.x + Math.cos(angle) * distance;
    const spawnZ = this.position.z + Math.sin(angle) * distance;

    const enemy = new Enemy(this.scene, this.world, this.player);
    enemy.body.position.set(spawnX, enemy.body.position.y, spawnZ);
    enemy.mesh.position.copy(enemy.body.position);
    
    this.lastSpawnTime = currentTime;
    return enemy;
  }

  hit() {
    this.health--;
    this.updateHealthBar(this.health / this.maxHealth);
    if (this.health <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }

  destroy() {
    this.active = false;
    this.scene.remove(this.mesh);
    this.scene.remove(this.ring);
    this.scene.remove(this.healthBar.sprite);
    
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    if (this.ring.geometry) this.ring.geometry.dispose();
    if (this.ring.material) this.ring.material.dispose();
    if (this.healthBar.sprite.material) this.healthBar.sprite.material.dispose();
    if (this.healthBar.sprite.material.map) this.healthBar.sprite.material.map.dispose();
  }
}

export default Spawner;
