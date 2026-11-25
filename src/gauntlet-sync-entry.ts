import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=6.0.2-rc2';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./gauntlet.js?v=6.0.2-rc2');
startCloudUploads();
