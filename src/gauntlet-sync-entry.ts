import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=4.01.1';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./gauntlet.js?v=4.01.1');
startCloudUploads();
