import * as THREE from 'three';
import { 
    Bullet, 
    BULLET_GEOMETRY, 
    BULLET_MATERIAL, 
    GLOW_GEOMETRY, 
    GLOW_MATERIAL 
} from './bullet.js';

export class BulletManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.bullets = [];
        this.raycaster = new THREE.Raycaster();
        
        // Object pool for better performance
        this.bulletPool = [];
        this.poolSize = 50;
        this.initializePool();
        
        // Hit detection stats for debugging
        this.hitCount = 0;
        this.missCount = 0;
    }

    initializePool() {
        // Pre-create bullets to avoid garbage collection
        for (let i = 0; i < this.poolSize; i++) {
            const bullet = new Bullet(
                new THREE.Vector3(), 
                new THREE.Vector3(0, 0, 1), 
                this.scene
            );
            bullet.dispose(this.scene);
            this.bulletPool.push(bullet);
        }
    }

    createBullet(position, direction, speed, range = 15) {
        let bullet;
        
        if (this.bulletPool.length > 0) {
            // Reuse bullet from pool
            bullet = this.bulletPool.pop();
            
            // Recreate the container and meshes since they were set to null in dispose()
            bullet.container = new THREE.Object3D();
            bullet.mesh = new THREE.Mesh(BULLET_GEOMETRY, BULLET_MATERIAL);
            bullet.glowMesh = new THREE.Mesh(GLOW_GEOMETRY, GLOW_MATERIAL.clone());
            
            // Add to container
            bullet.container.add(bullet.mesh);
            bullet.container.add(bullet.glowMesh);
            
            // Set properties
            bullet.alive = true;
            bullet.distanceTraveled = 0;
            bullet.maxDistance = range;
            bullet.speed = speed;
            bullet.direction = direction.clone().normalize();
            bullet.container.position.copy(position);
            bullet.previousPosition = bullet.previousPosition || new THREE.Vector3();
            bullet.previousPosition.copy(position);
            
            // Orient bullet
            bullet.container.lookAt(position.clone().add(direction));
            bullet.mesh.rotateX(Math.PI / 2);
            
            this.scene.add(bullet.container);
        } else {
            // Create new bullet if pool is empty
            bullet = new Bullet(position, direction, this.scene, speed, range);
        }
        
        this.bullets.push(bullet);
        return bullet;
    }

    update(deltaTime, enemies, obstacles) {
        // Use fixed timestep for physics to prevent tunneling at high speeds
        const fixedStep = Math.min(deltaTime, 1/60);
        const steps = Math.ceil(deltaTime / fixedStep);
        const actualStep = deltaTime / steps;
        
        for (let step = 0; step < steps; step++) {
            // Process bullets with fixed timestep
            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const bullet = this.bullets[i];
                
                // Update bullet position
                if (!bullet.update(actualStep)) {
                    this.removeBullet(i);
                    continue;
                }
                
                // Check terrain collision
                if (bullet.checkTerrainCollision(this.raycaster, obstacles)) {
                    this.missCount++;
                    this.removeBullet(i);
                    continue;
                }
                
                // Check enemy collisions
                let hit = false;
                for (const enemy of enemies) {
                    if (bullet.checkCollision(enemy)) {
                        if (enemy.hitByBullet) {
                            enemy.hitByBullet();
                            this.hitCount++;
                        }
                        hit = true;
                        break;
                    }
                }
                
                if (hit) {
                    this.removeBullet(i);
                }
            }
        }
    }

    removeBullet(index) {
        const bullet = this.bullets[index];
        bullet.dispose(this.scene);
        
        // Return to pool if there's space
        if (this.bulletPool.length < this.poolSize) {
            this.bulletPool.push(bullet);
        }
        
        this.bullets.splice(index, 1);
    }

    clear() {
        for (const bullet of this.bullets) {
            bullet.dispose(this.scene);
        }
        this.bullets.length = 0;
    }

    getBulletCount() {
        return this.bullets.length;
    }
    
    getHitStatistics() {
        return {
            hits: this.hitCount,
            misses: this.missCount,
            accuracy: this.hitCount + this.missCount > 0 ? 
                (this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(1) + '%' : 'N/A'
        };
    }
}
