import ts from 'typescript';
import {cp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=new URL('../',import.meta.url), src=new URL('src/',root), build=new URL('build/',root);
const assetSource=new URL('dist/',root);
const distOut=new URL('dist/',build);
await rm(build,{recursive:true,force:true});
await mkdir(build,{recursive:true});
// Assets are checked-in release inputs. Browser JS is emitted exclusively
// from src/, so a missing migration cannot silently use the old release file.
// Nested archived rulesets are frozen replay inputs, copied byte-for-byte.
const assetPath=resolve(fileURLToPath(assetSource));
await cp(assetSource,distOut,{recursive:true,filter:name=>dirname(name)!==assetPath||!name.endsWith('.js')});
// The diagnostic page used to embed a large untyped controller. Keep the
// original page runnable in the frozen release and ship the new template here.
await cp(new URL('animation-lab.html',src),new URL('animation-lab.html',distOut));
for(const base of ['tests','docs','scripts','package.json']){
  await cp(new URL(base,root),new URL(base,build),{recursive:true});
}
const names=(await readdir(src)).filter(name=>name.endsWith('.ts')&&!name.endsWith('.d.ts'));
const ports=new Set(names.map(name=>name.replace(/\.ts$/,'.js')));
const old=(await readdir(assetSource)).filter(x=>x.endsWith('.js'));
if(old.some(x=>!ports.has(x)))throw new Error('Missing TS ports: '+old.filter(x=>!ports.has(x)).join(', '));
for(const name of names){
  const source=await readFile(new URL(name,src),'utf8');
  const transpiled=ts.transpileModule(source,{
    fileName:name,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,verbatimModuleSyntax:true,isolatedModules:true},
  });
  if(transpiled.diagnostics.some(d=>d.category===ts.DiagnosticCategory.Error))
    throw new Error(name+': '+transpiled.diagnostics.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')).join('\n'));
  const output=new URL(name.replace(/\.ts$/,'.js'),distOut);
  // Legacy ports contain only ES2022 JavaScript under the explicit check
  // exception. Keep their exact bytes, not compiler formatting changes.
  const draft=source.match(/^\/\/ @ts-nocheck\r?\n/);
  const js=draft?source.slice(draft[0].length):transpiled.outputText;
  if(draft){
    const check=ts.createSourceFile(name.replace(/\.ts$/,'.js'),js,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
    if(check.parseDiagnostics.length)throw new Error('Use a checked TS source for TypeScript syntax: '+name);
  }
  await writeFile(output,js);
}
for(const page of (await readdir(distOut)).filter(file=>file.endsWith('.html'))){
  const markup=await readFile(new URL(page,distOut),'utf8');
  for(const [,attrs,body] of markup.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
    if(!body.trim()||/\btype\s*=\s*["']application\/(?:ld\+)?json["']/i.test(attrs))continue;
    throw new Error(page+' has an inline script; emit executable code from src/ instead');
  }
}
console.log('Built '+names.length+' browser modules → '+fileURLToPath(distOut));
