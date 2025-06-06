import * as THREE from 'three';

export class Bullet {
    constructor(position, direction, scene, speed = 5) {
        this.speed = speed;
        this.maxDistance = 100;
        this.distanceTraveled = 0;
        this.direction = direction.clone().normalize();
        this.alive = true;
        
        // Create optimized bullet mesh with trail effect
        const geometry = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 6);
        // Remove emissive property from MeshBasicMaterial
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffaa00
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Orient bullet in direction of travel
        this.mesh.lookAt(position.clone().add(this.direction));
        this.mesh.rotateX(Math.PI / 2);
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.3
        });
        this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.mesh.add(this.glowMesh);
        
        scene.add(this.mesh);
        
        // Cached vectors for performance
        this._movement = new THREE.Vector3();
        this._tempVector = new THREE.Vector3();
        
        // Add previous position tracking for continuous collision detection
        this.previousPosition = position.clone();
        
        // Add collision trace line for debugging (uncomment if needed)
        /*
        this.traceLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([this.mesh.position.clone(), this.mesh.position.clone()]),
            new THREE.LineBasicMaterial({ color: 0xff0000 })
        );
        scene.add(this.traceLine);
        */
    }

    update(deltaTime) {
        if (!this.alive) return false;
        
        // Store previous position for continuous collision detection
        this.previousPosition.copy(this.mesh.position);
        
        // Move bullet using cached vector
        this._movement.copy(this.direction).multiplyScalar(this.speed * deltaTime);
        this.mesh.position.add(this._movement);
        this.distanceTraveled += this._movement.length();
        
        // Update trace line if using debug visualization
        /*
        if (this.traceLine) {
            const positions = this.traceLine.geometry.attributes.position.array;
            positions[0] = this.previousPosition.x;
            positions[1] = this.previousPosition.y;
            positions[2] = this.previousPosition.z;
            positions[3] = this.mesh.position.x;
            positions[4] = this.mesh.position.y;
            positions[5] = this.mesh.position.z;
            this.traceLine.geometry.attributes.position.needsUpdate = true;
        }
        */
        
        // Animate glow
        this.glowMesh.rotation.x += deltaTime * 10;
        this.glowMesh.rotation.y += deltaTime * 8;
        
        // Check if bullet should be destroyed
        if (this.distanceTraveled >= this.maxDistance) {
            this.alive = false;
            return false;
        }
        
        return true;
    }

    checkCollision(target) {
        if (!this.alive || !target || !target.mesh) return false;
        
        // Use swept sphere collision for continuous detection
        // Calculate the vector between previous and current position
        const movementVector = this._tempVector.subVectors(this.mesh.position, this.previousPosition);
        const movementLength = movementVector.length();
        
        if (movementLength < 0.0001) {
            // Fallback to point collision if movement is too small
            const distance = this.mesh.position.distanceTo(target.mesh.position);
            return distance < 0.5; // collision radius
        }
        
        // Create a ray from previous position in movement direction
        const rayDirection = movementVector.normalize();
        
        // Calculate distance from ray to target center
        const targetPos = target.mesh.position;
        const toTarget = new THREE.Vector3().subVectors(targetPos, this.previousPosition);
        const projectionLength = toTarget.dot(rayDirection);
        
        // Find closest point on ray to target center
        const closestPoint = new THREE.Vector3()
            .copy(this.previousPosition)
            .add(rayDirection.multiplyScalar(Math.max(0, Math.min(projectionLength, movementLength))));
        
        // Check if closest point is within collision radius
        const distanceToTarget = closestPoint.distanceTo(targetPos);
        if (distanceToTarget < 0.5) { // collision radius
            this.alive = false;
            return true;
        }
        
        return false;
    }

    checkTerrainCollision(raycaster, obstacles) {
        if (!this.alive) return false;
        
        // Use more robust ray casting along bullet's travel path
        const rayDirection = new THREE.Vector3().subVectors(this.mesh.position, this.previousPosition).normalize();
        const rayStart = this.previousPosition;
        const rayLength = this.previousPosition.distanceTo(this.mesh.position);
        
        // Set ray with increased length to catch fast-moving bullets
        raycaster.set(rayStart, rayDirection);
        const intersects = raycaster.intersectObjects(obstacles, true);
        
        if (intersects.length > 0 && intersects[0].distance <= rayLength) {
            // Set bullet position to the hit point to avoid visual penetration
            this.mesh.position.copy(intersects[0].point);
            this.alive = false;
            return true;
        }
        
        return false;
    }

    dispose(scene) {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
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
    }

    get position() {
        return this.mesh ? this.mesh.position : new THREE.Vector3();
    }
}
