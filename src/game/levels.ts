import level0 from '../data/level-0.json';
import level1 from '../data/level-1.json';

export interface LevelData {
    tileset: string;
    background: string;
    music: string;
    map: string[];
}

export const LEVELS: LevelData[] = [level0, level1];
