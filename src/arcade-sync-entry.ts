import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=5.0.1';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./arcade.js?v=5.2.1-results');
startCloudUploads();
