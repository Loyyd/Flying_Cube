import * as THREE from 'three';
import {
  CAMERA_OFFSET_X,
  CAMERA_OFFSET_Y,
  CAMERA_OFFSET_Z,
  CAMERA_LERP_FACTOR
} from './settings.js';

class CameraManager {
    /**
     * @param {THREE.Camera} camera - The Three.js camera to manage.
     * @param {THREE.Object3D} player - The player object (e.g., a THREE.Mesh) to follow.
     */
    constructor(camera, player) {
        this.camera = camera;
        this.player = player;
        this.offset = new THREE.Vector3(CAMERA_OFFSET_X, CAMERA_OFFSET_Y, CAMERA_OFFSET_Z);
        this.zoomLevel = 1;
        this.minZoom = 0.5;
        this.maxZoom = 2;
        
        // Add wheel event listener
        window.addEventListener('wheel', (event) => this.handleZoom(event));
    }

    handleZoom(event) {
        // Adjust zoom level based on wheel delta
        this.zoomLevel += event.deltaY * 0.001;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
    }

    update() {
        // Calculate the target camera position with zoom
        const targetCameraPosition = new THREE.Vector3();
        const scaledOffset = this.offset.clone().multiplyScalar(this.zoomLevel);
        targetCameraPosition.copy(this.player.position).add(scaledOffset);

        // Smoothly interpolate the camera's current position towards the target position
        this.camera.position.lerp(targetCameraPosition, CAMERA_LERP_FACTOR);

        // Make the camera look at the player's position
        this.camera.lookAt(this.player.position);
    }
}
export default CameraManager;
