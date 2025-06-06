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
  defaultMaterial,
  DEBUG_MODE,
  GOD_MODE,
  PLAYER_SIZE,
  PLAYER_BOX_HALF_EXTENTS
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
      this.model.rotation.y = Math.PI; // Make model face forward initially
      this.mesh.add(this.model);

      // Setup animations
      this.mixer = new THREE.AnimationMixer(this.model);
      const wingAnimation = gltf.animations.find(clip => clip.name === 'WING');
      const deadAnimation = gltf.animations.find(clip => clip.name === 'DEAD');
      
      if (wingAnimation) {
        this.wingAction = this.mixer.clipAction(wingAnimation);
        this.wingAction.play();
        this.wingAction.time = Math.random() * wingAnimation.duration;
        this.wingAction.paused = true;
      }
      
      if (deadAnimation) {
        this.deadAction = this.mixer.clipAction(deadAnimation);
        this.deadAction.setLoop(THREE.LoopOnce);
        this.deadAction.clampWhenFinished = true;
        // Initialize but don't play yet
        this.deadAction.play().stop();
      }
    });

    // Physics - Changed to sphere
    const shape = new CANNON.Sphere(ENEMY_RADIUS);
    this.body = new CANNON.Body({ mass: 1, material: defaultMaterial });
    this.body.addShape(shape);
    this.body.position.set(0, ENEMY_RADIUS * 2, 0);
    this.world.addBody(this.body);
    
    this.body.linearDamping = 0.1;
    this.body.angularDamping = 0.1;
    
    // Create a circular shadow below the enemy
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(ENEMY_RADIUS * 0.7, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.5, transparent: true })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.set(this.body.position.x, 0.05, this.body.position.z);
    this.scene.add(this.shadow);
    
    // Add debug hitbox visualization if in debug mode
    this.debugHitbox = null;
    if (DEBUG_MODE) {
      const hitboxGeometry = new THREE.SphereGeometry(ENEMY_RADIUS, 16, 16);
      const hitboxMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.5
      });
      this.debugHitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
      this.debugHitbox.position.copy(this.body.position);
      this.scene.add(this.debugHitbox);
    }
    
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
    if (this.mixer) {
      this.mixer.update(deltaTime);
    }
    
    // Update shadow position to always be below the enemy
    if (this.shadow) {
      this.shadow.position.set(this.body.position.x, 0.05, this.body.position.z);
    }
    
    if (this.timeSinceHit !== null) {
      this.timeSinceHit += deltaTime;
      if (this.timeSinceHit >= 5) {
        // Remove shadow when disposing
        if (this.shadow) {
          this.scene.remove(this.shadow);
          if (this.shadow.geometry) this.shadow.geometry.dispose();
          if (this.shadow.material) this.shadow.material.dispose();
          this.shadow = null;
        }
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

    // Check if enemy collided with player
    // AABB collision check
    const playerPos = this.player.position;
    const enemyPos = this.body.position;

    // Find closest point on box to sphere center
    const closestPoint = new CANNON.Vec3(
      Math.min(Math.max(enemyPos.x, playerPos.x - PLAYER_BOX_HALF_EXTENTS.x), playerPos.x + PLAYER_BOX_HALF_EXTENTS.x),
      Math.min(Math.max(enemyPos.y, playerPos.y - PLAYER_BOX_HALF_EXTENTS.y), playerPos.y + PLAYER_BOX_HALF_EXTENTS.y),
      Math.min(Math.max(enemyPos.z, playerPos.z - PLAYER_BOX_HALF_EXTENTS.z), playerPos.z + PLAYER_BOX_HALF_EXTENTS.z)
    );

    // Calculate distance between closest point and sphere center
    const distance = Math.sqrt(
      Math.pow(closestPoint.x - enemyPos.x, 2) +
      Math.pow(closestPoint.y - enemyPos.y, 2) +
      Math.pow(closestPoint.z - enemyPos.z, 2)
    );

    const colliding = distance < ENEMY_RADIUS;

    if (colliding) {
      // Call the game over function from GameState
      if (window.gameOver && !GOD_MODE) {
        window.gameOver();
      }
    }

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
    
    // Update only position from physics
    this.mesh.position.copy(this.body.position);
    
    // Update debug hitbox if it exists
    if (this.debugHitbox) {
      this.debugHitbox.position.copy(this.body.position);
    }
    
    // Rotate model to face movement direction
    if (Math.abs(targetVelX) > 0.01 || Math.abs(targetVelZ) > 0.01) {
      const angle = Math.atan2(targetVelX, targetVelZ);
      this.mesh.rotation.y = angle;
    }

    // Check if moving and update animation state
    const isMoving = Math.abs(targetVelX) > 0.01 || Math.abs(targetVelZ) > 0.01;
    if (this.wingAction) {
      this.wingAction.paused = !isMoving;
    }
  }

  hitByShot() {
    if (this.timeSinceHit !== null) return;

    // Remove shadow when hit
    if (this.shadow) {
        this.scene.remove(this.shadow);
        if (this.shadow.geometry) this.shadow.geometry.dispose();
        if (this.shadow.material) this.shadow.material.dispose();
        this.shadow = null;
    }

    // Stop all animations and play dead animation
    if (this.mixer) {
        this.mixer.stopAllAction();
        if (this.deadAction) {
            this.deadAction.reset();
            this.deadAction.setEffectiveTimeScale(1);
            this.deadAction.setEffectiveWeight(1);
            this.deadAction.play();
        }
    }

    // Start timer for disposal
    this.timeSinceHit = 0;

    // Add impulse from shot
    const randomImpulse = new CANNON.Vec3(
        (Math.random() - 0.5) * 10,
        5,
        (Math.random() - 0.5) * 10
    );
    this.body.applyImpulse(randomImpulse);
  }

  dispose() {
    if (this._disposed) return;
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
    
    // Remove and dispose shadow
    if (this.shadow) {
      this.scene.remove(this.shadow);
      if (this.shadow.geometry) this.shadow.geometry.dispose();
      if (this.shadow.material) this.shadow.material.dispose();
    }
    
    // Remove and dispose debug hitbox
    if (this.debugHitbox) {
      this.scene.remove(this.debugHitbox);
      if (this.debugHitbox.geometry) this.debugHitbox.geometry.dispose();
      if (this.debugHitbox.material) this.debugHitbox.material.dispose();
      this.debugHitbox = null;
    }
    
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
    
    this._disposed = true;
  }
}

export default Enemy;
