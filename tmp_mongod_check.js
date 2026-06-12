const { spawn } = require('child_process');
const proc = spawn('C:/Program Files/MongoDB/Server/8.3/bin/mongod.exe', ['--version'], { windowsHide: true });
proc.stdout.on('data', (data) => console.log('OUT:', data.toString()));
proc.stderr.on('data', (data) => console.error('ERR:', data.toString()));
proc.on('close', (code) => console.log('EXIT:', code));
