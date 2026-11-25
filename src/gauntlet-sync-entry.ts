import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=6.0.3-seat';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./gauntlet.js?v=6.0.3-seat');
startCloudUploads();
