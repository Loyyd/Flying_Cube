import * as THREE from 'three';

export class Bullet {
    constructor(position, direction, scene) {
        this.speed = 15;
        this.maxDistance = 20;
        this.distanceTraveled = 0;
        this.direction = direction.normalize();
        
        // Create bullet mesh
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
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
