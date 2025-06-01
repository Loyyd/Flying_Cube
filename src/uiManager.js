// Score
export const GameState = {
    score: 200
};

export class UIManager {
    constructor() {
        this.score = GameState.score;
        this.shotRadius = 1;
        this.cooldownLevel = 0;
        this.COOLDOWN_UPGRADE_MAX = 4;
        this.COOLDOWN_REDUCTION_PER_LEVEL = 0.2;

        // UI Elements
        this.scoreElement = document.getElementById('score-value');
        this.shotRadiusSquares = document.getElementById('shot-radius-squares');
        this.increaseRadiusBtn = document.getElementById('increase-radius-btn');
        this.decreaseCooldownBtn = document.getElementById('decrease-cooldown-btn');
        this.cooldownLevelBar = document.getElementById('cooldown-level-bar-inner');
        this.cooldownCircle = document.querySelector('#cooldown-bar .circle');

        this.setupEventListeners();
        this.updateAllUI();
    }

    setupEventListeners() {
        this.increaseRadiusBtn.addEventListener('click', () => this.handleRadiusUpgrade());
        this.decreaseCooldownBtn.addEventListener('click', () => this.handleCooldownUpgrade());
    }

    handleRadiusUpgrade() {
        if (this.shotRadius < 2 && this.score >= 20) {
            this.shotRadius += 0.2;
            this.score -= 20;
            this.updateAllUI();
        }
    }

    handleCooldownUpgrade() {
        if (this.cooldownLevel < this.COOLDOWN_UPGRADE_MAX && this.score >= 20) {
            this.cooldownLevel++;
            this.score -= 20;
            this.updateAllUI();
        }
    }

    updateAllUI() {
        this.updateScoreUI();
        this.updateShotRadiusUI();
        this.updateCooldownBarUI();
    }

    updateScoreUI() {
        this.scoreElement.textContent = this.score;
    }

    updateShotRadiusUI() {
        this.shotRadiusSquares.innerHTML = '';
        for (let i = 1; i <= 2; i += 0.2) {
            const square = document.createElement('div');
            square.className = 'shot-radius-square' + (i <= this.shotRadius ? ' filled' : '');
            this.shotRadiusSquares.appendChild(square);
        }
    }

    updateCooldownBarUI() {
        const percent = 1 - Math.min(this.cooldownLevel * this.COOLDOWN_REDUCTION_PER_LEVEL, 0.8);
        this.cooldownLevelBar.style.width = (percent * 100) + '%';
    }

    updateCooldownCircle(progress) {
        const offset = 100 - progress * 100;
        this.cooldownCircle.style.strokeDashoffset = offset;
    }

    getCurrentCooldown(baseCooldown) {
        const reduction = Math.min(this.cooldownLevel * this.COOLDOWN_REDUCTION_PER_LEVEL, 0.8);
        return baseCooldown * (1 - reduction);
    }

    addScore(amount) {
        this.score += amount;
        this.updateScoreUI();
    }

    getShotRadius() {
        return this.shotRadius;
    }
}

export const UI = new UIManager();
