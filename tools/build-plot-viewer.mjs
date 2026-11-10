/**
 * Build plot-viewer.html from index.html.
 * The game file is not modified. Geometry stays the game's makeModel2 output.
 * Run: node tools/build-plot-viewer.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = join(root, 'index.html');
const outPath = join(root, 'plot-viewer.html');
let src = readFileSync(srcPath, 'utf8');
const md5 = createHash('md5').update(src).digest('hex');
const sha = createHash('sha256').update(src).digest('hex');

function once(hay, needle, repl, label) {
  const n = hay.split(needle).length - 1;
  if (n !== 1) throw new Error(label + ': expected 1 match, found ' + n);
  return hay.replace(needle, repl);
}

/* Call order of makeModel2, after the function definition. Plot numbers follow PLOT_OF. */
const BUILD_OF = {
  1: 1, 2: 2, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 3, 9: 10, 10: 4,
  11: 11, 12: 12, 14: 15, 15: 16, 16: 13, 22: 14,
};
const calls = src.split('makeModel2(').length - 1;
if (calls !== 17) throw new Error('makeModel2 count ' + calls + ' (definition + 16 buildings)');

src = once(
  src,
  'function makeModel2(s){const LPS=[],IDRS=[];',
  'function makeModel2(s){const __id=(window.__DH_N=(window.__DH_N|0)+1),__one=window.__DH_ONE;if(__one&&(__one.comp||__one.buildId!==__id)){const hw=(s.w||8)/2,hd=(s.d||8)/2,lv=s.lv||1,cols=Object.assign([],{H:(s.fl||lv)*4});return{grp:new T.Group(),cols,ramps:[],hw,hd,lv,lamps:[],idoors:[],door:null,mast:null,__dhStub:1};}const LPS=[],IDRS=[];',
  'makeModel2',
);

src = once(
  src,
  " for(const p of PLOTS){if(p.occ){const m=p.occ,S=slots(p,m.hd);place(m,S.x,S.z,p.rot);plotSign(p,m.name.split(' (')[0].toUpperCase())}else{p.filler=true;filler(p);plotSign(p,'FILLER HOUSE')}}",
  " for(const p of PLOTS){const __one=window.__DH_ONE;if(__one){if(__one.comp||p.n!==__one.plot)continue;if(p.occ&&p.occ.__dhStub)continue;if(p.occ){const m=p.occ,S=slots(p,m.hd);place(m,S.x,S.z,p.rot);plotSign(p,m.name.split(' (')[0].toUpperCase())}else{p.filler=true;filler(p);plotSign(p,'FILLER HOUSE')}}else if(p.occ){const m=p.occ,S=slots(p,m.hd);place(m,S.x,S.z,p.rot);plotSign(p,m.name.split(' (')[0].toUpperCase())}else{p.filler=true;filler(p);plotSign(p,'FILLER HOUSE')}}",
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
src = src.slice(0, tryAt + 4) + "if(window.__DH_ONE&&window.__DH_ONE.comp!=='h9')return;" + src.slice(tryAt + 4);

src = once(
  src,
  "if(typeof scene==='undefined'||typeof T==='undefined'){console.error('[apoc] scope missing');return}",
  "if(window.__DH_ONE)return;if(typeof scene==='undefined'||typeof T==='undefined'){console.error('[apoc] scope missing');return}",
  'apoc',
);

src = once(
  src,
  'const C=window.STORY_CONFIG;if(!C||!C.enabled)return;',
  'if(window.__DH_ONE&&window.STORY_CONFIG)window.STORY_CONFIG.enabled=false;const C=window.STORY_CONFIG;if(!C||!C.enabled)return;',
  'story',
);

const boot = `<script id="dh-one-boot">
(function(){
  var q=new URLSearchParams(location.search);
  var comp=q.get('comp')||'';
  var comps={farm:1,sawmill:1,quarry:1,cemetery:1,h9:1};
  if(comp&&!comps[comp])comp='';
  var plot=parseInt(q.get('plot')||'1',10);
  if(!(plot>=1&&plot<=24))plot=1;
  var buildOf=${JSON.stringify(BUILD_OF)};
  var buildId=comp?0:(buildOf[plot]||0);
  window.__DH_ONE={kind:comp?'comp':'plot',plot:plot,comp:comp,buildId:buildId,sourceMd5:'${md5}',sourceSha256:'${sha}',builtFrom:'index.html'};
  var mem={dhGfx2:'3'};
  function memStore(){
    return {getItem:function(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null},setItem:function(k,v){mem[k]=String(v)},removeItem:function(k){delete mem[k]},clear:function(){Object.keys(mem).forEach(function(k){delete mem[k]})},key:function(i){return Object.keys(mem)[i]||null},get length(){return Object.keys(mem).length}};
  }
  var memLS=memStore(), memSS=memStore();
  try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return memLS}})}catch(e){window.__DH_ONE.storageError=String(e)}
  try{Object.defineProperty(window,'sessionStorage',{configurable:true,get:function(){return memSS}})}catch(e){}
  window.__DH_ONE.storageIsolated=(function(){try{return window.localStorage===memLS}catch(e){return false}})();
  var Orig=THREE.WebGLRenderer;
  THREE.WebGLRenderer=function(params){
    var p={}; if(params)for(var k in params)p[k]=params[k];
    p.antialias=false;
    var r=new Orig(p);
    try{Object.defineProperty(r.shadowMap,'enabled',{configurable:true,get:function(){return false},set:function(){}})}catch(e){r.shadowMap.enabled=false}
    r.toneMapping=0;
    var setPR=r.setPixelRatio.bind(r);
    r.setPixelRatio=function(){setPR(0.5)};
    setPR(0.5);
    return r;
  };
  document.documentElement.classList.add('dh-inspect');
})();
</script>
<style id="dh-inspect-css">
body.dh-inspect #xh,body.dh-inspect #pcx,body.dh-inspect #sPop,body.dh-inspect #sHud,body.dh-inspect #sObj,body.dh-inspect #sSide,body.dh-inspect #sFlash,body.dh-inspect #msg,body.dh-inspect #help,body.dh-inspect #pch,body.dh-inspect #pcc,body.dh-inspect #pck,body.dh-inspect #pcHint,body.dh-inspect #pcClick,body.dh-inspect #hit,body.dh-inspect #gb{display:none!important}
#dhOneBanner{position:fixed;left:8px;bottom:8px;z-index:80;max-width:min(640px,94vw);background:rgba(12,18,16,.88);color:#f4efe2;font:13px/1.35 system-ui,sans-serif;padding:8px 10px;border-radius:8px}
#dhOneBanner select,#dhOneBanner button{margin:4px 4px 0 0;padding:3px 8px;border-radius:6px;border:1px solid #6a6a50;background:#26261c;color:#f0e8c8;font:600 12px system-ui;cursor:pointer}
</style>
`;

src = once(src, '<script>\nconst T=THREE;\n', boot + '<script>\nconst T=THREE;\n', 'boot');

const inspect = `
if(window.__DH_ONE){(function(){try{
  var one=window.__DH_ONE;
  document.body.classList.add('dh-inspect');
  try{scene.fog=null;scene.background=new T.Color(0xc5d0d4);if(typeof hemi!=='undefined'){hemi.intensity=1.15;hemi.color.setHex(0xffffff);hemi.groundColor.setHex(0x8d887c)}if(typeof sun!=='undefined'){sun.intensity=.9;sun.castShadow=false}ren.shadowMap.enabled=false;ren.toneMapping=0}catch(e){}
  vm.visible=false;
  var placed=insts.filter(function(q){return q.m&&!q.m.__dhStub});
  var I=placed.filter(function(q){return q.m&&q.m.door})[0]||placed[0]||null;
  one.placed=placed.map(function(q){return q.m&&q.m.name});
  one.building=I&&I.m?I.m.name:(one.comp||(one.buildId?null:'filler plot '+one.plot));
  one.doors=I?bdoors.filter(function(d){return d.I===I}).length:0;
  one.floor=0;one.cut=false;one.tx=0;one.tz=0;
  var orb={on:false,az:.9,el:.55,dist:Math.max(14,I&&I.m?Math.max(I.m.hw,I.m.hd)*1.6:18)};
  var cutPlane=new T.Plane(new T.Vector3(0,-1,0),80);
  function yCut(){return ((one.floor||0)+1)*FH-.2}
  function go(floor){
    if(!I||!I.m.door)return;
    var D=I.m.door,cx=(D.a+D.b)/2,lv=I.m.lv||1,f=Math.max(0,Math.min(lv-1,floor|0));
    one.floor=f;if(orb.on)return;
    var inside=f>0,lz=inside?(D.pi-1.6):(D.po+4.5);
    pl.set(I.x+cx*I.s,inside?f*FH:0,I.z+lz*I.s);
    yaw=I.s>0?0:Math.PI;pit=inside?-.02:-.08;
  }
  one.go=go;
  function standPlot(){
    var p=(window.PLOTS||[])[one.plot-1];if(!p)return;
    var south=p.rot!==0,x=p.bc+p.jx,front=south?p.st+10+p.sb:p.st-14-p.sb;
    if(south){pl.set(x,0,front-5);yaw=Math.PI}else{pl.set(x,0,front+5);yaw=0}pit=-.05;
  }
  var COMP={farm:{x:-23.7,z:-1.4,yaw:0},sawmill:{x:50,z:-505,yaw:0},quarry:{x:-55,z:-505,yaw:Math.PI},cemetery:{x:-100,z:-260,yaw:0},h9:{x:-335,z:-780,yaw:0}};
  if(one.comp&&COMP[one.comp]){var c=COMP[one.comp];pl.set(c.x,0,c.z);yaw=c.yaw;pit=-.08}
  else if(I)go(0);else standPlot();
  function applyCut(){if(!one.cut){if(ren.clippingPlanes&&ren.clippingPlanes.length)ren.clippingPlanes=[];return}cutPlane.constant=yCut();if(!ren.clippingPlanes||ren.clippingPlanes[0]!==cutPlane)ren.clippingPlanes=[cutPlane]}
  function orbApply(){
    if(!orb.on)return;
    var base=(one.floor||0)*FH,tx,tz,el=orb.el,dist=Math.max(one.cut?6:4,orb.dist);
    if(I){tx=I.x+(one.tx||0)*I.s;tz=I.z+(one.tz||0)*I.s}else{tx=pl.x;tz=pl.z}
    if(one.cut){el=Math.max(.35,Math.min(1.15,el));var horiz=Math.max(.35,Math.cos(Math.min(el,1)));
      cam.position.set(tx+Math.sin(orb.az)*dist*horiz,Math.max(yCut()+.8,base+1.2+dist*Math.sin(el)),tz+Math.cos(orb.az)*dist*horiz);cam.lookAt(tx,base+1.15,tz)}
    else{var cy=Math.cos(el),sy=Math.sin(el);cam.position.set(tx+Math.sin(orb.az)*dist*cy,base+2+dist*sy,tz+Math.cos(orb.az)*dist*cy);cam.lookAt(tx,base+2,tz)}
    vm.visible=false;
  }
  var _ren=ren.render.bind(ren);
  ren.render=function(s,c){if(s)s.fog=null;applyCut();if(orb.on&&s===scene)orbApply();vm.visible=false;return _ren(s,c)};
  function setOrbit(on){orb.on=!!on;one.orbit=orb.on;vm.visible=false;if(orb.on){try{if(document.pointerLockElement)document.exitPointerLock()}catch(e){}}else cam.rotation.order='YXZ'}
  one.setOrbit=setOrbit;
  one.toggleCut=function(){one.cut=!one.cut;if(one.cut)setOrbit(true);applyCut()};
  one.view=function(){var n=0;if(I&&I.g)I.g.traverse(function(o){if(o.isMesh)n++});return{weapon:!!vm.visible,foot:foot,orbit:!!orb.on,cut:!!one.cut,floor:one.floor,building:one.building,plot:one.plot,comp:one.comp||'',doors:one.doors,meshes:n,storage:!!one.storageIsolated,fog:!!(scene&&scene.fog),shadows:!!(ren.shadowMap&&ren.shadowMap.enabled)}};
  var drag=null;
  addEventListener('pointerdown',function(e){if(!orb.on)return;if(e.target&&e.target.closest&&e.target.closest('button,select,input,textarea,#dhOneBanner'))return;drag={x:e.clientX,y:e.clientY,b:e.button}},true);
  addEventListener('pointermove',function(e){if(!drag||!orb.on)return;var dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
    if(e.shiftKey&&I){var k=.04;one.tx=Math.max(-I.m.hw+1,Math.min(I.m.hw-1,(one.tx||0)-dx*k));one.tz=Math.max(-I.m.hd+1,Math.min(I.m.hd-1,(one.tz||0)+dy*k))}
    else if(drag.b===2)orb.dist=Math.max(4,Math.min(180,orb.dist+dy*.05));
    else{orb.az-=dx*.007;orb.el=Math.max(one.cut?.2:-.15,Math.min(1.35,orb.el+dy*.005))}},true);
  addEventListener('pointerup',function(){drag=null},true);
  addEventListener('wheel',function(e){if(!orb.on)return;orb.dist=Math.max(4,Math.min(180,orb.dist*(e.deltaY>0?1.12:1/1.12)))},{passive:true});
  addEventListener('keydown',function(e){
    if(e.repeat)return;if(e.target&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName||''))return;
    if(e.code==='Equal'){setOrbit(!orb.on);e.preventDefault();return}
    if(e.code==='KeyC'&&!e.metaKey&&!e.ctrlKey){one.toggleCut();e.preventDefault();return}
    var lv=I&&I.m&&I.m.lv||1,f=one.floor||0;
    if(e.code==='BracketRight'){go(Math.min(lv-1,f+1));e.preventDefault()}
    else if(e.code==='BracketLeft'){go(Math.max(0,f-1));e.preventDefault()}
    else if(e.code==='Slash'&&I){go(0);e.preventDefault()}
  },true);
  var bar=document.createElement('div');bar.id='dhOneBanner';
  var label=one.comp?('Compound '+one.comp):(one.building||('Plot '+one.plot));
  bar.appendChild(document.createTextNode('PLOT VIEWER · low graphics · '+label+' · Walk or Orbit · [ ] floor · C cutaway · saves off '));
  var sel=document.createElement('select');
  for(var n=1;n<=24;n++){var o=document.createElement('option');o.value='plot='+n;o.textContent='Plot '+n;if(!one.comp&&one.plot===n)o.selected=true;sel.appendChild(o)}
  ['farm','sawmill','quarry','cemetery','h9'].forEach(function(name){var o=document.createElement('option');o.value='comp='+name;o.textContent=name;if(one.comp===name)o.selected=true;sel.appendChild(o)});
  sel.addEventListener('change',function(){location.search='?'+sel.value+'&gfx=3'});
  bar.appendChild(sel);
  function btn(t,fn){var b=document.createElement('button');b.type='button';b.textContent=t;b.addEventListener('pointerdown',function(ev){ev.preventDefault();ev.stopPropagation();fn()});bar.appendChild(b)}
  btn('Floor −',function(){go((one.floor||0)-1)});
  btn('Floor +',function(){go((one.floor||0)+1)});
  btn('Cutaway',function(){one.toggleCut()});
  btn(orb.on?'Walk':'Orbit',function(){setOrbit(!orb.on);this.textContent=orb.on?'Walk':'Orbit'});
  document.body.appendChild(bar);
  one.ready=true;
}catch(err){window.__DH_ONE.bootError=String(err&&err.stack||err);console.error('[plot-viewer]',err)}})()}
`;

src = once(src, '</script>\n<script id="story-config">', inspect + '</script>\n<script id="story-config">', 'inspect');
src = once(src, '<title>Dead Harvest', '<title>Plot viewer · low graphics · Dead Harvest', 'title');
if (!src.startsWith('<!-- plot-viewer')) {
  src = '<!-- plot-viewer generated from index.html md5 ' + md5 + ' sha256 ' + sha + '. Rebuild: node tools/build-plot-viewer.mjs. Layout source is index.html. -->\n' + src;
}
writeFileSync(outPath, src);
console.log('wrote', outPath);
console.log('index md5', md5);
console.log('index sha256', sha);
