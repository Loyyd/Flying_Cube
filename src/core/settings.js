export const GOD_MODE = true;

// Game State
export const GameState = {
  
    score: 0,
    SHOT_RADIUS: 1,

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

// Shot settings
export const SHOT_RANGE = 10;

export const SHOT_EFFECT_DURATION_S = 0.01;
export const SHOT_COOLDOWN_S = 2;
export const SHOT_ACTIVE_COLOR = 0xff0000;
export const EXPLOSION_DELAY_S = 0.3;

// Visual indicators
export const RING_THICKNESS = 0.15;
export const RING_OPACITY = 0.4;
export const CURSOR_INDICATOR_RADIUS = 0.5;
export const CURSOR_INDICATOR_SEGMENTS = 16;
export const CURSOR_INDICATOR_OPACITY = 0.8;

// Obstacle settings
export const OBSTACLE1_COLOR = "#00FF00";
export const OBSTACLE2_COLOR = "#8fce00";
export const OBSTACLE_WALL_COLOR = 50549;
export const OBSTACLE_RANDOM_COLOR = 50549;
export const NUM_RANDOM_OBSTACLES = 50;

// Enemy settings
export const ENEMY_RADIUS = 0.5;
export const ENEMY_SPEED = 1.0;
export const ENEMY_WANDER_SPEED = 1;
export const ENEMY_DARK_RED = 0x660000;
export const ENEMY_CHASE_RADIUS = 8;
export const ENEMY_WANDER_CHANGE_INTERVAL = 5;

// EnemySpawner settings
export const ENEMY_BOX_SIZE = 1;
export const ENEMY_SPAWN_RADIUS = 2;
export const ENEMY_NUM_BOXES = 4;
export const ENEMY_SPAWN_INTERVAL_MS = 3000;
export const MIN_SPAWNER_DISTANCE_FROM_PLAYER = 15;

// Camera settings
export const CAMERA_OFFSET_X = 0;
export const CAMERA_OFFSET_Y = 10;
export const CAMERA_OFFSET_Z = 10;
export const CAMERA_LERP_FACTOR = 0.05;

// Game/scene settings
export const GRID_SIZE = 75;
export const PLAYER_SIZE = 1;
export const SCENE_BACKGROUND_COLOR = 0x000811;

// Lighting settings
export const AMBIENT_LIGHT_COLOR = 0x404050;  // Subtle bluish ambient
export const AMBIENT_LIGHT_INTENSITY = 0.4;   // Lower ambient intensity for contrast

// Main directional light (sun-like)
export const SUN_LIGHT_COLOR = 0xffffb3;      // Warm sunlight color
export const SUN_LIGHT_INTENSITY = 2;       // Moderate intensity
export const SUN_POSITION = { x: 50, y: 100, z: 50 };

// Player spotlight
export const PLAYER_LIGHT_COLOR = 0xa3c2ff;   // Slightly blue tint for player light
export const PLAYER_LIGHT_INTENSITY = 6;      // Higher intensity for player spotlight
export const PLAYER_LIGHT_HEIGHT = 8;         // Lower height for more dramatic shadows
export const PLAYER_LIGHT_DISTANCE = 20;      // Moderate distance for better focus
export const PLAYER_LIGHT_ANGLE = Math.PI / 6; // Narrower angle for more focused light
export const PLAYER_LIGHT_PENUMBRA = 0.8;     // Soft edge

// Additional accent lights
export const USE_ACCENT_LIGHTS = true;        // Toggle accent lights
export const ACCENT_LIGHT_COLOR = 0xff5500;   // Orange-red accent
export const ACCENT_LIGHT_INTENSITY = 4;      // Low intensity for accent
export const ACCENT_LIGHT_DISTANCE = 25;      // Short distance for accents

// --- Physics Material ---
import * as CANNON from 'cannon-es';
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
