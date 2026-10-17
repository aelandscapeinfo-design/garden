// Local-only, dependency-free server for the HTML in this same folder.
import http from 'node:http';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const html=await fs.readFile(new URL('./OWOL-garden-v6.html',import.meta.url));
const port=5187, address=`http://127.0.0.1:${port}`;
const server=http.createServer((req,res)=>{
  if(req.url!=='/'&&req.url!=='/OWOL-garden-v6.html'){
    res.writeHead(404);res.end('Not found');return;
  }
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 5187 is busy. Close the earlier OWOL Garden V6 window and retry.':e.message);process.exit(1)});
server.listen(port,'127.0.0.1',()=>{
  console.log(`OWOL Garden V6 is ready. Open ${address} on THIS computer. Keep this window open. Ctrl+C stops it.`);
  if(process.argv.includes('--open')){
    const [cmd,args]=process.platform==='win32'?['cmd',['/c','start','',address]]:process.platform==='darwin'?['open',[address]]:['xdg-open',[address]];
    const child=spawn(cmd,args,{stdio:'ignore'});child.on('error',()=>console.log('Open the address above in your browser.'));
  }
});
