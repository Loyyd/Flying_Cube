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
    // Use MeshStandardMaterial like obstacles, but purple color
    const material = new THREE.MeshStandardMaterial({ color: 0x800080, roughness: 0.8, metalness: 0.2 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Physics
    const shape = new CANNON.Box(new CANNON.Vec3(ENEMY_RADIUS, ENEMY_RADIUS, ENEMY_RADIUS));
    this.body = new CANNON.Body({ mass: 1 ,material: defaultMaterial });
    this.body.addShape(shape);

    // Spawn at random position, but not within SHOT_RANGE of player
    let spawnPos;
    do {
      spawnPos = {
        x: Math.random() * 40 - 20,
        z: Math.random() * 40 - 20
      };
    } while (
      Math.hypot(
        spawnPos.x - this.player.position.x,
        spawnPos.z - this.player.position.z
      ) < SHOT_RANGE
    );
    this.body.position.set(
      spawnPos.x,
      ENEMY_RADIUS,
      spawnPos.z
    );
    this.world.addBody(this.body);

    // Sync mesh to body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    this.isRigid = false;

    // Wandering state
    this.wanderTarget = this._getRandomWanderTarget();
    this.wanderTimer = 0;

    this.timeSinceHit = null;
  }

  _getRandomWanderTarget() {
    // Pick a random point within a 40x40 area, not too close to the player
    let target;
    do {
      target = {
        x: Math.random() * 40 - 20,
        z: Math.random() * 40 - 20
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
    if (this.isRigid) {
      // Kill after 5 seconds in dark red state
      if (this.timeSinceHit !== null) {
        this.timeSinceHit += deltaTime;
        if (this.timeSinceHit >= 5) {
          this.dispose();
          this._disposed = true;
          return;
        }
      }
      this.mesh.position.copy(this.body.position);
      this.mesh.quaternion.copy(this.body.quaternion);
      return;
    }

    // Distance to player
    const dx = this.player.position.x - this.body.position.x;
    const dz = this.player.position.z - this.body.position.z;
    const distToPlayer = Math.sqrt(dx * dx + dz * dz);

    if (distToPlayer < CHASE_RADIUS) {
      // Chase player
      const direction = new CANNON.Vec3(dx, 0, dz);
      if (direction.length() > 0.01) {
        direction.normalize();
        this.body.velocity.x = direction.x * ENEMY_SPEED;
        this.body.velocity.z = direction.z * ENEMY_SPEED;
      } else {
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
      }
    } else {
      // Wander toward target
      const tx = this.wanderTarget.x - this.body.position.x;
      const tz = this.wanderTarget.z - this.body.position.z;
      const distToTarget = Math.sqrt(tx * tx + tz * tz);

      if (distToTarget < 1.0) {
        // Arrived at target, pick a new one
        this.wanderTarget = this._getRandomWanderTarget();
      }

      const direction = new CANNON.Vec3(tx, 0, tz);
      if (direction.length() > 0.01) {
        direction.normalize();
        this.body.velocity.x = direction.x * ENEMY_WANDER_SPEED;
        this.body.velocity.z = direction.z * ENEMY_WANDER_SPEED;
      } else {
        this.body.velocity.x = 0;
        this.body.velocity.z = 0;
      }
    }

    // Sync mesh to body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  hitByShot() {
    if (this.isRigid) return;
    // Change color to dark red
    if (this.mesh.material) {
      this.mesh.material.color.setHex(DARK_RED);
    }
    // Make body dynamic (full rigidbody)
    this.isRigid = true;
    this.body.mass = 1; // Set a small mass to allow movement
    this.body.type = CANNON.Body.DYNAMIC;
    this.body.updateMassProperties();

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
