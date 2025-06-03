import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { defaultMaterial } from '../core/settings.js';
import { GameState } from '../core/settings.js';
import { UI, TURRET_COST } from '../ui/uiManager.js';
import { Bullet } from './bullet.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TURRET_RANGE = 5;
const TURRET_COOLDOWN = 0.8;
const RING_THICKNESS = 0.15;
const TURRET_SCALE = 0.07;

export class Turret {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.isDragging = false;
        this.previewTurret = null;
        this.previewPosition = new THREE.Vector3();
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        this.loader = new GLTFLoader();
        this.loadedTurretModel = null; // Add this line
        this.animationMixers = new Map(); // Add this line
        
        // Preload the turret model
        this.loader.load('/assets/turret.glb', (gltf) => {
            this.loadedTurretModel = gltf.scene;
            // Store the shoot animation
            this.shootAnimation = gltf.animations.find(anim => anim.name === "SHOOT_ANIM");
        });

        this.previewMaterial = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.6
        });
        this.solidMaterial = new THREE.MeshStandardMaterial({
            color: 0x9292D0
        });
        this.ROTATION_SPEED = 5; // Add this line
        this.placedTurrets = [];
        this.lastAimedAngles = new Map(); // Store last rotation for each turret
        this.rangeGeometry = new THREE.RingGeometry(TURRET_RANGE - RING_THICKNESS, TURRET_RANGE, 64);
        this.rangeMaterial = new THREE.MeshBasicMaterial({
            color: 0x9292D0,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        this.bullets = [];
    }

    startDragging() {
        if (GameState.score < TURRET_COST) {
            document.getElementById('place-cube-btn').classList.add('disabled');
            return false;
        }
        document.getElementById('place-cube-btn').classList.remove('disabled');
        
        if (!this.previewTurret) {
            if (this.loadedTurretModel) {
                this.previewTurret = this.loadedTurretModel.clone();
                this.previewTurret.scale.set(TURRET_SCALE, TURRET_SCALE, TURRET_SCALE);
                this.previewTurret.traverse((child) => {
                    if (child.isMesh) {
                        // Keep original material but make it transparent
                        child.material = child.material.clone();
                        child.material.transparent = true;
                        child.material.opacity = 0.6;
                    }
                });
                this.previewTurret.position.copy(this.previewPosition);
                this.scene.add(this.previewTurret);
            } else {
                // Fallback to temporary box if model hasn't loaded yet
                const tempGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                this.previewTurret = new THREE.Mesh(tempGeometry, this.previewMaterial);
                this.scene.add(this.previewTurret);
            }
        }
        this.isDragging = true;
        return true;
    }

    updateDragPosition(raycaster) {
        if (!this.isDragging) return;
        
        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            // Round to grid
            intersectPoint.x = Math.round(intersectPoint.x);
            intersectPoint.z = Math.round(intersectPoint.z);
            intersectPoint.y = 0;
            this.previewPosition.copy(intersectPoint);
            if (this.previewTurret) {
                this.previewTurret.position.copy(this.previewPosition);
            }
        }
    }

    placeCube() {
        if (!this.isDragging || !this.previewTurret || GameState.score < TURRET_COST) return false;
        
        if (!UI.addScore(-TURRET_COST)) {
            return false;
        }
        
        if (this.loadedTurretModel) {
            const turretModel = this.loadedTurretModel.clone();
            turretModel.scale.set(TURRET_SCALE, TURRET_SCALE, TURRET_SCALE);
            turretModel.position.copy(this.previewPosition);
            turretModel.traverse((child) => {
                if (child.isMesh) {
                    // Keep original materials
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(turretModel);

            // Add range indicator
            const rangeIndicator = new THREE.Mesh(this.rangeGeometry, this.rangeMaterial);
            rangeIndicator.rotation.x = -Math.PI / 2;
            rangeIndicator.position.copy(turretModel.position);
            rangeIndicator.position.y = 0.1;
            this.scene.add(rangeIndicator);

            // Add physics
            const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
            const body = new CANNON.Body({
                mass: 0,
                material: defaultMaterial,
                shape: shape,
                collisionFilterGroup: 1,
                collisionFilterMask: 1
            });
            body.position.copy(turretModel.position);
            this.world.addBody(body);

            // Create animation mixer for this turret
            const mixer = new THREE.AnimationMixer(turretModel);
            if (this.shootAnimation) {
                const action = mixer.clipAction(this.shootAnimation);
                action.setLoop(THREE.LoopOnce);
                action.clampWhenFinished = true;
            }
            this.animationMixers.set(turretModel, mixer);

            this.placedTurrets.push({
                mesh: turretModel,
                body: body,
                range: rangeIndicator,
                lastShot: 0
            });
        }

        UI.updateScoreUI();
        this.scene.remove(this.previewTurret);
        this.previewTurret = null;
        this.isDragging = false;
        return true;
    }

    update(deltaTime, enemies) {
        // Update animation mixers
        this.animationMixers.forEach(mixer => mixer.update(deltaTime));

        const currentTime = performance.now() / 1000;
        
        // Update existing bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            let isAlive = bullet.update(deltaTime);
            
            // Check for collisions
            for (const enemy of enemies) {
                if (bullet.checkCollision(enemy)) {
                    enemy.hitByShot();
                    UI.addScore(10);
                    isAlive = false;
                    break;
                }
            }
            
            if (!isAlive) {
                bullet.dispose(this.scene);
                this.bullets.splice(i, 1);
            }
        }

        // Update turrets
        this.placedTurrets.forEach(turret => {
            let closestEnemy = null;
            let closestDistance = TURRET_RANGE;

            enemies.forEach(enemy => {
                // Skip dead enemies (dark red)
                if (enemy.isRigid || enemy.timeSinceHit !== null) return;
                
                const distance = turret.mesh.position.distanceTo(enemy.mesh.position);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            });

            // Get current angle and target angle
            let currentAngle = turret.mesh.rotation.y % (Math.PI * 2);
            let targetAngle;

            if (closestEnemy) {
                const direction = new THREE.Vector3()
                    .subVectors(closestEnemy.mesh.position, turret.mesh.position)
                    .normalize();
                targetAngle = Math.atan2(direction.x, direction.z);
                // Store the last aimed angle when we have a target
                this.lastAimedAngles.set(turret, targetAngle);
            } else {
                // Use last aimed angle or current angle if no last angle exists
                targetAngle = this.lastAimedAngles.get(turret) || currentAngle;
            }

            // Smooth rotation
            let angleDiff = targetAngle - currentAngle;

            // Handle angle wrap-around
            if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Apply smooth rotation
            turret.mesh.rotation.y += angleDiff * this.ROTATION_SPEED * deltaTime;

            // Fire only if we have an enemy and are aimed correctly
            if (closestEnemy && currentTime - turret.lastShot >= TURRET_COOLDOWN) {
                const direction = new THREE.Vector3()
                    .subVectors(closestEnemy.mesh.position, turret.mesh.position)
                    .normalize();
                
                // Create bullet at turret position
                const bulletPos = turret.mesh.position.clone().add(direction.multiplyScalar(0.6));
                bulletPos.y += 0.5;
                this.bullets.push(new Bullet(bulletPos, direction, this.scene));
                
                // Play shoot animation
                const mixer = this.animationMixers.get(turret.mesh);
                if (mixer && this.shootAnimation) {
                    const action = mixer.clipAction(this.shootAnimation);
                    action.reset();
                    action.play();
                }
                
                turret.lastShot = currentTime;
            }
        });
    }
    
    cancelDragging() {
        if (this.previewTurret) {
            this.scene.remove(this.previewTurret);
            this.previewTurret = null;
        }
        this.isDragging = false;
    }
}
