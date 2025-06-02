import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { defaultMaterial } from '../core/settings.js';

export class CubeManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.isDragging = false;
        this.previewCube = null;
        this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        
        this.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4444ff,
            transparent: true,
            opacity: 0.6
        });
        this.solidCubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x4444ff
        });
    }

    startDragging() {
        if (!this.previewCube) {
            this.previewCube = new THREE.Mesh(this.cubeGeometry, this.cubeMaterial);
            this.previewCube.castShadow = true;
            this.scene.add(this.previewCube);
        }
        this.isDragging = true;
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
        if (!this.isDragging || !this.previewCube) return;
        
        // Create physical cube
        const cube = new THREE.Mesh(this.cubeGeometry, this.solidCubeMaterial);
        cube.position.copy(this.previewCube.position);
        cube.castShadow = true;
        cube.receiveShadow = true;
        this.scene.add(cube);

        // Add physics
        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
        const body = new CANNON.Body({
            mass: 0,
            material: defaultMaterial,
            shape: shape
        });
        body.position.copy(cube.position);
        this.world.addBody(body);

        // Reset preview
        this.scene.remove(this.previewCube);
        this.previewCube = null;
        this.isDragging = false;
    }

    cancelDragging() {
        if (this.previewCube) {
            this.scene.remove(this.previewCube);
            this.previewCube = null;
        }
        this.isDragging = false;
    }
}
