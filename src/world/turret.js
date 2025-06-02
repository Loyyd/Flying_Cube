import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { defaultMaterial } from '../core/settings.js';
import { GameState } from '../core/settings.js';
import { UI } from '../ui/uiManager.js';
import { Bullet } from './bullet.js';

const CUBE_COST = 50;
const TURRET_RANGE = 5;
const TURRET_COOLDOWN = 0.8;
const RING_THICKNESS = 0.15;

export class Turret {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.isDragging = false;
        this.previewCube = null;
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x9292D0,
            transparent: true,
            opacity: 0.6
        });
        this.solidCubeMaterial = new THREE.MeshStandardMaterial({
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
        if (GameState.score < CUBE_COST) return false;
        
        if (!this.previewCube) {
            this.previewCube = new THREE.Mesh(this.cubeGeometry, this.cubeMaterial);
            this.previewCube.castShadow = true;
            this.scene.add(this.previewCube);
        }
        this.isDragging = true;
        return true;
    }

    updateDragPosition(raycaster) {
        if (!this.isDragging || !this.previewCube) return;
        
        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(this.groundPlane, intersectPoint)) {
            // Round to grid
            intersectPoint.x = Math.round(intersectPoint.x);
            intersectPoint.z = Math.round(intersectPoint.z);
            intersectPoint.y = 0.5; // Half height of cube
            this.previewCube.position.copy(intersectPoint);
        }
    }

    placeCube() {
        if (!this.isDragging || !this.previewCube || GameState.score < CUBE_COST) return false;
        
        // Create physical cube
        const cube = new THREE.Mesh(this.cubeGeometry, this.solidCubeMaterial);
        cube.position.copy(this.previewCube.position);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);

        // Add range indicator
        const rangeIndicator = new THREE.Mesh(this.rangeGeometry, this.rangeMaterial);
        rangeIndicator.rotation.x = -Math.PI / 2;
        rangeIndicator.position.copy(cube.position);
        rangeIndicator.position.y = 0.1;
        this.scene.add(rangeIndicator);

        // Add physics with collision
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        const body = new CANNON.Body({
            mass: 0,
            material: defaultMaterial,
            shape: shape,
            collisionFilterGroup: 1,
            collisionFilterMask: 1
        });
        body.position.copy(cube.position);
        this.world.addBody(body);

        // Store turret data
        this.placedTurrets.push({
            mesh: cube,
            body: body,
            range: rangeIndicator,
            lastShot: 0
        });

        // Deduct cost
        UI.addScore(-CUBE_COST);
        UI.updateScoreUI();

        // Reset preview
        this.scene.remove(this.previewCube);
        this.previewCube = null;
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
                
                // Create bullet at turret position
                const bulletPos = turret.mesh.position.clone().add(direction.multiplyScalar(0.6));
                this.bullets.push(new Bullet(bulletPos, direction, this.scene));
                
                turret.lastShot = currentTime;

                // Visual feedback for shot
                const material = turret.mesh.material;
                material.color.setHex(0xff0000);
                setTimeout(() => material.color.setHex(0x4444ff), 100);
            }
        });
    }
    
    cancelDragging() {
        if (this.previewCube) {
            this.scene.remove(this.previewCube);
            this.previewCube = null;
        }
        this.isDragging = false;
    }
}
