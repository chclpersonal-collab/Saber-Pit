import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=4.01.3';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./idle-rpg.js?v=4.01.3');
startCloudUploads();
