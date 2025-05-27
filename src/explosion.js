import * as THREE from 'three';

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
        this.size = randomRange(0.8, 1.7);
        this.lifetime = randomRange(0.8, 1.2);
        this.velocity = new THREE.Vector3(
          randomRange(-0.5, 0.5), randomRange(1.2, 2.2), randomRange(-0.5, 0.5)
        );
        this.opacity = 0.8;
        break;
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
        this.size = randomRange(0.15, 0.25);
        this.lifetime = randomRange(0.2, 0.5);
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
  update(delta, gravity = -9.8) {
    this.trail.push(this.position.clone());
    while (this.trail.length > 8) this.trail.shift();

    this.age += delta;
    this.lastPosition.copy(this.position);

    // Physics
    if (this.type === "smoke") {
      this.velocity.multiplyScalar(0.96); // Slow drift
    }
    if (this.type === "fire") {
      this.velocity.multiplyScalar(0.95);
      this.opacity *= 0.97;
    }
    if (this.type === "spark") {
      this.velocity.y += gravity * delta * 2.5;
      this.opacity *= 0.93;
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
  constructor(position, scene) {
    this.position = position.clone();
    this.scene = scene;
    this.particles = [];

    // Emit fire
    for (let i = 0; i < 12; i++) {
      let p = new ExplosionParticle("fire", this.position);
      p.mesh = this.makeSprite(p.color, p.size, p.opacity, "fire");
      scene.add(p.mesh);
      this.particles.push(p);
    }

    // Emit sparks
    for (let i = 0; i < 16; i++) {
      let p = new ExplosionParticle("spark", this.position);
      p.mesh = this.makeSprite(p.color, p.size, p.opacity, "spark");
      scene.add(p.mesh);
      this.particles.push(p);
    }

    // Emit smoke
    for (let i = 0; i < 9; i++) {
      let p = new ExplosionParticle("smoke", this.position);
      p.mesh = this.makeSprite(p.color, p.size, p.opacity, "smoke");
      scene.add(p.mesh);
      this.particles.push(p);
    }

    // Trails are rendered as lines, stored as {line, particle} objects
    this.trails = [];
  }

  makeSprite(color, size, opacity, type) {
    // Use a circle for all, but could use textures for more realism!
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