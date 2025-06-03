import * as THREE from 'three';
import { vectorComponents } from 'three/webgpu';

export class Bullet {
    constructor(position, direction, scene) {
        this.speed = 3;
        this.maxDistance = 5;
        this.distanceTraveled = 0;
        this.direction = direction.normalize();
        
        // Create simple bullet mesh
        const geometry = new THREE.SphereGeometry(0.1, 8, 8); // Half the original size
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff6600,
            metalness: 0.5,
            roughness: 0.5
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        scene.add(this.mesh);
    }

    update(deltaTime) {
        // Move bullet
        const movement = this.direction.clone().multiplyScalar(this.speed * deltaTime);
        this.mesh.position.add(movement);
        this.distanceTraveled += movement.length();
        
        return this.distanceTraveled < this.maxDistance;
    }

    checkCollision(enemy) {
        if (enemy.isRigid) return false;
        const distance = this.mesh.position.distanceTo(enemy.mesh.position);
        return distance < 0.5; // collision radius
    }

    dispose(scene) {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
