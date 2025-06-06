import * as THREE from 'three';

// Static shared geometries and materials
export const BULLET_GEOMETRY = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6);
export const BULLET_MATERIAL = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
export const GLOW_GEOMETRY = new THREE.SphereGeometry(0.15, 8, 8);
export const GLOW_MATERIAL = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.3
});

export class Bullet {
    constructor(position, direction, scene, speed = 3, range = 11) {
        this.speed = speed;
        this.maxDistance = range;
        this.distanceTraveled = 0;
        this.direction = direction.clone().normalize();
        this.alive = true;
        
        // Use Object3D as root for better performance
        this.container = new THREE.Object3D();
        this.container.position.copy(position);
        
        // Create bullet mesh
        this.mesh = new THREE.Mesh(BULLET_GEOMETRY, BULLET_MATERIAL);
        
        // Orient bullet in direction of travel
        this.container.lookAt(position.clone().add(this.direction));
        this.mesh.rotateX(Math.PI / 2);
        
        // Add glow effect
        this.glowMesh = new THREE.Mesh(GLOW_GEOMETRY, GLOW_MATERIAL.clone());
        
        // Add to container for better performance
        this.container.add(this.mesh);
        this.container.add(this.glowMesh);
        
        scene.add(this.container);        
        // Cached vectors for performance (reuse these across instances)
        this._movement = this._movement || new THREE.Vector3();
        this._tempVector = this._tempVector || new THREE.Vector3();
        
        // Add previous position tracking for continuous collision detection
        this.previousPosition = this.previousPosition || new THREE.Vector3();
        this.previousPosition.copy(position);
        
        // Add collision trace line for debugging (uncomment if needed)
        /*
        this.traceLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([this.mesh.position.clone(), this.mesh.position.clone()]),
            new THREE.LineBasicMaterial({ color: 0xff0000 })
        );
        scene.add(this.traceLine);
        */
        
        // Visual indicator for debugging range (uncomment if needed)
        /*
        this.rangeIndicator = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                position.clone(),
                position.clone().add(direction.clone().multiplyScalar(range))
            ]),
            new THREE.LineDashedMaterial({ 
                color: 0xffff00, 
                dashSize: 0.5, 
                gapSize: 0.2 
            })
        );
        this.rangeIndicator.computeLineDistances();
        scene.add(this.rangeIndicator);
        */
    }    update(deltaTime) {
        if (!this.alive) return false;
        
        // Store previous position for continuous collision detection
        this.previousPosition.copy(this.container.position);
        
        // Move bullet
        this._movement.copy(this.direction).multiplyScalar(this.speed * deltaTime);
        this.container.position.add(this._movement);
        this.distanceTraveled += this._movement.length();
        
        // Simple rotation effect for visual interest - uses less CPU than complex animations
        this.glowMesh.rotation.z += deltaTime * 5;
        this.glowMesh.rotation.y += deltaTime * 8;
        
        // Check if bullet should be destroyed based on range
        if (this.distanceTraveled >= this.maxDistance) {
            // Add visual cue for bullet expiration (optional)
            this.expire();
            return false;
        }
        
        return true;
    }
    
    expire() {
        // Create a small fade-out effect when bullet reaches max range
        if (this.mesh) {
            // Optional: Add particle effect or flash at expiration point
            this.glowMesh.scale.set(2, 2, 2);
            this.glowMesh.material.opacity = 0.7;
            
            // Mark as not alive so it gets removed next frame
            this.alive = false;
        }
    }    checkCollision(target) {
        if (!this.alive || !target || !target.mesh) return false;
        
        // Simple sphere collision for better performance
        // Use squared distance calculation to avoid expensive sqrt operations
        const dx = this.container.position.x - target.mesh.position.x;
        const dy = this.container.position.y - target.mesh.position.y;
        const dz = this.container.position.z - target.mesh.position.z;
        const distSquared = dx*dx + dy*dy + dz*dz;
        
        // Using squared distance (0.5 * 0.5 = 0.25)
        if (distSquared < 0.25) {
            this.alive = false;
            return true;
        }
        
        return false;
    }    checkTerrainCollision(raycaster, obstacles) {
        if (!this.alive) return false;
        
        // Only test obstacles within a certain distance for performance
        // We use broad-phase culling to reduce ray tests
        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            
            // Quick bounding box test before doing expensive ray cast
            const dx = this.container.position.x - obstacle.mesh.position.x;
            const dy = this.container.position.y - obstacle.mesh.position.y;
            const dz = this.container.position.z - obstacle.mesh.position.z;
            const distSquared = dx*dx + dy*dy + dz*dz;
            
            // Only raycast if we're close to an obstacle (2.5 is approximate obstacle size + some margin)
            if (distSquared < 6.25) {
                const rayDirection = new THREE.Vector3().subVectors(
                    this.container.position, 
                    this.previousPosition
                ).normalize();
                
                raycaster.set(this.previousPosition, rayDirection);
                const intersects = raycaster.intersectObject(obstacle.mesh);
                
                if (intersects.length > 0) {
                    this.alive = false;
                    return true;
                }
            }
        }
        
        return false;
    }    dispose(scene) {
        if (this.container) {
            scene.remove(this.container);
            // Don't dispose shared geometries and materials
            this.container.remove(this.mesh);
            this.container.remove(this.glowMesh);
            this.container = null;
            this.mesh = null;
            this.glowMesh = null;
        }
        this.alive = false;
        
        // Also clean up debug traces if used
        /*
        if (this.traceLine) {
            scene.remove(this.traceLine);
            this.traceLine.geometry.dispose();
            this.traceLine.material.dispose();
            this.traceLine = null;
        }
        */
        
        // Also dispose of range indicator if used
        /*
        if (this.rangeIndicator) {
            scene.remove(this.rangeIndicator);
            this.rangeIndicator.geometry.dispose();
            this.rangeIndicator.material.dispose();
            this.rangeIndicator = null;
        }
        */
    }    get position() {
        return this.container ? this.container.position : new THREE.Vector3();
    }
}
