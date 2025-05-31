import * as THREE from 'three';

// IMPORTANT CONSTANTS
const CAMERA_OFFSET_X = 0;
const CAMERA_OFFSET_Y = 4;
const CAMERA_OFFSET_Z = 4;
const CAMERA_LERP_FACTOR = 0.05; // Controls camera smoothness (0.0 - 1.0, higher is faster)

/**
 * Manages the camera's position and target to smoothly follow a player.
 */
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

    /**
     * Updates the camera's position and target.
     * This method should be called in your animation loop.
     */
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
