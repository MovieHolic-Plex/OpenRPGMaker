import ts from 'typescript';
import {resolve} from 'node:path';
const config=ts.readConfigFile('tsconfig.app.json',ts.sys.readFile);
if(config.error)throw Error(ts.flattenDiagnosticMessageText(config.error.messageText,'\n'));
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,process.cwd());
if(parsed.errors.length)throw Error('Invalid app compiler configuration');
const files=["src/editor/panels/databaseCharacterView.ts","src/editor/panels/databaseCropView.ts","src/editor/panels/databaseDailyWeatherView.ts","src/editor/panels/databaseLifeCraftingView.ts","src/player/playSceneGift.ts","src/player/playSceneInterpreter.ts","src/project/characterProfiles.ts","src/project/dailyWeather.ts","test/lifeAuthoringBounds.test.ts"];
const program=ts.createProgram([...new Set([...parsed.fileNames,...files.map(p=>resolve(p))])],parsed.options);
let count=0;for(const file of files){const source=program.getSourceFile(resolve(file));if(!source)throw Error('Missing '+file);const d=[...program.getSyntacticDiagnostics(source),...program.getSemanticDiagnostics(source)];count+=d.length;console.log(JSON.stringify({file,diagnostics:d.map(x=>({code:x.code,message:ts.flattenDiagnosticMessageText(x.messageText,'\n')}))}));}
process.exitCode=count?1:0;
