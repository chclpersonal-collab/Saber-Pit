/** Runtime inputs for emitted tools; browser modules and fixtures belong to the build. */
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export const runtimeDir: string=fileURLToPath(new URL('../dist/',import.meta.url));

/** Index request paths including archived engines and nested images. */
export async function readBrowserAssets(directory: string): Promise<Map<string,Buffer>> {
  const files = new Map<string,Buffer>();
  async function scan(parent: string, prefix: string): Promise<void> {
    const entries=await readdir(parent,{withFileTypes:true});
    entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
    for(const entry of entries){
      const name=prefix+entry.name, absolute=join(parent,entry.name);
      if(entry.isDirectory()) await scan(absolute,name+'/');
      else if(entry.isFile()) files.set(name,await readFile(absolute));
    }
  }
  await scan(directory,'');
  return files;
}
