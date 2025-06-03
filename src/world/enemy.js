import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SHOT_RANGE } from './player.js';
import {
  ENEMY_RADIUS,
  ENEMY_SPEED,
  ENEMY_WANDER_SPEED,
  ENEMY_DARK_RED as DARK_RED,
  ENEMY_CHASE_RADIUS as CHASE_RADIUS,
  ENEMY_WANDER_CHANGE_INTERVAL as WANDER_CHANGE_INTERVAL,
  defaultMaterial
} from '../core/settings.js';

class Enemy {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;

    // Visual
    const geometry = new THREE.BoxGeometry(ENEMY_RADIUS * 2, ENEMY_RADIUS * 2, ENEMY_RADIUS * 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.8, metalness: 0.2 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Physics
    const shape = new CANNON.Box(new CANNON.Vec3(ENEMY_RADIUS, ENEMY_RADIUS, ENEMY_RADIUS));
    this.body = new CANNON.Body({ mass: 1, material: defaultMaterial });
    this.body.addShape(shape);
    this.body.position.set(0, ENEMY_RADIUS, 0);
    this.world.addBody(this.body);
    
    // Moderate damping to prevent excessive bouncing
    this.body.linearDamping = 0.1;
    this.body.angularDamping = 0.1;

    this.wanderTarget = this._getRandomWanderTarget();
    this.wanderTimer = 0;
    this.timeSinceHit = null;
  }

  _getRandomWanderTarget() {
    // Pick a random point within a 40x40 area around current position
    const range = 40;
    let target;
    do {
      target = {
        x: this.body.position.x + (Math.random() * range - range/2),
        z: this.body.position.z + (Math.random() * range - range/2)
      };
    } while (
      Math.hypot(
        target.x - this.player.position.x,
        target.z - this.player.position.z
      ) < SHOT_RANGE
    );
    return target;
  }

  update(deltaTime) {
    if (this.timeSinceHit !== null) {
      this.timeSinceHit += deltaTime;
      if (this.timeSinceHit >= 5) {
        this.dispose();
        this._disposed = true;
        return;
      }
      
      // When hit, just update visual position
      this.mesh.position.copy(this.body.position);
      this.mesh.quaternion.copy(this.body.quaternion);
      return;
    }

    // Distance to player
    const dx = this.player.position.x - this.body.position.x;
    const dz = this.player.position.z - this.body.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    let targetVelX = 0;
    let targetVelZ = 0;

    if (distToPlayer < CHASE_RADIUS) {
      // Chase player
      targetVelX = dx / distToPlayer * ENEMY_SPEED;
      targetVelZ = dz / distToPlayer * ENEMY_SPEED;
    } else {
      // Wander behavior
      this.wanderTimer += deltaTime;
      if (this.wanderTimer >= WANDER_CHANGE_INTERVAL) {
        this.wanderTarget = this._getRandomWanderTarget();
        this.wanderTimer = 0;
      }

      const tx = this.wanderTarget.x - this.body.position.x;
      const tz = this.wanderTarget.z - this.body.position.z;
      const distToTarget = Math.sqrt(tx * tx + tz * tz);
      
      if (distToTarget > 0.1) {
        targetVelX = tx / distToTarget * ENEMY_WANDER_SPEED;
        targetVelZ = tz / distToTarget * ENEMY_WANDER_SPEED;
      }
    }

    // Set velocity directly for movement
    this.body.velocity.x = targetVelX;
    this.body.velocity.z = targetVelZ;
    // Keep Y velocity as is to allow for physics interactions
    
    // Update visual position
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  hitByShot() {
    if (this.timeSinceHit !== null) return;
    
    // Change color to dark red
    if (this.mesh.material) {
      this.mesh.material.color.setHex(DARK_RED);
    }
    
    // Add impulse from shot
    const randomImpulse = new CANNON.Vec3(
      (Math.random() - 0.5) * 10,
      5,
      (Math.random() - 0.5) * 10
    );
    this.body.applyImpulse(randomImpulse);
    
    // Start timer for disposal
    this.timeSinceHit = 0;
  }

  dispose() {
    if (this._disposed) return;
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    this._disposed = true;
  }
}

export default Enemy;
