import * as CANNON from 'cannon-es'; // Moved import to the top

export const GOD_MODE = false;
export const DEBUG_MODE = false; // Toggle to true to show hitboxes and debug info

// Game State
export const GameState = {
  
    score: 0,
    SHOT_RADIUS: 1,
    debugMode: DEBUG_MODE, // Initialize with the DEBUG_MODE constant

    // Add method to safely update score
    updateScore(amount) {
        const newScore = this.score + amount;
        if (newScore >= 0) {
            this.score = newScore;
            return true;
        }
        return false;
    }
};


// Player settings
export const PLAYER_SPEED = 5.0;
export const PLAYER_ROTATION_SPEED = 5.0;
export const PLAYER_SIZE = 1;
export const PLAYER_BOX_HALF_EXTENTS = new CANNON.Vec3(PLAYER_SIZE * 0.7, PLAYER_SIZE*0.8, PLAYER_SIZE * 1.1);

// Shot settings
export const SHOT_RANGE = 10;
export const SHOT_EFFECT_DURATION_S = 1.0; // Set to exactly 1 second to match request
export const SHOT_COOLDOWN_S = 2;
export const SHOT_ACTIVE_COLOR = 0xff0000;
export const EXPLOSION_DELAY_S = 0.2; // Reduced delay for better game feel

// Visual indicators
export const RING_THICKNESS = 0.15;
export const RING_OPACITY = 0.4;
export const CURSOR_INDICATOR_RADIUS = 0.5;
export const CURSOR_INDICATOR_SEGMENTS = 32;
export const CURSOR_INDICATOR_OPACITY = 0.4;

// Obstacle settings
export const OBSTACLE1_COLOR = "#00FF00";
export const OBSTACLE2_COLOR = "#8fce00";
export const OBSTACLE_WALL_COLOR = 50549;
export const OBSTACLE_RANDOM_COLOR = 50549;
export const NUM_RANDOM_OBSTACLES = 50;

// Enemy settings
export const ENEMY_RADIUS = 0.5;
export const ENEMY_SPEED = 0.7;
export const ENEMY_WANDER_SPEED = 1;
export const ENEMY_DARK_RED = 0x660000;
export const ENEMY_CHASE_RADIUS = 9;
export const ENEMY_WANDER_CHANGE_INTERVAL = 5;

// EnemySpawner settings
export const ENEMY_BOX_SIZE = 1;
export const ENEMY_SPAWN_RADIUS = 2.5;
export const ENEMY_NUM_BOXES = 3;
export const ENEMY_SPAWN_INTERVAL_MS = 5000;
export const MIN_SPAWNER_DISTANCE_FROM_PLAYER = 15;

// Camera settings
export const CAMERA_OFFSET_X = 0;
export const CAMERA_OFFSET_Y = 10;
export const CAMERA_OFFSET_Z = 10;
export const CAMERA_LERP_FACTOR = 0.05;

// Game/scene settings
export const GRID_SIZE = 75;
export const SCENE_BACKGROUND_COLOR = 0x000811;

// Lighting settings
// Strong main directional light (sunlight)
export const SUN_LIGHT_COLOR = 0xffffff;      // Pure white sunlight color (less yellowish)
export const SUN_LIGHT_INTENSITY = 3.5;       // Stronger intensity
export const SUN_POSITION = { x: 100, y: 150, z: 100 }; // Higher position for better coverage

// --- Physics Material ---
export const defaultMaterial = new CANNON.Material('default');
export const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 0.5,
    restitution: 0.2,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3
  }
);
