// @ts-nocheck
import {syncBeforeGame,startCloudUploads} from './cloud-sync-browser.js?v=3.3.0';
try{await syncBeforeGame();}catch{/* Always open the game offline. */}
await import('./tournament.js?v=4.0.0');
startCloudUploads();
