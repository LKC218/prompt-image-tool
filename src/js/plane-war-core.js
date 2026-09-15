export const FIELD_W = 320;
export const FIELD_H = 480;
export const HIGHSCORE_KEY = 'pc-plane-highscore';

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function readHighScore() {
    try {
        const raw = localStorage.getItem(HIGHSCORE_KEY);
        const n = Number(raw);
        return Number.isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
        return 0;
    }
}

export function writeHighScore(score) {
    try {
        const prev = readHighScore();
        if (score > prev) {
            localStorage.setItem(HIGHSCORE_KEY, String(score));
            return score;
        }
        return prev;
    } catch (e) {
        return readHighScore();
    }
}

export function createPlayer() {
    return {
        x: FIELD_W / 2,
        y: FIELD_H - 56,
        w: 28,
        h: 32,
        lives: 3,
        cooldown: 0,
        invincible: 0,
    };
}

export function createGameState(random = Math.random) {
    return {
        player: createPlayer(),
        bullets: [],
        enemies: [],
        particles: [],
        score: 0,
        wave: 1,
        status: 'playing',
        spawnTimer: 0,
        fireTimer: 0,
        random,
        highScore: readHighScore(),
        enemyId: 1,
    };
}

export function spawnEnemy(state) {
    const { random = Math.random } = state;
    const roll = random();
    let type = 'basic';
    let hp = 1;
    let w = 26;
    let h = 24;
    let speed = 70 + state.wave * 8;
    let score = 10;
    if (roll > 0.82) {
        type = 'heavy';
        hp = 3;
        w = 34;
        h = 28;
        speed = 45 + state.wave * 5;
        score = 30;
    } else if (roll > 0.55) {
        type = 'fast';
        hp = 1;
        w = 22;
        h = 20;
        speed = 120 + state.wave * 10;
        score = 15;
    }
    const x = 20 + random() * (FIELD_W - 40);
    return {
        id: state.enemyId || 1,
        type,
        hp,
        maxHp: hp,
        w,
        h,
        x,
        y: -h,
        vy: speed,
        vx: (random() - 0.5) * 40,
        score,
    };
}

export function rectsOverlap(a, b) {
    return (
        a.x - a.w / 2 < b.x + b.w / 2 &&
        a.x + a.w / 2 > b.x - b.w / 2 &&
        a.y - a.h / 2 < b.y + b.h / 2 &&
        a.y + a.h / 2 > b.y - b.h / 2
    );
}

export function movePlayer(state, dx, dy, dt = 1 / 60) {
    if (state.status !== 'playing') return state;
    const p = state.player;
    const next = {
        ...state,
        player: {
            ...p,
            x: clamp(p.x + dx * 220 * dt, p.w / 2, FIELD_W - p.w / 2),
            y: clamp(p.y + dy * 160 * dt, FIELD_H * 0.55, FIELD_H - p.h / 2 - 8),
            cooldown: Math.max(0, p.cooldown - dt),
            invincible: Math.max(0, p.invincible - dt),
        },
    };
    return next;
}

export function tryFire(state, dt = 1 / 60, auto = true) {
    if (state.status !== 'playing') return state;
    const p = state.player;
    const cooldown = Math.max(0, p.cooldown - dt);
    if (cooldown > 0) {
        return { ...state, player: { ...p, cooldown } };
    }
    const bullet = {
        id: `${Date.now()}-${Math.random()}`,
        x: p.x,
        y: p.y - p.h / 2,
        w: 4,
        h: 12,
        vy: -420,
    };
    return {
        ...state,
        player: { ...p, cooldown: 0.16 },
        bullets: [...state.bullets, bullet],
    };
}

export function explode(x, y, color = '#ffb454') {
    const parts = [];
    for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        parts.push({
            x,
            y,
            vx: Math.cos(angle) * (40 + Math.random() * 50),
            vy: Math.sin(angle) * (40 + Math.random() * 50),
            life: 0.35,
            color,
        });
    }
    return parts;
}

export function tick(state, dt = 1 / 60) {
    if (state.status !== 'playing') return state;

    const random = state.random || Math.random;
    let next = { ...state, random };

    // spawn
    let spawnTimer = next.spawnTimer - dt;
    const spawnEvery = Math.max(0.35, 1.1 - next.wave * 0.08);
    let enemies = [...next.enemies];
    let enemyId = next.enemyId || 1;
    if (spawnTimer <= 0) {
        const e = spawnEnemy({ ...next, enemyId });
        enemies.push({ ...e, id: enemyId });
        enemyId += 1;
        spawnTimer = spawnEvery;
    }

    // bullets
    let bullets = next.bullets
        .map((b) => ({ ...b, y: b.y + b.vy * dt }))
        .filter((b) => b.y + b.h > 0);

    // enemies
    enemies = enemies
        .map((e) => ({
            ...e,
            y: e.y + e.vy * dt,
            x: clamp(e.x + e.vx * dt, e.w / 2, FIELD_W - e.w / 2),
        }))
        .filter((e) => e.y - e.h < FIELD_H + 20);

    // bullet vs enemy
    let score = next.score;
    const deadEnemyIds = new Set();
    const hitBulletIds = new Set();
    const particles = [...next.particles];
    for (const b of bullets) {
        for (const e of enemies) {
            if (deadEnemyIds.has(e.id) || hitBulletIds.has(b.id)) continue;
            if (!rectsOverlap(b, e)) continue;
            hitBulletIds.add(b.id);
            const hp = e.hp - 1;
            if (hp <= 0) {
                deadEnemyIds.add(e.id);
                score += e.score;
                particles.push(...explode(e.x, e.y, e.type === 'heavy' ? '#ff7b72' : '#ffd666'));
            } else {
                e.hp = hp;
            }
        }
    }
    bullets = bullets.filter((b) => !hitBulletIds.has(b.id));
    enemies = enemies.filter((e) => !deadEnemyIds.has(e.id));

    // player collide
    let player = {
        ...next.player,
        cooldown: Math.max(0, next.player.cooldown - dt),
        invincible: Math.max(0, next.player.invincible - dt),
    };
    let lives = player.lives;
    let status = 'playing';
    if (player.invincible <= 0) {
        for (const e of enemies) {
            if (rectsOverlap(player, e)) {
                lives -= 1;
                player = { ...player, lives, invincible: 1.4, x: FIELD_W / 2, y: FIELD_H - 56 };
                particles.push(...explode(e.x, e.y, '#ff6b6b'));
                enemies = enemies.filter((x) => x.id !== e.id);
                break;
            }
        }
        // escaped enemy bottom costs a life once when very low? classic: only collision
    }

    if (lives <= 0) {
        status = 'over';
        const highScore = writeHighScore(score);
        return {
            ...next,
            bullets,
            enemies,
            particles,
            player: { ...player, lives: 0 },
            score,
            spawnTimer,
            enemyId,
            status,
            highScore,
        };
    }

    const wave = 1 + Math.floor(score / 120);
    // particles decay
    const nextParticles = particles
        .map((p) => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            life: p.life - dt,
        }))
        .filter((p) => p.life > 0);

    return {
        ...next,
        player,
        bullets,
        enemies,
        particles: nextParticles,
        score,
        wave,
        spawnTimer,
        enemyId,
        status,
        highScore: Math.max(next.highScore || 0, score),
    };
}

export function togglePause(state) {
    if (state.status === 'over') return state;
    if (state.status === 'paused') return { ...state, status: 'playing' };
    return { ...state, status: 'paused' };
}
