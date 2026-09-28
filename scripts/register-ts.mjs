import {registerHooks} from 'node:module';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('@/')) {
      const base=path.join(root,specifier.slice(2));
      const file=[base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(existsSync);
      if(file) return {url:pathToFileURL(file).href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules')) return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};
    return next(url,context);
  }
});
