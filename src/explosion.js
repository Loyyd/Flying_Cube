import * as THREE from 'three';
import * as CANNON from 'cannon-es'; // Ensure CANNON.js is imported

// Constants
const GRAVITY = -9.8;
const MAX_TRAIL_LENGTH = 8;

// Toggle options
const ENABLE_FIRE = false;
const ENABLE_SPARK = true;
const ENABLE_SMOKE = true;

// Particle counts
const FIRE_PARTICLE_COUNT = 12;
const SPARK_PARTICLE_COUNT = 20;
const SMOKE_PARTICLE_COUNT = 9;

// Opacity decay rates
const FIRE_OPACITY_DECAY = 0.97;
const SPARK_OPACITY_DECAY = 0.93;

// Velocity multipliers
const SMOKE_VELOCITY_MULTIPLIER = 0.96;
const FIRE_VELOCITY_MULTIPLIER = 0.95;

// Spark properties
const SPARK_SIZE_RANGE = { min: 1.0, max: 2.0 };
const SPARK_LIFETIME_RANGE = { min: 0.3, max: 0.6 };

// Particle size multipliers (change these to scale all particles)
export const PARTICLE_SIZE_MULTIPLIER = {
  smoke: 0.0,
  fire: 0.0,
  spark: 0.0
};

// Helper: Random float in range
function randomRange(a, b) {
  return Math.random() * (b - a) + a;
}

class ExplosionParticle {
  constructor(type, position) {
    this.type = type; // "smoke" | "fire" | "spark"
    this.age = 0;
    this.trail = [];

    // Particle properties by type
    switch (type) {
      case "smoke":
        this.color = new THREE.Color(0x444444).lerp(new THREE.Color(0xAAAAAA), Math.random());
        //this.size = randomRange(0.8, 1.7) * PARTICLE_SIZE_MULTIPLIER.smoke;
        this.lifetime = randomRange(0.8, 1.2);
        this.velocity = new THREE.Vector3(
          randomRange(-0.5, 0.5), randomRange(1.2, 2.2), randomRange(-0.5, 0.5)
        );
        this.opacity = 0.8;
        break;
      case "fire":
        this.color = new THREE.Color().setHSL(randomRange(0.03, 0.09), 1, randomRange(0.48, 0.57)); // orange/yellow/red
        //this.size = randomRange(0.5, 1.1) * PARTICLE_SIZE_MULTIPLIER.fire;
        this.lifetime = randomRange(0.3, 0.6);
        this.velocity = new THREE.Vector3(
          randomRange(-2, 2), randomRange(3, 5), randomRange(-2, 2)
        );
        this.opacity = 1.0;
        break;
      case "spark":
        this.color = new THREE.Color(0xffee88).lerp(new THREE.Color(0xffdd33), Math.random());
        //this.size = randomRange(SPARK_SIZE_RANGE.min, SPARK_SIZE_RANGE.max) * PARTICLE_SIZE_MULTIPLIER.spark;
        this.lifetime = randomRange(SPARK_LIFETIME_RANGE.min, SPARK_LIFETIME_RANGE.max);
        this.velocity = new THREE.Vector3(
          randomRange(-4, 4), randomRange(3, 8), randomRange(-4, 4)
        );
        this.opacity = 1.0;
        break;
    }

    this.position = position.clone();
    this.lastPosition = this.position.clone();
    this.mesh = null;
    this.trailSegments = [];
  }

  // Call after mesh assignment!
  update(delta) {
    this.trail.push(this.position.clone());
    while (this.trail.length > MAX_TRAIL_LENGTH) this.trail.shift();

    this.age += delta;
    this.lastPosition.copy(this.position);

    // Physics
    if (this.type === "smoke") {
      this.velocity.multiplyScalar(SMOKE_VELOCITY_MULTIPLIER); // Slow drift
    }
    if (this.type === "fire") {
      this.velocity.multiplyScalar(FIRE_VELOCITY_MULTIPLIER);
      this.opacity *= FIRE_OPACITY_DECAY;
    }
    if (this.type === "spark") {
      this.velocity.y += GRAVITY * delta * 2.5;
      this.opacity *= SPARK_OPACITY_DECAY;
    }

    this.position.addScaledVector(this.velocity, delta);

    // Visuals
    if (this.mesh) {
      this.mesh.position.copy(this.position);
      this.mesh.scale.setScalar(this.size * (1 - this.age / this.lifetime));
      this.mesh.material.opacity = this.opacity * (1 - this.age / this.lifetime);
      this.mesh.material.color.copy(this.color);
    }
  }

  isDead() {
    return this.age > this.lifetime || this.opacity < 0.05;
  }
}

export class Explosion {
  constructor(position, scene, world, radius = 2) {
    this.position = position.clone();
    this.scene = scene;
    this.world = world;
    this.particles = [];
    this.radius = radius;

    // --- Make spark count scale with radius, but only spark size is increased ---
    const sparkCount = Math.round(20 * (this.radius / 2)); // Default: 20 at radius=2
    const sparkSizeMin = 1.0 * (this.radius / 2);
    const sparkSizeMax = 2.0 * (this.radius / 2);

    // Emit fire
    if (ENABLE_FIRE) {
      for (let i = 0; i < FIRE_PARTICLE_COUNT; i++) {
        let p = new ExplosionParticle("fire", this.position);
        p.mesh = this.makeSprite(p.color, p.size, p.opacity, "fire");
        scene.add(p.mesh);
        this.particles.push(p);
      }
    }

    // Emit sparks (only size scaled)
    if (ENABLE_SPARK) {
      for (let i = 0; i < SPARK_PARTICLE_COUNT; i++) {
        let p = new ExplosionParticle("spark", this.position);
        // Scale spark size for this explosion
        p.size = randomRange(sparkSizeMin, sparkSizeMax);
        p.mesh = this.makeSprite(p.color, p.size, p.opacity, "spark");
        scene.add(p.mesh);
        this.particles.push(p);
      }
    }

    // Emit smoke
    if (ENABLE_SMOKE) {
      for (let i = 0; i < SMOKE_PARTICLE_COUNT; i++) {
        let p = new ExplosionParticle("smoke", this.position);
        p.mesh = this.makeSprite(p.color, p.size, p.opacity, "smoke");
        scene.add(p.mesh);
        this.particles.push(p);
      }
    }

    // Apply impulse to nearby rigid bodies
    this.applyImpulseToRigidBodies();

    // Trails are rendered as lines, stored as {line, particle} objects
    this.trails = [];
  }

  applyImpulseToRigidBodies() {
    // Explosion force and radius scale with this.radius
    const explosionForce = 3 * this.radius; // Strength of the explosion
    const explosionRadius = this.radius;    // Radius of the explosion effect

    this.world.bodies.forEach(body => {
      if (body.position) {
        const bodyPosition = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
        const explosionPosition = new CANNON.Vec3(this.position.x, this.position.y, this.position.z);

        const distance = bodyPosition.distanceTo(explosionPosition);

        if (distance < explosionRadius) {
          const forceDirection = bodyPosition.vsub(explosionPosition); // Subtract positions
          forceDirection.normalize(); // Normalize the direction vector
          const forceMagnitude = explosionForce * (1 - distance / explosionRadius); // Decrease force with distance
          const impulse = forceDirection.scale(forceMagnitude); // Scale the normalized vector

          body.applyImpulse(impulse, bodyPosition);
        }
      }
    });
  }

  makeSprite(color, size, opacity, type) {
    // Scale the sprite size with explosion radius
    let scaledSize = size * (this.radius / 2); // Default radius=2, so scale=1 if radius=2
    let mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false
    });
    let geo = new THREE.SphereGeometry(scaledSize, 8, 8);
    if (type === "spark") {
      geo = new THREE.SphereGeometry(scaledSize * 0.42, 6, 6);
    }
    let mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.position);
    return mesh;
  }

  update(delta) {
    // Update particles
    for (let p of this.particles) {
      p.update(delta);
    }

    // Remove dead particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].isDead()) {
        this.scene.remove(this.particles[i].mesh);
        this.particles[i].mesh.geometry.dispose();
        this.particles[i].mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update trails for sparks (fire/smoke can have faint trails too if desired)
    for (let t of this.trails) {
      this.scene.remove(t.line);
    }
    this.trails = [];
    for (let p of this.particles) {
      if (p.type === "spark" && p.trail.length > 1) {
        let points = p.trail.map(trailPos => trailPos.clone());
        let trailGeo = new THREE.BufferGeometry().setFromPoints(points);
        let trailMat = new THREE.LineBasicMaterial({
          color: p.color.clone().lerp(new THREE.Color(0x222222), 0.65),
          transparent: true,
          opacity: 0.4
        });
        let line = new THREE.Line(trailGeo, trailMat);
        this.scene.add(line);
        this.trails.push({ line, particle: p });
      }
    }
  }

  isFinished() {
    return this.particles.length === 0;
  }

  dispose() {
    for (let t of this.trails) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
    }
    for (let p of this.particles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.trails = [];
    this.particles = [];
  }
}