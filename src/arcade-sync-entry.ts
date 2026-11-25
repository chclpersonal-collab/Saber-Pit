import './pit-v3-ui.js?v=5.3.0-setup';
import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=5.0.1';
try{await syncBeforeGame();}catch{/* Keep local saves available when offline. */}
await import('./arcade.js?v=5.3.0-fight');
await import('./arcade-v6-shell.js?v=6.0.0');
startCloudUploads();
