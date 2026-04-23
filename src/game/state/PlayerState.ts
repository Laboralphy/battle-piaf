export type PlayerState = {
    hitPoints: number; // current hitpoints
    vitality: number; // maximum hitpoints
    power: number; // current power level (output damage multiplier)
    score: number; // score accumulated by damaging or killing enemies
    bulletHitStreak: number; // number of consecutive hits by a bullet
    bulletHitStreakMax: number; // maximum consecutive hits by a bullet
    bulletHitStreakTime: number; // time of last consecutive hit by a bullet
    bulletHitLastTick: number; // tick of last consecutive hit by a bullet
    displayed: boolean;
    energy: number; // each weapon costs a certain amount of energy ; weapon can be fire if cost >= energy
    maxEnergy: number; // maximum Energy
    shield: boolean; // true when shield is active
    shieldTime: number; // time before shield collapse
    powerBoostTime: number; // time before power boost expires
    plasmaBallCount: number; // number of plasma balls
    fireCount: number; // number of time, player has shot
    enemyHit: number; // number of time an enemy has been hit
    tripleBullet: boolean;
};
