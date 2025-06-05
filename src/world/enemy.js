import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
    this.mixer = null;
    this.model = null;

    // Create a temporary invisible mesh
    const tempGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const tempMaterial = new THREE.MeshBasicMaterial({ visible: false });
    this.mesh = new THREE.Mesh(tempGeometry, tempMaterial);
    this.scene.add(this.mesh);

    // Load the model
    const loader = new GLTFLoader();
    loader.load('/assets/enemy.glb', (gltf) => {
      this.model = gltf.scene;
      this.model.scale.set(0.4, 0.4, 0.4);
      this.mesh.add(this.model);

      // Setup animations
      this.mixer = new THREE.AnimationMixer(this.model);
      const wingAnimation = gltf.animations.find(clip => clip.name === 'WING');
      const deadAnimation = gltf.animations.find(clip => clip.name === 'DEAD');
      
      if (wingAnimation) {
        this.wingAction = this.mixer.clipAction(wingAnimation);
        this.wingAction.play();
        this.wingAction.paused = true; // Start paused
      }
      
      if (deadAnimation) {
        this.deadAction = this.mixer.clipAction(deadAnimation);
        this.deadAction.setLoop(THREE.LoopOnce);
        this.deadAction.clampWhenFinished = true;
      }
    });

    // Physics - Changed to sphere
    const shape = new CANNON.Sphere(ENEMY_RADIUS);
    this.body = new CANNON.Body({ mass: 1, material: defaultMaterial });
    this.body.addShape(shape);
    this.body.position.set(0, ENEMY_RADIUS * 2, 0); // Raised position to stand
    this.world.addBody(this.body);
    
    // Moderate damping to prevent excessive bouncing
    this.body.linearDamping = 0.1;
    this.body.angularDamping = 0.1;

    this.wanderTarget = this._getRandomWanderTarget();
    this.wanderTimer = 0;
    this.timeSinceHit = null;

    // Add collision sphere visualization
    const sphereGeometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    this.collisionHelper = new THREE.Mesh(sphereGeometry, wireframeMaterial);
    this.collisionHelper.visible = true;  // Set initially visible
    scene.add(this.collisionHelper);
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
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }

    if (this.timeSinceHit !== null) {
      this.timeSinceHit += deltaTime;
      if (this.timeSinceHit >= 5) {
        this.dispose();
        this._disposed = true;
        return;
      }
      
      // Stop animation when hit
      if (this.wingAction) {
        this.wingAction.paused = true;
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

    // Update collision helper position
    if (this.collisionHelper) {
      this.collisionHelper.position.copy(this.body.position);
    }

    // Check if moving and update animation state
    const isMoving = Math.abs(targetVelX) > 0.01 || Math.abs(targetVelZ) > 0.01;
    if (this.wingAction) {
      this.wingAction.paused = !isMoving;
    }
  }

  hitByShot() {
    if (this.timeSinceHit !== null) return;
    
    // Stop wing animation and play dead animation
    if (this.wingAction) {
      this.wingAction.stop();
    }
    if (this.deadAction) {
      this.deadAction.reset().play();
    }
    
    // Change color to dark red
    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(DARK_RED);
        }
      });
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
    
    if (this.model) {
      this.model.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }
    
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material) this.mesh.material.dispose();
    
    if (this.collisionHelper) {
      this.scene.remove(this.collisionHelper);
      this.collisionHelper.geometry.dispose();
      this.collisionHelper.material.dispose();
    }
    
    this._disposed = true;
  }

  toggleCollisionBox(visible) {
    if (this.collisionHelper) {
      this.collisionHelper.visible = visible;
    }
  }
}

export default Enemy;
