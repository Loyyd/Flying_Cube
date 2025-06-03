import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { defaultMaterial } from '../core/settings.js';
import { GameState } from '../core/settings.js';
import { UI } from '../ui/uiManager.js';
import { Bullet } from './bullet.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const TURRET_COST = 500;
const TURRET_RANGE = 5;
const TURRET_COOLDOWN = 0.8;
const RING_THICKNESS = 0.15;

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
        
        // Preload the turret model
        this.loader.load('/assets/turret.glb', (gltf) => {
            this.loadedTurretModel = gltf.scene;
        });

        this.previewMaterial = new THREE.MeshStandardMaterial({
            transparent: true,
            opacity: 0.6
        });
        this.solidMaterial = new THREE.MeshStandardMaterial({
            color: 0x9292D0
        });
        this.placedTurrets = [];
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
                this.previewTurret.scale.set(0.1, 0.1, 0.1);  // 3x smaller
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
            turretModel.scale.set(0.1, 0.1, 0.1);  // 3x smaller
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
                if (enemy.isRigid) return;
                
                const distance = turret.mesh.position.distanceTo(enemy.mesh.position);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestEnemy = enemy;
                }
            });

            if (closestEnemy && currentTime - turret.lastShot >= TURRET_COOLDOWN) {
                // Create direction vector to enemy
                const direction = new THREE.Vector3()
                    .subVectors(closestEnemy.mesh.position, turret.mesh.position)
                    .normalize();
                
                // Rotate turret towards enemy
                const angle = Math.atan2(direction.x, direction.z);
                turret.mesh.rotation.y = angle;

                // Create bullet at turret position
                const bulletPos = turret.mesh.position.clone().add(direction.multiplyScalar(0.6));
                this.bullets.push(new Bullet(bulletPos, direction, this.scene));
                
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
