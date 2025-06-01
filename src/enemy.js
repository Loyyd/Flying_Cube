import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SHOT_RANGE } from './player.js';

const ENEMY_RADIUS = 0.5;
const ENEMY_SPEED = 1.0; // Higher = more aggressive following
const DARK_RED = 0x660000;

class Enemy {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;

    // Visual
    const geometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Physics
    const shape = new CANNON.Sphere(ENEMY_RADIUS);
    this.body = new CANNON.Body({ mass: 1 });
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

    this.isRigid = false;
  }

  update(deltaTime) {
    if (this.isRigid) {
      // Only sync mesh to body if rigid
      this.mesh.position.copy(this.body.position);
      return;
    }
    // Move towards player (set velocity directly)
    const target = new CANNON.Vec3(
      this.player.position.x,
      this.body.position.y,
      this.player.position.z
    );
    const direction = target.vsub(this.body.position);
    direction.y = 0; // Stay on ground
    if (direction.length() > 0.01) {
      direction.normalize();
      // Set velocity directly for linear movement
      this.body.velocity.x = direction.x * ENEMY_SPEED;
      this.body.velocity.z = direction.z * ENEMY_SPEED;
    } else {
      // Stop if very close to player
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }

    // Sync mesh to body
    this.mesh.position.copy(this.body.position);
  }

  hitByShot() {
    if (this.isRigid) return;
    // Change color to dark red
    if (this.mesh.material) {
      this.mesh.material.color.setHex(DARK_RED);
    }
    // Make body dynamic (full rigidbody)
    this.isRigid = true;
    this.body.type = CANNON.Body.DYNAMIC;
    this.body.mass = 1;
    this.body.updateMassProperties();
    // Optionally, give a little upward impulse for effect
    this.body.velocity.y = 4;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
  }
}

export default Enemy;
