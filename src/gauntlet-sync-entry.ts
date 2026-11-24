import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=5.0.1';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./gauntlet.js?v=4.01.3');
startCloudUploads();
