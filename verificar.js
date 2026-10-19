// Gate for the HoP Heart Meter. Run: node verificar.js
const fs=require("fs"),vm=require("vm");
let fails=0;const ok=(c,m)=>{console.log((c?"ok   ":"FAIL ")+m);if(!c)fails++;};
const html=fs.readFileSync("index.html","utf8");
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
ok(scripts.length===1,"one inline script");
scripts.forEach((s,i)=>{try{new vm.Script(s);ok(true,"inline script parses")}catch(e){ok(false,"inline script parses: "+e.message)}});
try{new vm.Script(fs.readFileSync("apps-script/Code.gs","utf8"));ok(true,"Code.gs parses")}catch(e){ok(false,"Code.gs parses: "+e.message)}
try{new vm.Script(fs.readFileSync("config.js","utf8"));ok(true,"config.js parses")}catch(e){ok(false,"config.js parses: "+e.message)}
ok(/<meta name="robots" content="noindex,nofollow">/.test(html),"noindex meta");
ok(/Disallow: \//.test(fs.readFileSync("robots.txt","utf8")),"robots.txt blocks crawlers");
ok(fs.existsSync("logo.png"),"logo.png present");
const ids=[...html.matchAll(/[\s<]id="([^"$]+)"/g)].map(m=>m[1]);
ok(ids.length===new Set(ids).size,"ids are unique ("+ids.length+")");
const used=[...scripts[0].matchAll(/\$\("([\w-]+)"\)/g)].map(m=>m[1]);
const missing=[...new Set(used)].filter(x=>!ids.includes(x));
ok(missing.length===0,"every $(id) exists in the page"+(missing.length?": "+missing.join(","):""));
const files=["index.html","apps-script/Code.gs","config.js","README.md"].filter(f=>fs.existsSync(f));
ok(!files.some(f=>fs.readFileSync(f,"utf8").includes("—")),"no em dash in "+files.join(", "));
ok(!/@(gmail|mcgeheeschool|bfhsla|newmanschool|ashrosary)\.|\b504\d{7}\b/.test(html+fs.readFileSync("apps-script/Code.gs","utf8")),"no leader emails or phone numbers in the code");

// Security checks on the page
ok(/Content-Security-Policy/.test(html),"page has a Content-Security-Policy");
ok(!/data-(id|del|move|odel)="\$\{[go]\.id\}"/.test(html),"row ids are escaped before going into HTML");

// Run Code.gs against a fake Google (Sheets, Properties, Cache)
function fakeGoogle(teamCode){
  const sheets={};
  const mkSheet=name=>{const rows=[];return {rows,
    appendRow:r=>rows.push(r.slice()),setFrozenRows(){},
    getDataRange:()=>({getValues:()=>rows.map(r=>r.slice())}),
    getLastRow:()=>rows.length,getLastColumn:()=>Math.max(...rows.map(r=>r.length)),
    getRange:(r,c,nr,nc)=>({getValues:()=>{const out=[];for(let i=0;i<(nr||1);i++)out.push(rows[r-1+i].slice(c-1,c-1+(nc||1)));return out},setValue:v=>{rows[r-1][c-1]=v}}),
    deleteRow:r=>rows.splice(r-1,1)}};
  const ss={getSheetByName:n=>sheets[n]||null,insertSheet:n=>(sheets[n]=mkSheet(n))};
  const cache={};let uuid=0;
  const ctx={sheets,console,
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
    ContentService:{MimeType:{JSON:"json"},createTextOutput:t=>({setMimeType(){return this},text:t})},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>k==="TEAM_CODE"?teamCode:null})},
    CacheService:{getScriptCache:()=>({get:k=>cache[k]||null,put:(k,v)=>{cache[k]=v}})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    Utilities:{getUuid:()=>"id"+(++uuid),formatDate:()=> "2026-10-19"}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync("apps-script/Code.gs","utf8"),ctx);
  ctx.get=()=>JSON.parse(ctx.doGet().text);
  ctx.post=b=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}).text);
  return ctx;
}
try{
  const g=fakeGoogle("Secret-Code");
  ok(g.get().settings.leaders.length===17,"empty Settings falls back to the 17 leaders");
  ok(g.post({action:"check",code:"nope"}).error==="wrong_code","wrong team code is rejected");
  ok(g.post({action:"check",code:" secret-code "}).ok,"right team code works (case and spaces ignored)");
  ok(g.post({action:"add_donation",code:"Secret-Code",leader:"Nobody",amount:5}).error==="unknown_leader","unknown leader is rejected");
  ok(g.post({action:"add_donation",code:"Secret-Code",leader:"Kate",amount:-5}).error==="bad_amount","negative amount is rejected");
  const r=g.post({action:"add_donation",code:"Secret-Code",leader:"Kate",amount:"25.555",donor:'=IMPORTXML("http://x")',note:"+1 hi",date:"bad"});
  ok(r.ok,"a valid donation is saved");
  const row=g.sheets.Donations.rows[1];
  ok(row[4].startsWith("'=")&&row[7].startsWith("'+"),"formula-looking text is stored as plain text");
  ok(row[5]===25.56&&row[2]==="2026-10-19","amount is rounded and a bad date is replaced");
  ok(g.get().donations[0].amount===25.56,"the page reads back the saved donation");
  ok(g.post({action:"toggle",code:"Secret-Code",kind:"donation",id:r.id,field:"received",value:true}).ok&&g.get().donations[0].received===true,"received can be toggled");
  ok(g.post({action:"delete",code:"Secret-Code",kind:"donation",id:r.id}).ok&&g.get().donations.length===0,"a donation can be deleted");
  const logs=g.sheets.Log.rows.map(x=>x[1]);
  ok(logs.join()==="action,add,toggle,delete"&&g.sheets.Log.rows[3][4].includes("Kate"),"every write is logged and a deleted row keeps its content");
  ok(g.post({action:"add_outreach",code:"Secret-Code",leader:"Ella",org:"Shop",status:"maybe"}).error==="bad_status","unknown outreach status is rejected");
  for(let i=0;i<26;i++)g.post({action:"check",code:"guess"+i});
  ok(g.post({action:"check",code:"Secret-Code"}).error==="paused","after 25 wrong codes, writes pause");
  const g2=fakeGoogle(null);
  ok(g2.post({action:"check",code:""}).error==="wrong_code","with no TEAM_CODE set, nobody can write");
}catch(e){ok(false,"backend test crashed: "+e.message)}
console.log(fails?`\n${fails} check(s) failed`:"\nall checks passed");process.exit(fails?1:0);
