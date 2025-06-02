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
    }
    update() {
        // Calculate the target camera position based on the player's position and the offset
        const targetCameraPosition = new THREE.Vector3();
        targetCameraPosition.copy(this.player.position).add(this.offset);

        // Smoothly interpolate the camera's current position towards the target position
        this.camera.position.lerp(targetCameraPosition, CAMERA_LERP_FACTOR);

        // Make the camera look at the player's position
        this.camera.lookAt(this.player.position);
    }
}
export default CameraManager;
