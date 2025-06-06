import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Constants
const GRAVITY = -9.8;
const MAX_TRAIL_LENGTH = 8;

// Particle counts
const FIRE_PARTICLE_COUNT = 12;
const SPARK_PARTICLE_COUNT = 20;

// Opacity decay rates
const FIRE_OPACITY_DECAY = 0.97;
const SPARK_OPACITY_DECAY = 0.93;

// Velocity multipliers
const FIRE_VELOCITY_MULTIPLIER = 0.95;

// Spark properties
const SPARK_SIZE_RANGE = { min: 1.0, max: 2.0 };
const SPARK_LIFETIME_RANGE = { min: 0.3, max: 0.6 };

// Explosion parameters
const explosionForce = 1;
const explosionRadius = 1;

// Helper: Random float in range
function randomRange(a, b) {
  return Math.random() * (b - a) + a;
}

class ExplosionParticle {
  constructor(type, position, multiplier = 1) {
    this.type = type;
    this.age = 0;
    this.trail = [];
    this.multiplier = multiplier;

    // Particle properties by type
    switch (type) {
      case "fire":
        this.color = new THREE.Color().setHSL(randomRange(0.03, 0.09), 1, randomRange(0.48, 0.57)); // orange/yellow/red
        this.size = randomRange(0.5, 1.1);
        this.lifetime = randomRange(0.3, 0.6);
        this.velocity = new THREE.Vector3(
          randomRange(-2, 2), randomRange(3, 5), randomRange(-2, 2)
        );
        this.opacity = 1.0;
        break;
      case "spark":
        this.color = new THREE.Color(0xffee88).lerp(new THREE.Color(0xffdd33), Math.random());
        this.size = randomRange(SPARK_SIZE_RANGE.min*multiplier, SPARK_SIZE_RANGE.max*multiplier);
        this.lifetime = randomRange(SPARK_LIFETIME_RANGE.min*multiplier, SPARK_LIFETIME_RANGE.max*multiplier);
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
  constructor(position, scene, world, radius) {
    this.position = position.clone();
    this.scene = scene;
    this.world = world;
    this.radius = radius
    this.particles = [];
    this.age = 0; // Add timer to track explosion age
    // Scale particle count based on explosion size for performance
    const fireCount = Math.min(FIRE_PARTICLE_COUNT, Math.floor(FIRE_PARTICLE_COUNT * radius));
    const sparkCount = Math.min(SPARK_PARTICLE_COUNT, Math.floor(SPARK_PARTICLE_COUNT * radius));

    // Emit fire
    for (let i = 0; i < fireCount; i++) {
      let p = new ExplosionParticle("fire", this.position, radius);
      p.mesh = this.makeSprite(p.color, p.size*radius, p.opacity, "fire");
      scene.add(p.mesh);
      this.particles.push(p);
    }

    // Emit sparks
    for (let i = 0; i < sparkCount; i++) {
      let p = new ExplosionParticle("spark", this.position);
      p.mesh = this.makeSprite(p.color, p.size*radius, p.opacity, "spark");
      scene.add(p.mesh);
      this.particles.push(p);
    }

    // Apply impulse to nearby rigid bodies
    this.applyImpulseToRigidBodies(explosionForce*radius, explosionRadius*radius); 

    // Trails are rendered as lines, stored as {line, particle} objects
    this.trails = [];
  }

  applyImpulseToRigidBodies(force, radius) {
    this.world.bodies.forEach(body => {
      if (body.position) {
        const bodyPosition = new CANNON.Vec3(body.position.x, body.position.y, body.position.z);
        const explosionPosition = new CANNON.Vec3(this.position.x, this.position.y, this.position.z);

        const distance = bodyPosition.distanceTo(explosionPosition);

        if (distance < radius) {
          const forceDirection = bodyPosition.vsub(explosionPosition);
          forceDirection.normalize();
          const forceMagnitude = force * (1 - distance / radius);
          const impulse = forceDirection.scale(forceMagnitude);
          body.applyImpulse(impulse, body.position);
        }
      }
    });
  }

  makeSprite(color, size, opacity, type) {
    let mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      depthWrite: false
    });
    let geo = new THREE.SphereGeometry(size, 8, 8);
    if (type === "spark") {
      geo = new THREE.SphereGeometry(size * 0.42, 6, 6);
    }
    let mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.position);
    return mesh;
  }
  // Add update counter to avoid updating trails every frame
  frameCounter = 0;

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

    // Only update trails every 3 frames for performance
    this.frameCounter = (this.frameCounter + 1) % 3;
    if (this.frameCounter === 0 && this.particles.length > 0) {
      // Update trails for sparks
      for (let t of this.trails) {
        this.scene.remove(t.line);
      }
      this.trails = [];
      
      // Only create trails for a subset of particles
      for (let i = 0; i < this.particles.length; i += 2) {
        const p = this.particles[i];
        if (p.type === "spark" && p.trail.length > 1) {
          let points = p.trail.map(trailPos => trailPos.clone());
          let trailGeo = new THREE.BufferGeometry().setFromPoints(points);
          let trailMat = new THREE.LineBasicMaterial({
            color: p.color.clone().lerp(new THREE.Color(0x222222), 0.65),
            transparent: true,
            opacity: 0.3
          });
          let line = new THREE.Line(trailGeo, trailMat);
          this.scene.add(line);
          this.trails.push({ line, particle: p });
        }
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