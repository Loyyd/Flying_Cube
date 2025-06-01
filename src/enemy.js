import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const ENEMY_RADIUS = 0.5;
const ENEMY_SPEED = 8.0; // Higher = more aggressive following

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
    // Spawn at random position
    this.body.position.set(
      Math.random() * 40 - 20,
      ENEMY_RADIUS,
      Math.random() * 40 - 20
    );
    this.world.addBody(this.body);

    // Sync mesh to body
    this.mesh.position.copy(this.body.position);
  }

  update(deltaTime) {
    // Move towards player (apply force)
    const target = new CANNON.Vec3(
      this.player.position.x,
      this.body.position.y,
      this.player.position.z
    );
    const direction = target.vsub(this.body.position);
    direction.y = 0; // Stay on ground
    if (direction.length() > 0.01) {
      direction.normalize();
      direction.scale(ENEMY_SPEED, direction);
      this.body.velocity.x += direction.x * deltaTime;
      this.body.velocity.z += direction.z * deltaTime;
    }

    // Sync mesh to body
    this.mesh.position.copy(this.body.position);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
  }
}

export default Enemy;
