/**
 * Build walk-inspect.html from index.html.
 * The game file stays one standalone HTML. This viewer is a generated copy
 * with load-one-plot plumbing and inspection presentation only.
 * Run: node tools/build-walk-viewer.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'index.html');
const outPath = join(root, 'walk-inspect.html');
let src = readFileSync(srcPath, 'utf8');
const md5 = createHash('md5').update(src).digest('hex');
const sha = createHash('sha256').update(src).digest('hex');

function once(hay, needle, repl, label) {
  const n = hay.split(needle).length - 1;
  if (n !== 1) throw new Error(label + ': expected 1 match, found ' + n);
  return hay.replace(needle, repl);
}

const SIGNS = {
  1: 'RIVERSIDE APARTMENTS',
  2: 'CORNER STORE  24H',
  3: 'POLICE DEPT.',
  4: 'ST. MERCY HOSPITAL',
  5: 'FIRE STATION 7',
  6: 'RIVERSIDE POWER STATION',
  8: 'NORTHGATE OFFICES',
  10: 'NORTH DEPOT LOGISTICS',
  14: 'BLACKPINE HIGH SCHOOL',
  16: 'REDLINE AUTO & SPEED SHOP',
  22: 'FORT HARVEST · 7TH MILITARY OUTPOST',
};
for (const sign of Object.values(SIGNS)) {
  const n = src.split("sign:['" + sign + "'").length - 1;
  if (n !== 1) throw new Error('sign not unique in index.html: ' + sign + ' (' + n + ')');
}

src = once(
  src,
  'function makeModel2(s){const LPS=[],IDRS=[];',
  'function makeModel2(s){const __one=window.__DH_ONE;if(__one&&__one.sign&&(!s.sign||s.sign[0]!==__one.sign)){const hw=(s.w||8)/2,hd=(s.d||8)/2,lv=s.lv||1,cols=Object.assign([],{H:(s.fl||lv)*4});return{grp:new T.Group(),cols,ramps:[],hw,hd,lv,lamps:[],idoors:[],door:null,mast:null,__dhStub:1};}const LPS=[],IDRS=[];',
  'makeModel2',
);

src = once(
  src,
  " for(const p of PLOTS){if(p.occ){const m=p.occ,S=slots(p,m.hd);place(m,S.x,S.z,p.rot);plotSign(p,m.name.split(' (')[0].toUpperCase())}else{p.filler=true;filler(p);plotSign(p,'FILLER HOUSE')}}",
  " for(const p of PLOTS){if(window.__DH_ONE&&p.n!==window.__DH_ONE.plot)continue;if(p.occ&&p.occ.__dhStub)continue;if(p.occ){const m=p.occ,S=slots(p,m.hd);place(m,S.x,S.z,p.rot);plotSign(p,m.name.split(' (')[0].toUpperCase())}else if(!window.__DH_ONE){p.filler=true;filler(p);plotSign(p,'FILLER HOUSE')}}",
  'plot loop',
);

src = once(
  src,
  '{const n=TRS.length,cnt=[0,0,0];for(let i=0;i<n;i++)cnt[i%3]++;',
  'if(!window.__DH_ONE){const n=TRS.length,cnt=[0,0,0];for(let i=0;i<n;i++)cnt[i%3]++;',
  'trees',
);

src = once(
  src,
  'vm.visible=foot;vmS.forEach((g,i)=>g.visible=foot&&i===wi);',
  'vm.visible=window.__DH_ONE?false:foot;vmS.forEach((g,i)=>g.visible=!window.__DH_ONE&&foot&&i===wi);',
  'weapon',
);

const h9 = src.indexOf('const OX=-335,OZ=-824');
if (h9 < 0) throw new Error('H-9 anchor missing');
const tryAt = src.lastIndexOf('try{', h9);
if (tryAt < 0 || h9 - tryAt > 80) throw new Error('H-9 try{ not next to OX');
src = src.slice(0, tryAt + 4) + 'if(window.__DH_ONE)return;' + src.slice(tryAt + 4);

src = once(
  src,
  "if(typeof scene==='undefined'||typeof T==='undefined'){console.error('[apoc] scope missing');return}",
  "if(window.__DH_ONE)return;if(typeof scene==='undefined'||typeof T==='undefined'){console.error('[apoc] scope missing');return}",
  'apoc',
);

src = once(
  src,
  'const C=window.STORY_CONFIG;if(!C||!C.enabled)return;',
  'if(window.__DH_ONE&&!window.__DH_ONE.story&&window.STORY_CONFIG)window.STORY_CONFIG.enabled=false;const C=window.STORY_CONFIG;if(!C||!C.enabled)return;',
  'story',
);

const boot = `<script id="dh-one-boot">
(function(){
  var q=new URLSearchParams(location.search);
  var plot=parseInt(q.get('plot')||'1',10);
  var signs=${JSON.stringify(SIGNS)};
  var sign=signs[plot]||null;
  var gfxRaw=q.get('gfx');
  var gfx=(gfxRaw==null||gfxRaw==='')?3:Math.max(0,Math.min(3,parseInt(gfxRaw,10)||0));
  var story=q.get('story')==='1';
  window.__DH_ONE={plot:plot,sign:sign,gfx:String(gfx),story:story,sourceMd5:'${md5}',sourceSha256:'${sha}',builtFrom:'index.html',
    error:sign?null:('Plot '+plot+' is not in the viewer sign map. Supported plots: '+Object.keys(signs).join(', ')+'. Houses without a makeModel2 sign are not loaded.')};
  var mem={dhGfx2:String(gfx)};
  var memLS={getItem:function(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null},setItem:function(k,v){mem[k]=String(v)},removeItem:function(k){delete mem[k]},clear:function(){Object.keys(mem).forEach(function(k){delete mem[k]})},key:function(i){return Object.keys(mem)[i]||null},get length(){return Object.keys(mem).length}};
  try{Object.defineProperty(window,'localStorage',{configurable:true,enumerable:true,get:function(){return memLS}})}catch(e){window.__DH_ONE.storageError=String(e)}
  window.__DH_ONE.storageIsolated=(function(){try{return window.localStorage===memLS}catch(e){return false}})();
  function mark(){document.documentElement.classList.add('dh-inspect');if(document.body)document.body.classList.add('dh-inspect')}
  if(document.body)mark();else document.addEventListener('DOMContentLoaded',mark);
  function banner(){
    if(!document.body||document.getElementById('dhOneBanner'))return;
    var b=document.createElement('div');b.id='dhOneBanner';
    b.textContent=window.__DH_ONE.error||('INSPECT plot '+plot+' · '+(sign||'')+' · Walk · gfx '+gfx+' · saves off');
    document.body.appendChild(b);
  }
  if(document.body)banner();else document.addEventListener('DOMContentLoaded',banner);
})();
</script>
<style id="dh-inspect-css">
/* Viewer presentation only. The building, doors, and breakers are unchanged. */
body.dh-inspect #xh,body.dh-inspect #pcx,body.dh-inspect #sPop,body.dh-inspect #sHud,body.dh-inspect #sObj,body.dh-inspect #sSide,body.dh-inspect #sFlash,body.dh-inspect #msg,body.dh-inspect #help,body.dh-inspect #pch,body.dh-inspect #pcc,body.dh-inspect #pck,body.dh-inspect #pcHint,body.dh-inspect #pcClick,body.dh-inspect #hit,body.dh-inspect #gb{display:none!important}
#dhOneBanner{position:fixed;left:8px;bottom:8px;z-index:80;max-width:min(560px,92vw);background:rgba(10,14,12,.82);color:#f2ecd8;font:12px/1.35 system-ui,sans-serif;padding:6px 8px;border-radius:8px}
#dhOneBanner button{margin:4px 4px 0 0;padding:3px 8px;border-radius:6px;border:1px solid #6a6a50;background:#26261c;color:#f0e8c8;font:600 11px system-ui;cursor:pointer}
</style>
`;

src = once(src, '<script>\nconst T=THREE;\n', boot + '<script>\nconst T=THREE;\n', 'boot insert');

const inspect = `
if(window.__DH_ONE){(function(){try{
  var one=window.__DH_ONE;
  var placed=insts.filter(function(q){return q.m&&!q.m.__dhStub});
  var I=placed.filter(function(q){return q.m.door})[0]||placed[0]||null;
  one.placed=placed.map(function(q){return{n:q.m.name,x:q.x,z:q.z}});
  one.building=I&&I.m?I.m.name:null;
  one.doors=I?(bdoors.filter(function(d){return d.I===I}).length):0;
  one.floor=0;
  one.orbit=false;
  one.cut=false;
  one.tx=0;one.tz=0;
  vm.visible=false;
  var orb={on:false,az:0.9,el:0.55,dist:Math.max(14,(I&&I.m?Math.max(I.m.hw,I.m.hd):8)*1.4)};
  var cutPlane=new T.Plane(new T.Vector3(0,-1,0),80);
  function yCut(){return ((one.floor||0)+1)*FH-0.2}
  function faceYaw(face){
    var s=I?I.s:1;
    if(face==='s')return s>0?Math.PI:0;
    if(face==='n')return s>0?0:Math.PI;
    if(face==='e')return s>0?-Math.PI/2:Math.PI/2;
    if(face==='w')return s>0?Math.PI/2:-Math.PI/2;
    return 0;
  }
  one.look=function(lx,ly,lz,face){if(!I)return;pl.set(I.x+lx*I.s,ly,I.z+lz*I.s);yaw=faceYaw(face||'n');pit=-0.12;one.floor=Math.max(0,Math.round(ly/FH))};
  function go(floor){
    if(!I||!I.m.door)return;
    var D=I.m.door,cx=(D.a+D.b)/2,lv=I.m.lv||1,f=Math.max(0,Math.min(lv-1,floor|0));
    var inside=f>0,lz=inside?(D.pi-1.6):(D.po+4.5);
    one.floor=f;
    if(orb.on)return;
    pl.set(I.x+cx*I.s,inside?f*FH:0,I.z+lz*I.s);
    yaw=I.s>0?0:Math.PI;pit=inside?-0.02:-0.08;
  }
  one.go=go;
  if(I)go(0);
  function applyCut(){
    if(!one.cut){if(ren.clippingPlanes&&ren.clippingPlanes.length)ren.clippingPlanes=[];return}
    cutPlane.constant=yCut();
    if(!ren.clippingPlanes||ren.clippingPlanes[0]!==cutPlane)ren.clippingPlanes=[cutPlane];
  }
  function orbApply(){
    if(!orb.on||!I)return;
    var base=(one.floor||0)*FH,tx=I.x+(one.tx||0)*I.s,tz=I.z+(one.tz||0)*I.s;
    var el=orb.el,dist=Math.max(one.cut?6:4,orb.dist);
    if(one.cut){el=Math.max(.35,Math.min(1.15,el));var horiz=Math.max(.35,Math.cos(Math.min(el,1)));
      cam.position.set(tx+Math.sin(orb.az)*dist*horiz, Math.max(yCut()+.8, base+1.2+dist*Math.sin(el)), tz+Math.cos(orb.az)*dist*horiz);
      cam.lookAt(tx,base+1.15,tz);
    }else{var cy=Math.cos(el),sy=Math.sin(el);
      cam.position.set(I.x+Math.sin(orb.az)*dist*cy, base+2+dist*sy, I.z+Math.cos(orb.az)*dist*cy);
      cam.lookAt(I.x,base+2,I.z)}
    vm.visible=false;
  }
  var _ren=ren.render.bind(ren);
  ren.render=function(s,c){applyCut();if(orb.on&&s===scene)orbApply();if(window.__DH_ONE)vm.visible=false;return _ren(s,c)};
  function setOrbit(on){orb.on=!!on;one.orbit=orb.on;vm.visible=false;if(orb.on){try{if(document.pointerLockElement)document.exitPointerLock()}catch(e){}}else{cam.rotation.order='YXZ'}}
  one.setOrbit=setOrbit;
  var drag=null;
  addEventListener('pointerdown',function(e){if(!orb.on)return;if(e.target&&e.target.closest&&e.target.closest('button,input,select,textarea,#dhOneBanner'))return;drag={x:e.clientX,y:e.clientY,b:e.button}},true);
  addEventListener('pointermove',function(e){if(!drag||!orb.on)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    if(e.shiftKey&&one.cut&&I){var k=.04;one.tx=Math.max(-I.m.hw+1,Math.min(I.m.hw-1,(one.tx||0)-dx*k));one.tz=Math.max(-I.m.hd+1,Math.min(I.m.hd-1,(one.tz||0)+dy*k))}
    else if(drag.b===2){orb.dist=Math.max(one.cut?6:4,Math.min(180,orb.dist+dy*0.05))}
    else{orb.az-=dx*0.007;orb.el=Math.max(one.cut?.2:-.15,Math.min(1.35,orb.el+dy*0.005))}},true);
  addEventListener('pointerup',function(){drag=null},true);
  addEventListener('wheel',function(e){if(!orb.on)return;orb.dist=Math.max(4,Math.min(180,orb.dist*(e.deltaY>0?1.12:1/1.12)))},{passive:true});
  var colG=null,colOpt={on:false,xray:true};
  function edges(P,x0,x1,y0,y1,z0,z1){var c=[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],e=[0,1,1,2,2,3,3,0,4,5,5,6,6,7,7,4,0,4,1,5,2,6,3,7];for(var i=0;i<e.length;i++)P.push(c[e[i]][0],c[e[i]][1],c[e[i]][2])}
  function inB(x0,x1,z0,z1){if(!I)return false;var m=8;return x1>I.x-I.m.hw-m&&x0<I.x+I.m.hw+m&&z1>I.z-I.m.hd-m&&z0<I.z+I.m.hd+m}
  function buildCol(){
    if(colG){scene.remove(colG);colG.traverse(function(o){if(o.geometry)o.geometry.dispose()});colG=null}
    one.colOn=colOpt.on;one.xray=colOpt.xray;if(!colOpt.on)return;
    colG=new T.Group();colG.name='inspect collision overlay';
    var P=[];
    boxes.forEach(function(b){if(b.hw===undefined)return;var x0=b.x-b.hw,x1=b.x+b.hw,z0=b.z-b.hd,z1=b.z+b.hd;if(!inB(x0,x1,z0,z1))return;var y0=b.y0!==undefined?b.y0:0,y1=b.low?1.5:(b.y1!==undefined?b.y1:(b.c?0.2:4));edges(P,x0,x1,y0,y1,z0,z1)});
    if(I){var H=I.m.cols&&I.m.cols.H||I.m.lv*FH;I.cols.forEach(function(c){var y0,y1;if(c.lv===undefined){y0=0;y1=c.top!==undefined?c.top:Math.min(12.5,H)}else{y0=c.lv*FH;y1=c.top!==undefined?c.top:y0+1.2}edges(P,c.x-c.hw,c.x+c.hw,y0,y1,c.z-c.hd,c.z+c.hd)});
      (I.m.ramps||[]).forEach(function(r){var y0=r.y0!==undefined?r.y0:r.k*FH,y1=y0+(r.h!==undefined?r.h:FH),ax=I.x+r.x0*I.s,bx=I.x+r.x1*I.s,az=I.z+r.z0*I.s,bz=I.z+r.z1*I.s;edges(P,Math.min(ax,bx),Math.max(ax,bx),y0,y1,Math.min(az,bz),Math.max(az,bz))})}
    bdoors.forEach(function(d){if(I&&d.I!==I)return;var c=d.col;edges(P,c.x-c.hw,c.x+c.hw,d.y||0,(d.y||0)+2.4,c.z-c.hd,c.z+c.hd)});
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));
    var mat=new T.LineBasicMaterial({color:0x7dff9a,depthTest:!colOpt.xray,transparent:true,opacity:.9,fog:false});
    var lines=new T.LineSegments(g,mat);lines.frustumCulled=false;lines.renderOrder=999;colG.add(lines);scene.add(colG);
    one.colSegs=P.length/6;
  }
  one.toggleCol=function(){colOpt.on=!colOpt.on;buildCol()};
  one.toggleXray=function(){colOpt.xray=!colOpt.xray;if(colOpt.on)buildCol();else one.xray=colOpt.xray};
  one.colOn=false;one.xray=true;
  one.toggleCut=function(){one.cut=!one.cut;if(one.cut)setOrbit(true);applyCut()};
  one.view=function(){var n=0;if(I&&I.g)I.g.traverse(function(o){if(o.isMesh)n++});return{weapon:!!vm.visible,foot:foot,orbit:!!orb.on,cut:!!one.cut,floor:one.floor,x:pl.x,y:pl.y,z:pl.z,meshes:n,gfx:(window.dhGfx&&window.dhGfx.get)?window.dhGfx.get():null,clip:(ren.clippingPlanes&&ren.clippingPlanes.length)||0}};
  addEventListener('keydown',function(e){
    if(e.repeat)return;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName||''))return;
    if(e.code==='Backslash'){one.toggleCol();e.preventDefault();return}
    if(e.code==='Equal'){setOrbit(!orb.on);e.preventDefault();return}
    if(e.code==='Backquote'){var b=document.getElementById('dhOneBanner');if(b)b.style.display=b.style.display==='none'?'block':'none';return}
    if(!I||!I.m.door)return;
    var D=I.m.door,lv=I.m.lv||1,f=one.floor||0;
    if(e.code==='BracketRight'){go(Math.min(lv-1,f+1));e.preventDefault()}
    else if(e.code==='BracketLeft'){go(Math.max(0,f-1));e.preventDefault()}
    else if(e.code==='Slash'){go(0);e.preventDefault()}
    else if(e.code==='Semicolon'){pl.set(I.x,0,I.z-(D.po+4.5)*I.s);yaw=I.s>0?Math.PI:0;pit=-0.08;one.floor=0;setOrbit(false)}
    else if(e.code==='Comma'){pl.set(I.x-(I.m.hw+4)*I.s,0,I.z);yaw=I.s>0?Math.PI/2:-Math.PI/2;pit=-0.08;setOrbit(false)}
    else if(e.code==='Period'){pl.set(I.x+(I.m.hw+4)*I.s,0,I.z);yaw=I.s>0?-Math.PI/2:Math.PI/2;pit=-0.08;setOrbit(false)}
  },true);
  var bar=document.getElementById('dhOneBanner');
  if(bar){
    var note=one.error?one.error:('INSPECT plot '+one.plot+' · '+(one.building||one.sign||'')+' · Walk · gfx '+one.gfx+' · weapon and story hidden · [ ] floor · Cutaway lifts the roof · \\\\ overlay · = orbit · shift-drag pans the floor target');
    if(!one.storageIsolated)note+=' · STORAGE ISOLATION FAILED';
    bar.textContent=note+' ';
    function btn(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();fn()});bar.appendChild(b)}
    btn('Floor −',function(){go((one.floor||0)-1)});
    btn('Floor +',function(){go((one.floor||0)+1)});
    btn('Cutaway',function(){one.toggleCut()});
    btn('Overlay',function(){one.toggleCol()});
    btn('X-ray',function(){one.toggleXray()});
    btn(orb.on?'Walk':'Orbit',function(){setOrbit(!orb.on);this.textContent=orb.on?'Walk':'Orbit'});
  }
  one.ready=true;
  fetch('index.html').then(function(r){return r.ok?r.arrayBuffer():null}).then(function(buf){
    if(!buf){one.fresh='not-checked';return}
    return crypto.subtle.digest('SHA-256',buf).then(function(dig){
      var hex=Array.from(new Uint8Array(dig)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
      one.fresh=hex===one.sourceSha256?'match':'STALE';
      if(one.fresh==='STALE'&&bar)bar.textContent='STALE — this viewer was not generated from the index.html beside it. '+bar.textContent;
    });
  }).catch(function(){one.fresh='not-checked'});
}catch(err){window.__DH_ONE.bootError=String(err&&err.stack||err);console.error('[walk-inspect]',err)}})()}
`;

src = once(src, '</script>\n<script id="story-config">', inspect + '</script>\n<script id="story-config">', 'inspect insert');

if (!src.includes('<!-- walk-inspect')) {
  src = '<!-- walk-inspect generated from index.html md5 ' + md5 + ' sha256 ' + sha + '. Regenerate with node tools/build-walk-viewer.mjs. Layout source is index.html. -->\n' + src;
}
src = once(src, '<title>Dead Harvest', '<title>Walk inspect · Dead Harvest', 'title');

writeFileSync(outPath, src);
console.log('wrote ' + outPath);
console.log('index md5 ' + md5);
console.log('bytes ' + Buffer.byteLength(src));
