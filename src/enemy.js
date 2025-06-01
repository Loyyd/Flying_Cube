import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SHOT_RANGE } from './player.js';
import {
  ENEMY_RADIUS,
  ENEMY_SPEED,
  ENEMY_WANDER_SPEED,
  ENEMY_DARK_RED as DARK_RED,
  ENEMY_CHASE_RADIUS as CHASE_RADIUS,
  ENEMY_WANDER_CHANGE_INTERVAL as WANDER_CHANGE_INTERVAL
} from './settings.js';

class Enemy {
  constructor(scene, world, player) {
    this.scene = scene;
    this.world = world;
    this.player = player;

    // Visual
    const geometry = new THREE.BoxGeometry(ENEMY_RADIUS * 2, ENEMY_RADIUS * 2, ENEMY_RADIUS * 2);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    // Physics
    const shape = new CANNON.Box(new CANNON.Vec3(ENEMY_RADIUS, ENEMY_RADIUS, ENEMY_RADIUS));
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

    // Wandering state
    this.wanderDirection = new CANNON.Vec3(Math.random() - 0.5, 0, Math.random() - 0.5).unit();
    this.wanderTimer = 0;
  }

  update(deltaTime) {
    if (this.isRigid) {
      this.mesh.position.copy(this.body.position);
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
      // Wander randomly
      this.wanderTimer -= deltaTime;
      if (this.wanderTimer <= 0) {
        // Pick a new random direction
        this.wanderDirection = new CANNON.Vec3(Math.random() - 0.5, 0, Math.random() - 0.5);
        if (this.wanderDirection.length() > 0.01) {
          this.wanderDirection.normalize();
        }
        this.wanderTimer = WANDER_CHANGE_INTERVAL * (0.5 + Math.random());
      }
      this.body.velocity.x = this.wanderDirection.x * ENEMY_WANDER_SPEED;
      this.body.velocity.z = this.wanderDirection.z * ENEMY_WANDER_SPEED;
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
    //this.body.velocity.y = 4;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
  }
}

export default Enemy;
