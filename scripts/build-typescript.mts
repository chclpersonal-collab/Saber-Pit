import ts from 'typescript';
import {cp,mkdir,mkdtemp,readFile,readdir,rename,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {restoreLegacyFixtures} from './legacy-fixtures.mts';

const root=new URL('../',import.meta.url);
const source=new URL('src/',root), out=new URL('build/',root), inputAssets=new URL('dist/',root);
const stagedPath=await mkdtemp(fileURLToPath(new URL('.saber-build-',root)));
const staged=pathToFileURL(stagedPath+'/');
const distOut=new URL('dist/',staged);
const executable=/\.(?:[cm]?js|jsx)$/i;
const options:ts.CompilerOptions={
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,verbatimModuleSyntax:true,isolatedModules:true,
  rewriteRelativeImportExtensions:true,
};
async function transpile(input:URL,output:URL,browser=false){
  const code=await readFile(input,'utf8');
  const result=ts.transpileModule(code,{fileName:fileURLToPath(input),reportDiagnostics:true,compilerOptions:browser?{...options,rewriteRelativeImportExtensions:false}:options});
  const errors=(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
  if(errors.length)throw new Error(fileURLToPath(input)+': '+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  await writeFile(output,result.outputText);
}
async function tools(from:URL,to:URL){
  await mkdir(to,{recursive:true});
  for(const entry of await readdir(from,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw new Error('Unexpected symlink in authored test/tool source: '+entry.name);
    if(entry.isDirectory()){
      await tools(new URL(entry.name+'/',from),new URL(entry.name+'/',to));
    }else if(entry.name.endsWith('.mts')){
      await transpile(new URL(entry.name,from),new URL(entry.name.replace(/\.mts$/,'.mjs'),to));
    }else if(entry.name.endsWith('.ts')&&!entry.name.endsWith('.d.ts')){
      await transpile(new URL(entry.name,from),new URL(entry.name.replace(/\.ts$/,'.js'),to));
    }else if(executable.test(entry.name)){
      throw new Error('Unexpected JavaScript source file: '+fileURLToPath(new URL(entry.name,from)));
    }else{
      await cp(new URL(entry.name,from),new URL(entry.name,to));
    }
  }
}
try {
  // Checked-in dist is static input only; generated dist is served.
  await cp(inputAssets,distOut,{recursive:true,filter:name=>{
    if(executable.test(name))throw new Error('Executable JavaScript in checked-in assets: '+name);
    return true;
  }});
  await cp(new URL('animation-lab.html',source),new URL('animation-lab.html',distOut));
  for(const base of ['docs','package.json']){
    await cp(new URL(base,root),new URL(base,staged),{recursive:true});
  }
  // Only runtime assets are web-served. The archive and independent oracles
  // never get a public HTTP route.
  await tools(new URL('tests/',root),new URL('tests/',staged));
  await tools(new URL('scripts/',root),new URL('scripts/',staged));
  const reference=await restoreLegacyFixtures(new URL('fixtures/',root),staged);
  const names=(await readdir(source)).filter(name=>name.endsWith('.ts')&&!name.endsWith('.d.ts'));
  const ports=new Set(names.map(name=>name.replace(/\.ts$/,'.js')));
  if(reference.some(x=>!ports.has(x)))throw new Error('Missing TS ports: '+reference.filter(x=>!ports.has(x)).join(', '));
  for(const name of names)await transpile(new URL(name,source),new URL(name.replace(/\.ts$/,'.js'),distOut),true);
  for(const page of (await readdir(distOut)).filter(file=>file.endsWith('.html'))){
    const markup=await readFile(new URL(page,distOut),'utf8');
    for(const [,attrs,body] of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
      if(!body.trim()||/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attrs))continue;
      throw new Error(page+' has an inline script; emit executable code from src/ instead');
    }
  }
  await rm(out,{recursive:true,force:true});
  await rename(staged,out);
  console.log('Built '+names.length+' TypeScript browser modules; verified historical replays.');
} finally {
  await rm(staged,{recursive:true,force:true});
}
