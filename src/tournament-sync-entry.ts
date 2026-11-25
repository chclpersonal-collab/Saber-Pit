import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=6.0.3-seat';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./tournament.js?v=6.0.3-seat');
startCloudUploads();
