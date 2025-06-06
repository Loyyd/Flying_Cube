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
        
        // Cached vectors for performance
        this._targetPosition = new THREE.Vector3();
        this._scaledOffset = new THREE.Vector3();
        this._lookAtPosition = new THREE.Vector3();
        
        // Set initial position
        this.camera.position.copy(player.position).add(this.offset);
        this.camera.lookAt(player.position);
        
        // Add wheel event listener
        window.addEventListener('wheel', (event) => this.handleZoom(event));
    }

    handleZoom(event) {
        // Adjust zoom level based on wheel delta
        this.zoomLevel += event.deltaY * 0.001;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
    }    update() {
        // Calculate the target camera position with zoom
        this._scaledOffset.copy(this.offset).multiplyScalar(this.zoomLevel);
        this._targetPosition.copy(this.player.position).add(this._scaledOffset);

        // Smoothly interpolate the camera's current position towards the target position
        this.camera.position.lerp(this._targetPosition, CAMERA_LERP_FACTOR);

        // Use a slightly damped look-at position for smoother camera motion
        this._lookAtPosition.copy(this.player.position);
        this.camera.lookAt(this._lookAtPosition);
    }
}
export default CameraManager;
