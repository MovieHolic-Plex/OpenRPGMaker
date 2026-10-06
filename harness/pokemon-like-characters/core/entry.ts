import {run} from './cli'; run(process.argv.slice(2)).then(code=>process.exitCode=code);
