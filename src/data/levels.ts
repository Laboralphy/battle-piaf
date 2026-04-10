import level0 from './level-0.json';
import level1 from './level-1.json';

export interface LevelData {
    tileset: string;
    background: string;
    map: string[];
}

export const LEVELS: LevelData[] = [level0, level1];
