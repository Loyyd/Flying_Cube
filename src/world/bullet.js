import * as THREE from 'three';

export class Bullet {
    constructor(position, direction, scene) {
        this.speed = 3;
        this.maxDistance = 5;
        this.distanceTraveled = 0;
        this.direction = direction.normalize();
        
        // Create glowing bullet mesh
        const geometry = new THREE.SphereGeometry(0.15, 16, 16);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff6600,
            emissive: 0xff3300,
            emissiveIntensity: 2,
            metalness: 0.5,
            roughness: 0.2
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);

        // Add point light to bullet
        this.light = new THREE.PointLight(0xff6600, 1, 2);
        this.light.position.copy(position);
        this.mesh.add(this.light);
        
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
        this.mesh.remove(this.light);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}
