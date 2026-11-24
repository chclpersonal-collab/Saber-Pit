import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=5.0.1';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./tournament.js?v=5.1.0');
startCloudUploads();
