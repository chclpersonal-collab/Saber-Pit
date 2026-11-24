/** Frozen release runtime inputs, never generated from the current implementation. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

interface Entry { path: string; sha256: string; content: string }
interface Bundle { version: number; files: Entry[] }
interface Manifest { version: number; sha256: string; parts: {name:string;sha256:string}[]; animation:{name:string;sha256:string;contentSha256:string} }
const sha=(bytes: Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const frozenName=/^(?:dist\/(?:arcade-rules-v\d+\/)?|tests\/fixtures\/phase1-reference\/)[a-zA-Z0-9-]+\.js$/;
const binaryName=/^legacy-javascript-\d\d\.gz\.part$/;
const hex=/^[0-9a-f]{64}$/;
const archiveModuleCount=168;

export async function restoreLegacyFixtures(inDir:URL, buildDir:URL) {
  const manifest=JSON.parse(await readFile(new URL('legacy-javascript-manifest.json',inDir),'utf8')) as Manifest;
  if(manifest.version!==1||!hex.test(manifest.sha256)||!Array.isArray(manifest.parts)||manifest.parts.length!==14||
      new Set(manifest.parts.map(p=>p.name)).size!==manifest.parts.length)throw new Error('Invalid compatibility archive manifest');
  const pieces=await Promise.all(manifest.parts.map(async part=>{
    if(!binaryName.test(part.name)||!hex.test(part.sha256))throw new Error('Invalid compatibility archive part');
    const bytes=await readFile(new URL(part.name,inDir));
    if(sha(bytes)!==part.sha256)throw new Error('Compatibility archive part SHA-256 mismatch: '+part.name);
    return bytes;
  }));
  const gzip=Buffer.concat(pieces);
  if(sha(gzip)!==manifest.sha256)throw new Error('Compatibility archive SHA-256 mismatch');
  const bundle=JSON.parse(gunzipSync(gzip,{maxOutputLength:5_000_000}).toString('utf8')) as Bundle;
  if(bundle.version!==1||!Array.isArray(bundle.files)||bundle.files.length!==archiveModuleCount||
      new Set(bundle.files.map(f=>f.path)).size!==bundle.files.length)throw new Error('Invalid compatibility archive file index');
  const decoded=bundle.files.map(entry=>{
    if(!frozenName.test(entry.path)||!hex.test(entry.sha256))throw new Error('Invalid compatibility file path');
    const bytes=Buffer.from(entry.content,'base64');
    if(sha(bytes)!==entry.sha256)throw new Error('Compatibility file SHA-256 mismatch: '+entry.path);
    return {path:entry.path,bytes};
  });
  const animation=manifest.animation;
  if(animation?.name!=='legacy-animation-lab.html.gz'||!hex.test(animation.sha256)||!hex.test(animation.contentSha256))
    throw new Error('Invalid frozen Animation Lab archive record');
  const packedHTML=await readFile(new URL(animation.name,inDir));
  if(sha(packedHTML)!==animation.sha256)throw new Error('Frozen Animation Lab archive SHA-256 mismatch');
  const html=gunzipSync(packedHTML,{maxOutputLength:120_000});
  if(sha(html)!==animation.contentSha256)throw new Error('Frozen Animation Lab HTML SHA-256 mismatch');
  const put=async (path:string,bytes:Uint8Array)=>{
    const dest=new URL(path,buildDir);
    await mkdir(dirname(fileURLToPath(dest)),{recursive:true});
    await writeFile(dest,bytes);
  };
  // Verification above deliberately completes before any outputs are written.
  // Only truly historical replay modules go into the public browser artifact.
  for(const {path,bytes} of decoded){
    if(path.startsWith('dist/')){
      await put('baseline/'+path,bytes);
      if(path.startsWith('dist/arcade-rules-'))await put(path,bytes);
    }else await put(path,bytes);
  }
  await put('baseline/dist/animation-lab.html',html);
  return decoded.filter(f=>/^dist\/[^/]+$/.test(f.path)).map(f=>f.path.slice(5));
}
