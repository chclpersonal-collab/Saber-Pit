import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=new URL('..',import.meta.url);
const configPath=ts.findConfigFile(new URL('.',root).pathname,ts.sys.fileExists);
if(!configPath)throw new Error('tsconfig.json was not found');
const config=ts.readConfigFile(configPath,ts.sys.readFile);
const options=ts.parseJsonConfigFileContent(config.config,ts.sys,root.pathname);
const host=ts.createCompilerHost(options.options);
// These are true browser imports, not bundler aliases. For type checking
// only, resolve the same module path without its HTTP cache-busting query.
host.resolveModuleNames=(ids,from)=>ids.map(id=>ts.resolveModuleName(
  id.startsWith('.')?id.replace(/\?.*$/,''):id,from,options.options,host).resolvedModule);
const program=ts.createProgram(options.fileNames,options.options,host);
const diagnostics=[...options.errors,...ts.getPreEmitDiagnostics(program)];
const unchecked=options.fileNames.filter(p=>/^\s*\/\/\s*@ts-nocheck\b/m.test(ts.sys.readFile(p)??''));
const known=new Set(readFileSync(new URL('typescript-legacy-allowlist.txt',import.meta.url),'utf8').trim().split(/\r?\n/));
const newExceptions=unchecked.map(p=>relative(fileURLToPath(root),p).replaceAll('\\','/')).filter(p=>!known.has(p));
if(newExceptions.length){
  console.error('New TypeScript check exceptions are not allowed: '+newExceptions.join(', '));
  process.exitCode=1;
}
if(diagnostics.length){
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{
    getCurrentDirectory:()=>root.pathname,getNewLine:()=>'\n',getCanonicalFileName:x=>x,
  }));
  process.exitCode=1;
}else{
  console.log('TypeScript checked '+(options.fileNames.length-unchecked.length)+' modules; '+unchecked.length+' behavior-preserving ports remain unchecked.');
}
