import type { LevelData } from '../game/levels';
import level0 from './level-0.json';
import level1 from './level-1.json';
import level2 from './level-2.json';

const levels: Record<string, LevelData> = {
    'level-0': level0 as unknown as LevelData,
    'level-1': level1 as unknown as LevelData,
    'level-2': level2 as unknown as LevelData,
};

export default levels;
