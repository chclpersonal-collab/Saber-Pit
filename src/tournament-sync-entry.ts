import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=4.01.2';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./tournament.js?v=4.01.2');
startCloudUploads();
