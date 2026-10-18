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
console.log(fails?`\n${fails} check(s) failed`:"\nall checks passed");process.exit(fails?1:0);
