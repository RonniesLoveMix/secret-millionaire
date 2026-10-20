import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
const app=express();app.use(express.json());app.use(express.static('public'));
const db=new Database(process.env.DB_PATH||'game.db');db.pragma('journal_mode = WAL');
db.exec(`CREATE TABLE IF NOT EXISTS players(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone_hash TEXT UNIQUE NOT NULL, pin_hash TEXT NOT NULL, token_hash TEXT, couple TEXT, role TEXT, missions TEXT, completed TEXT DEFAULT '[]', vote INTEGER, joined_at TEXT DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);`);
const UNLOCK_AT=Date.parse(process.env.UNLOCK_AT||'2026-10-22T20:00:00+02:00');
const FINALE_AT=Date.parse(process.env.FINALE_AT||'2026-10-24T20:00:00+02:00');
const REVEAL_AT=Date.parse(process.env.REVEAL_AT||'2026-10-24T21:00:00+02:00');
const unlocked=()=>Date.now()>=UNLOCK_AT;
const get=k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value;
const put=(k,v)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const pinHash=(pin,salt)=>crypto.scryptSync(pin,salt,64).toString('hex');
const normalize=s=>String(s||'').replace(/\D/g,'');
const fail=(res,msg,status=400)=>res.status(status).json({error:msg});
const auth=(req,res,next)=>{const token=(req.headers.authorization||'').replace(/^Bearer /,'');const p=token&&db.prepare('SELECT * FROM players WHERE token_hash=?').get(sha(token));if(!p)return fail(res,'Please sign in again.',401);req.player=p;next()};
const isAdmin=req=>req.headers['x-admin-key']&&get('admin_key_hash')===sha(req.headers['x-admin-key']);
const safe=(fn)=>(req,res)=>{try{fn(req,res)}catch(e){console.error(e);fail(res,'Something went wrong.')}};

const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a};
function transition(){
 const now=Date.now();
 if(now>=UNLOCK_AT && get('started')!=='true'){
  const players=db.prepare('SELECT id FROM players').all();
  if(players.length===12){
   const bank=JSON.parse(fs.readFileSync('private/missions.json','utf8'));
   if(Array.isArray(bank)&&bank.length>=60&&new Set(bank).size>=60){
    const chosen=shuffle(bank).slice(0,60),millionaire=shuffle(players)[0].id;
    db.transaction(()=>{players.forEach((p,i)=>db.prepare('UPDATE players SET role=?,missions=?,completed=?,vote=NULL WHERE id=?').run(p.id===millionaire?'SECRET MILLIONAIRE':'PLAYER',JSON.stringify(chosen.slice(i*5,i*5+5)),'[]',p.id));put('started','true')})();
   }
  }
 }
 if(now>=FINALE_AT&&get('started')==='true'&&get('closed')!=='true')put('closed','true');
 if(get('closed')==='true'&&get('revealed')!=='true'&&
   (db.prepare('SELECT COUNT(*) n FROM players WHERE vote IS NOT NULL').get().n===12 || now>=REVEAL_AT))put('revealed','true');
}
app.use('/api',(req,res,next)=>{try{transition();next()}catch(e){console.error('Game transition failed:',e);fail(res,'Game is temporarily unavailable.',503)}});
app.get('/api/status',safe((req,res)=>res.json({registered:db.prepare('SELECT COUNT(*) n FROM players').get().n,started:get('started')==='true'&&unlocked(),unlockAt:new Date(UNLOCK_AT).toISOString(),closed:get('closed')==='true',revealed:get('revealed')==='true',max:12})));
app.post('/api/register',safe((req,res)=>{if(get('started')==='true'||Date.now()>=UNLOCK_AT)return fail(res,'Registration has closed.');const {name,phone,pin,couple}=req.body;const ph=normalize(phone);if(!name?.trim()||ph.length<9||!/^[0-9]{6,12}$/.test(String(pin||'')))return fail(res,'Enter a name, valid phone and a 6–12 digit PIN.');if(db.prepare('SELECT COUNT(*) n FROM players').get().n>=12)return fail(res,'All 12 places are filled.');const salt=crypto.randomBytes(16).toString('hex');const token=crypto.randomBytes(32).toString('hex');db.prepare('INSERT INTO players(name,phone_hash,pin_hash,token_hash,couple) VALUES(?,?,?,?,?)').run(name.trim().slice(0,60),sha(ph),salt+':'+pinHash(String(pin),salt),sha(token),String(couple||'').trim().slice(0,40));res.json({token});}));
app.post('/api/login',safe((req,res)=>{const p=db.prepare('SELECT * FROM players WHERE phone_hash=?').get(sha(normalize(req.body.phone)));if(!p)return fail(res,'Incorrect login.',401);const [salt,hash]=p.pin_hash.split(':');if(pinHash(String(req.body.pin||''),salt)!==hash)return fail(res,'Incorrect login.',401);const token=crypto.randomBytes(32).toString('hex');db.prepare('UPDATE players SET token_hash=? WHERE id=?').run(sha(token),p.id);res.json({token});}));
app.get('/api/me',auth,safe((req,res)=>{const p=db.prepare('SELECT * FROM players WHERE id=?').get(req.player.id);const started=get('started')==='true'&&unlocked(),revealed=get('revealed')==='true';res.json({name:p.name,started,closed:get('closed')==='true',revealed,role:started?p.role:null,missions:started?JSON.parse(p.missions||'[]'):[],completed:JSON.parse(p.completed||'[]'),voted:!!p.vote,players:started?db.prepare('SELECT id,name FROM players ORDER BY name').all():[],result:revealed?db.prepare('SELECT name,role,missions,completed FROM players').all().map(x=>({...x,missions:JSON.parse(x.missions),completed:JSON.parse(x.completed)})):null});}));
app.post('/api/complete',auth,safe((req,res)=>{if(get('started')!=='true'||!unlocked())return fail(res,'Vaults are still sealed.');if(get('closed')==='true')return fail(res,'Missions are closed.');const p=req.player;const i=Number(req.body.index),missions=JSON.parse(p.missions||'[]');if(!Number.isInteger(i)||i<0||i>=missions.length)return fail(res,'Invalid mission.');const done=new Set(JSON.parse(p.completed||'[]'));if(done.has(i))done.delete(i);else done.add(i);db.prepare('UPDATE players SET completed=? WHERE id=?').run(JSON.stringify([...done]),p.id);res.json({ok:true});}));
app.post('/api/vote',auth,safe((req,res)=>{if(get('closed')!=='true')return fail(res,'Voting opens at the finale.');if(get('revealed')==='true')return fail(res,'Voting has closed.');const target=Number(req.body.id);if(target===req.player.id||!db.prepare('SELECT id FROM players WHERE id=?').get(target))return fail(res,'Choose another player.');db.prepare('UPDATE players SET vote=? WHERE id=?').run(target,req.player.id);res.json({ok:true});}));
app.post('/api/admin/setup',safe((req,res)=>{if(get('admin_key_hash'))return fail(res,'Already configured.');if(process.env.ADMIN_SETUP_SECRET&&req.headers['x-setup-secret']!==process.env.ADMIN_SETUP_SECRET)return fail(res,'Setup forbidden.',403);const key=String(req.body.key||'');if(key.length<20)return fail(res,'Use an admin key of at least 20 characters.');put('admin_key_hash',sha(key));res.json({ok:true});}));
app.get('/api/admin/status',safe((req,res)=>{if(!isAdmin(req))return fail(res,'Unauthorized.',401);res.json({players:db.prepare('SELECT id,name,couple FROM players').all(),started:get('started'),closed:get('closed'),revealed:get('revealed')});}));
app.post('/api/admin/start',safe((req,res)=>{if(!isAdmin(req))return fail(res,'Unauthorized.',401);if(get('started')==='true')return fail(res,'Already started.');const players=db.prepare('SELECT id FROM players').all();if(players.length!==12)return fail(res,'Exactly 12 players required.');const missionBank=JSON.parse(fs.readFileSync('private/missions.json','utf8'));if(!Array.isArray(missionBank)||missionBank.length<60||missionBank.some(x=>typeof x!=='string'||!x.trim())||new Set(missionBank).size<60)return fail(res,'Need at least 60 distinct, approved missions.');const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a};const selected=shuffle(missionBank).slice(0,60),roles=shuffle(players);const millionaire=roles[0].id;
const tx=db.transaction(()=>{players.forEach((p,i)=>db.prepare('UPDATE players SET role=?,missions=?,completed=?,vote=NULL WHERE id=?').run(p.id===millionaire?'SECRET MILLIONAIRE':'PLAYER',JSON.stringify(selected.slice(i*5,i*5+5)),'[]',p.id));put('started','true');});tx();res.json({ok:true,message:'Game started. Roles and missions are sealed.'});}));
app.post('/api/admin/close',safe((req,res)=>{if(!isAdmin(req))return fail(res,'Unauthorized.',401);if(get('started')!=='true')return fail(res,'Game not started.');put('closed','true');res.json({ok:true});}));
app.post('/api/admin/reveal',safe((req,res)=>{if(!isAdmin(req))return fail(res,'Unauthorized.',401);if(get('closed')!=='true')return fail(res,'Close missions first.');if(db.prepare('SELECT COUNT(*) n FROM players WHERE vote IS NOT NULL').get().n!==12)return fail(res,'All 12 players must vote.');put('revealed','true');res.json({ok:true});}));
if(process.env.RENDER&&!process.env.DB_PATH)console.error('CRITICAL: DB_PATH not configured; Render local data may disappear on redeploy. Do not invite players.');
app.post('/api/change-name', auth, safe((req, res) => {
  const name = String(req.body.name || '').trim();

  if (name.length < 2 || name.length > 60) {
    return fail(res, 'Enter a name between 2 and 60 characters.');
  }

  if (get('started') === 'true') {
    return fail(res, 'Names cannot be changed after the game starts.');
  }

  db.prepare('UPDATE players SET name=? WHERE id=?')
    .run(name, req.player.id);

  res.json({ok:true});
}));app.listen(process.env.PORT||3000,()=>console.log('Secret Millionaire running'));
