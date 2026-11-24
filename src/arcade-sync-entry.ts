import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=5.0.1';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./arcade.js?v=5.3.0-fight');
startCloudUploads();
