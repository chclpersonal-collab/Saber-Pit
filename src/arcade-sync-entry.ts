import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=4.01.4';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./arcade.js?v=4.01.4');
startCloudUploads();
