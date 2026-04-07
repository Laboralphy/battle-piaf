import { initMenu, gameStart } from './menu/index.js';

window.addEventListener('load', () => {
  initMenu();
  window.addEventListener('keydown', gameStart);
});
