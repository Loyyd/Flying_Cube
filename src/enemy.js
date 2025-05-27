import * as THREE from 'three';

// --- Enemy Constants ---
const ENEMY_SIZE = 0.5;
const ENEMY_COLOR = 0x993399; // Darker Purple
const ENEMY_SPEED_PER_SEC = 1.0; // Units per second

class Enemy extends THREE.Mesh {
    constructor(geometry, material, initialPosition = new THREE.Vector3(0, 0, 0)) {
        super(geometry, material);
        this.position.copy(initialPosition);
        this.castShadow = true;
        this.receiveShadow = true;
    }

    /**
     * Updates the enemy's position to move towards the player.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {THREE.Vector3} playerPosition - The current position of the player.
     * @param {Array<THREE.Mesh>} obstacles - An array of obstacle meshes in the scene.
     * @param {number} gridSize - The size of the game grid.
     * @returns {boolean} True if the enemy collided with the player, false otherwise.
     */
    update(deltaTime, playerPosition, obstacles, gridSize) {
        const directionToPlayer = new THREE.Vector3().subVectors(playerPosition, this.position);
        if (directionToPlayer.lengthSq() < 0.01) return false; // Avoid division by zero if enemy is on player

        directionToPlayer.normalize();
        const moveDistance = ENEMY_SPEED_PER_SEC * deltaTime;
        const moveVector = directionToPlayer.clone().multiplyScalar(moveDistance);
        const nextPos = this.position.clone().add(moveVector);

        let collidesWithObstacle = false;
        const enemyHalfSize = ENEMY_SIZE / 2;

        // Check for collisions with obstacles
        for (const obs of obstacles) {
            const obsParams = obs.geometry.parameters;
            const obsHalfWidth = obsParams.width / 2;
            const obsHalfDepth = obsParams.depth / 2;

            if (Math.abs(obs.position.x - nextPos.x) < (enemyHalfSize + obsHalfWidth) &&
                Math.abs(obs.position.z - nextPos.z) < (enemyHalfSize + obsHalfDepth)) {
                collidesWithObstacle = true;
                break;
            }
        }

        // Update position if no collision with obstacles
        if (!collidesWithObstacle) {
            this.position.copy(nextPos);
        }

        // Check for collision with player
        if (this.position.distanceTo(playerPosition) < (1 / 2 + ENEMY_SIZE / 2)) { // Assuming PLAYER_SIZE is 1
            return true; // Collision with player
        }
        return false;
    }

    /**
     * Disposes of the enemy's mesh geometry and material to free up memory.
     */
    dispose() {
        if (this.geometry) this.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}

/**
 * Spawns a new enemy at a random position around the player.
 * @param {THREE.Scene} scene - The Three.js scene to add the enemy to.
 * @param {THREE.Vector3} playerPosition - The current position of the player.
 * @param {number} gridSize - The size of the game grid.
 * @returns {Enemy} The newly spawned enemy.
 */
function spawnEnemy(scene, playerPosition, gridSize) {
    const enemyGeo = new THREE.BoxGeometry(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE);
    const enemyMaterial = new THREE.MeshStandardMaterial({ color: ENEMY_COLOR, roughness: 0.6, metalness: 0.1 });
    const enemy = new Enemy(enemyGeo, enemyMaterial);

    const ENEMY_SPAWN_RADIUS_FACTOR = 1.0;
    let angle = Math.random() * Math.PI * 2;
    let radius = (gridSize / 2) * ENEMY_SPAWN_RADIUS_FACTOR;
    let x = playerPosition.x + Math.cos(angle) * radius;
    let z = playerPosition.z + Math.sin(angle) * radius;

    // Ensure enemy spawns within grid boundaries
    x = Math.max(-gridSize / 2 + ENEMY_SIZE, Math.min(gridSize / 2 - ENEMY_SIZE, x));
    z = Math.max(-gridSize / 2 + ENEMY_SIZE, Math.min(gridSize / 2 - ENEMY_SIZE, z));

    enemy.position.set(x, ENEMY_SIZE / 2, z);
    scene.add(enemy);
    return enemy;
}

export { Enemy, spawnEnemy, ENEMY_SIZE, ENEMY_SPEED_PER_SEC, ENEMY_COLOR };
