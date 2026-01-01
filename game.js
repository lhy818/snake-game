// 游戏配置
const CONFIG = {
    gridSize: 20,
    gridWidth: 25,
    gridHeight: 25,
    initialSpeed: 150,
    speedIncrease: 2,
    minSpeed: 50
};

// 游戏状态
const GameState = {
    READY: 'ready',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'game_over'
};

// 方向
const Direction = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
};

class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('overlay');
        this.overlayTitle = document.getElementById('overlay-title');
        this.overlayMessage = document.getElementById('overlay-message');
        this.startBtn = document.getElementById('start-btn');
        this.scoreDisplay = document.getElementById('score');
        this.bestScoreDisplay = document.getElementById('best-score');
        
        // 设置画布大小
        this.canvas.width = CONFIG.gridSize * CONFIG.gridWidth;
        this.canvas.height = CONFIG.gridSize * CONFIG.gridHeight;
        
        // 加载最高分
        this.bestScore = parseInt(localStorage.getItem('snakeBestScore')) || 0;
        this.bestScoreDisplay.textContent = this.bestScore;
        
        // 初始化游戏
        this.init();
        this.bindEvents();
        
        // 开始游戏循环
        this.lastTime = 0;
        this.accumulator = 0;
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    init() {
        // 蛇的初始位置（从中间开始）
        const startX = Math.floor(CONFIG.gridWidth / 2);
        const startY = Math.floor(CONFIG.gridHeight / 2);
        
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];
        
        this.direction = Direction.RIGHT;
        this.nextDirection = Direction.RIGHT;
        this.food = null;
        this.score = 0;
        this.speed = CONFIG.initialSpeed;
        this.state = GameState.READY;
        
        this.spawnFood();
        this.updateScore();
        this.draw();
    }
    
    bindEvents() {
        // 键盘控制
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // 开始按钮
        this.startBtn.addEventListener('click', () => this.startGame());
        
        // 移动端控制
        document.getElementById('btn-up').addEventListener('click', () => this.setDirection(Direction.UP));
        document.getElementById('btn-down').addEventListener('click', () => this.setDirection(Direction.DOWN));
        document.getElementById('btn-left').addEventListener('click', () => this.setDirection(Direction.LEFT));
        document.getElementById('btn-right').addEventListener('click', () => this.setDirection(Direction.RIGHT));
        
        // 触摸滑动控制
        let touchStartX, touchStartY;
        this.canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            if (!touchStartX || !touchStartY) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                this.setDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
            } else {
                this.setDirection(dy > 0 ? Direction.DOWN : Direction.UP);
            }
            
            touchStartX = null;
            touchStartY = null;
        });
    }
    
    handleKeyPress(e) {
        // 防止方向键滚动页面
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
            e.preventDefault();
        }
        
        switch (e.code) {
            case 'ArrowUp':
            case 'KeyW':
                this.setDirection(Direction.UP);
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.setDirection(Direction.DOWN);
                break;
            case 'ArrowLeft':
            case 'KeyA':
                this.setDirection(Direction.LEFT);
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.setDirection(Direction.RIGHT);
                break;
            case 'Space':
                this.togglePause();
                break;
        }
    }
    
    setDirection(newDir) {
        // 不能直接反向
        if (this.direction.x + newDir.x === 0 && this.direction.y + newDir.y === 0) {
            return;
        }
        this.nextDirection = newDir;
        
        // 如果游戏结束或准备状态，按方向键开始游戏
        if (this.state === GameState.READY || this.state === GameState.GAME_OVER) {
            this.startGame();
        }
    }
    
    togglePause() {
        if (this.state === GameState.PLAYING) {
            this.state = GameState.PAUSED;
            this.showOverlay('暂停', '按 空格键 继续游戏', '继续');
        } else if (this.state === GameState.PAUSED) {
            this.state = GameState.PLAYING;
            this.hideOverlay();
        } else if (this.state === GameState.READY || this.state === GameState.GAME_OVER) {
            this.startGame();
        }
    }
    
    startGame() {
        if (this.state === GameState.GAME_OVER || this.state === GameState.READY) {
            this.init();
        }
        this.state = GameState.PLAYING;
        this.hideOverlay();
    }
    
    spawnFood() {
        let validPosition = false;
        let newFood;
        
        while (!validPosition) {
            newFood = {
                x: Math.floor(Math.random() * CONFIG.gridWidth),
                y: Math.floor(Math.random() * CONFIG.gridHeight)
            };
            
            // 确保食物不在蛇身上
            validPosition = !this.snake.some(segment => 
                segment.x === newFood.x && segment.y === newFood.y
            );
        }
        
        this.food = newFood;
    }
    
    update() {
        if (this.state !== GameState.PLAYING) return;
        
        this.direction = this.nextDirection;
        
        // 计算新头部位置
        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };
        
        // 检查碰撞
        if (this.checkCollision(newHead)) {
            this.gameOver();
            return;
        }
        
        // 移动蛇
        this.snake.unshift(newHead);
        
        // 检查是否吃到食物
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 10;
            this.updateScore();
            this.spawnFood();
            
            // 加速
            if (this.speed > CONFIG.minSpeed) {
                this.speed -= CONFIG.speedIncrease;
            }
        } else {
            this.snake.pop();
        }
    }
    
    checkCollision(head) {
        // 撞墙
        if (head.x < 0 || head.x >= CONFIG.gridWidth || 
            head.y < 0 || head.y >= CONFIG.gridHeight) {
            return true;
        }
        
        // 撞自己
        return this.snake.some(segment => 
            segment.x === head.x && segment.y === head.y
        );
    }
    
    gameOver() {
        this.state = GameState.GAME_OVER;
        
        // 更新最高分
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('snakeBestScore', this.bestScore);
            this.bestScoreDisplay.textContent = this.bestScore;
            this.showOverlay('🎉 新纪录！', `得分: ${this.score}`, '再来一局');
        } else {
            this.showOverlay('游戏结束', `得分: ${this.score}`, '重新开始');
        }
    }
    
    updateScore() {
        this.scoreDisplay.textContent = this.score;
    }
    
    showOverlay(title, message, buttonText) {
        this.overlayTitle.textContent = title;
        this.overlayMessage.textContent = message;
        this.startBtn.textContent = buttonText;
        this.overlay.classList.remove('hidden');
    }
    
    hideOverlay() {
        this.overlay.classList.add('hidden');
    }
    
    draw() {
        // 清空画布
        this.ctx.fillStyle = 'rgba(13, 17, 23, 0.3)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格（淡淡的）
        this.drawGrid();
        
        // 绘制食物
        this.drawFood();
        
        // 绘制蛇
        this.drawSnake();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= CONFIG.gridWidth; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * CONFIG.gridSize, 0);
            this.ctx.lineTo(x * CONFIG.gridSize, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= CONFIG.gridHeight; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * CONFIG.gridSize);
            this.ctx.lineTo(this.canvas.width, y * CONFIG.gridSize);
            this.ctx.stroke();
        }
    }
    
    drawFood() {
        if (!this.food) return;
        
        const x = this.food.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const y = this.food.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const radius = CONFIG.gridSize / 2 - 2;
        
        // 发光效果
        const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
        gradient.addColorStop(0, 'rgba(255, 107, 107, 0.8)');
        gradient.addColorStop(0.5, 'rgba(233, 69, 96, 0.4)');
        gradient.addColorStop(1, 'rgba(233, 69, 96, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 食物主体
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 高光
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x - radius / 3, y - radius / 3, radius / 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawSnake() {
        this.snake.forEach((segment, index) => {
            const x = segment.x * CONFIG.gridSize;
            const y = segment.y * CONFIG.gridSize;
            const size = CONFIG.gridSize - 2;
            const offset = 1;
            
            // 计算渐变颜色（从青色到粉色）
            const progress = index / this.snake.length;
            const r = Math.round(0 + (233 - 0) * progress);
            const g = Math.round(217 + (69 - 217) * progress);
            const b = Math.round(255 + (96 - 255) * progress);
            
            // 发光效果
            if (index === 0) {
                this.ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
                this.ctx.shadowBlur = 15;
            } else {
                this.ctx.shadowBlur = 5;
            }
            
            // 蛇身
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            this.ctx.beginPath();
            this.ctx.roundRect(x + offset, y + offset, size, size, 5);
            this.ctx.fill();
            
            // 蛇头的眼睛
            if (index === 0) {
                this.ctx.shadowBlur = 0;
                this.drawEyes(x, y, size);
            }
        });
        
        this.ctx.shadowBlur = 0;
    }
    
    drawEyes(x, y, size) {
        const eyeSize = 4;
        const eyeOffset = size / 4;
        
        let eye1X, eye1Y, eye2X, eye2Y;
        
        if (this.direction === Direction.RIGHT) {
            eye1X = x + size - eyeOffset;
            eye1Y = y + eyeOffset;
            eye2X = x + size - eyeOffset;
            eye2Y = y + size - eyeOffset;
        } else if (this.direction === Direction.LEFT) {
            eye1X = x + eyeOffset;
            eye1Y = y + eyeOffset;
            eye2X = x + eyeOffset;
            eye2Y = y + size - eyeOffset;
        } else if (this.direction === Direction.UP) {
            eye1X = x + eyeOffset;
            eye1Y = y + eyeOffset;
            eye2X = x + size - eyeOffset;
            eye2Y = y + eyeOffset;
        } else {
            eye1X = x + eyeOffset;
            eye1Y = y + size - eyeOffset;
            eye2X = x + size - eyeOffset;
            eye2Y = y + size - eyeOffset;
        }
        
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 瞳孔
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.beginPath();
        this.ctx.arc(eye1X + this.direction.x, eye1Y + this.direction.y, eyeSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(eye2X + this.direction.x, eye2Y + this.direction.y, eyeSize / 2, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    gameLoop(currentTime) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.accumulator += deltaTime;
        
        while (this.accumulator >= this.speed) {
            this.update();
            this.accumulator -= this.speed;
        }
        
        this.draw();
        requestAnimationFrame((time) => this.gameLoop(time));
    }
}

// 启动游戏
window.addEventListener('DOMContentLoaded', () => {
    new SnakeGame();
});
