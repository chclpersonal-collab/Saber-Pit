import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=6.0.2';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./idle-rpg.js?v=6.0.3-seat');
startCloudUploads();
