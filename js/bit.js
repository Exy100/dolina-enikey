/* Бит на гусеницах. Общая фабрика для мира, портретов и экспорта.
   Ленты приводятся пройденным расстоянием, а не временем кадров. */
const HeroBit = (() => {
  const cache = new WeakMap();
  const HALF = .125, RADIUS = .075, LOOP = 4 * HALF + 2 * Math.PI * RADIUS;
  function trackPoint(distance) {
    let u = ((distance % LOOP) + LOOP) % LOOP;
    if (u < 2 * HALF) return { y: RADIUS, z: -HALF + u, angle: 0 };
    u -= 2 * HALF;
    if (u < Math.PI * RADIUS) { const a = u / RADIUS; return { y: RADIUS * Math.cos(a), z: HALF + RADIUS * Math.sin(a), angle: a }; }
    u -= Math.PI * RADIUS;
    if (u < 2 * HALF) return { y: -RADIUS, z: HALF - u, angle: Math.PI };
    const a = Math.PI + (u - 2 * HALF) / RADIUS;
    return { y: RADIUS * Math.cos(a), z: -HALF + RADIUS * Math.sin(a), angle: a };
  }
  function build(THREE) {
    const root = new THREE.Group(); root.name = 'bit';
    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .47, metalness: .08, ...extra });
    const violet = mat(0x7840b5), violetLight = mat(0xa361d4, { flatShading: true, roughness: .38 });
    const cream = mat(0xffe5b8), dark = mat(0x352839), steel = mat(0x9e9a91, { metalness: .2, roughness: .38 });
    const gold = mat(0xe8b23f, { metalness: .2 }), treadMat = mat(0x39363e, { roughness: .82, metalness: .06 });
    const white = mat(0xfff7e6, { roughness: .3 }), black = mat(0x30203c, { roughness: .25 });
    const add = (geo, m, x, y, z, parent = root, name = '') => {
      const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; o.castShadow = true; parent.add(o); return o;
    };
    const box = (w,h,d,m,x,y,z,parent,name) => add(new THREE.BoxGeometry(w,h,d),m,x,y,z,parent,name);
    const ball = (r,m,x,y,z,parent,name,segments=12) => add(new THREE.SphereGeometry(r,segments,10),m,x,y,z,parent,name);
    const rest = (o, visible=true) => { o.visible=visible; o.userData.rest={p:o.position.toArray(),s:o.scale.toArray(),r:o.rotation.toArray().slice(0,3),v:visible}; return o; };
    // Небольшая фаска оставляет широкие ПЛОСКИЕ переднюю и боковые грани.
    function bevelBox(w,h,d,b,m,x,y,z,parent=root,name='') {
      const s=new THREE.Shape(),a=w/2-b,c=h/2-b,r=Math.min(b,a,c);
      s.moveTo(-a+r,-c);s.lineTo(a-r,-c);s.quadraticCurveTo(a,-c,a,-c+r);s.lineTo(a,c-r);
      s.quadraticCurveTo(a,c,a-r,c);s.lineTo(-a+r,c);s.quadraticCurveTo(-a,c,-a,c-r);s.lineTo(-a,-c+r);s.quadraticCurveTo(-a,-c,-a+r,-c);
      const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:1,curveSegments:2,steps:1});
      g.translate(0,0,-d/2+b);return add(g,m,x,y,z,parent,name);
    }
    const body=bevelBox(.31,.30,.24,.012,violet,0,.325,0,root,'body');
    add(new THREE.CylinderGeometry(.105,.12,.055,12),dark,0,.163,0);
    bevelBox(.252,.254,.018,.005,cream,0,.325,.131,root,'bitPanel');
    [-1,1].forEach(s=>[-1,1].forEach(t=>{
      const screw=add(new THREE.CylinderGeometry(.013,.013,.006,8),steel,s*.104,.325+t*.103,.144);screw.rotation.x=Math.PI/2;
      box(.019,.003,.003,dark,s*.104,.325+t*.103,.149).rotation.z=.7;
    }));
    add(new THREE.CircleGeometry(.071,16,0,Math.PI),gold,0,.36,.143,root,'bitGaugeRim');
    add(new THREE.CircleGeometry(.062,16,0,Math.PI),new THREE.MeshBasicMaterial({color:0xffbd36}),0,.36,.145,root,'bitGauge');
    for(let i=0;i<5;i++){
      const a=.25+i*(Math.PI-.5)/4;
      box(.004,.011,.002,dark,Math.cos(a)*.052,.36+Math.sin(a)*.052,.148).rotation.z=a-Math.PI/2;
    }
    const needle=new THREE.Group();needle.name='bitNeedle';needle.position.set(0,.36,.151);root.add(needle);
    box(.005,.047,.003,dark,0,.021,0,needle);
    add(new THREE.CircleGeometry(.012,10),dark,0,.36,.154);
    [.319,.292,.265].forEach(y=>bevelBox(.095,.012,.005,.002,dark,0,y,.143));
    const head=ball(.21,violetLight,0,.62,0,root,'head',16);
    const eyes=[],pupils=[],joy=[],squint=[];
    [-.085,.085].forEach(x=>{
      add(new THREE.TorusGeometry(.059,.005,4,16),steel,x,.65,.2);
      eyes.push(rest(ball(.061,white,x,.65,.165,root,'eye')));
      const pupil=ball(.03,black,x,.65,.218,root,'pupil');pupil.scale.set(.88,1,.65);pupils.push(rest(pupil));
      ball(.008,white,-.008,.011,.03,pupil).scale.z=.35;
      joy.push(rest(add(new THREE.TorusGeometry(.038,.011,5,12,Math.PI),black,x,.646,.224),false));
      const q=new THREE.Group();q.position.set(x,.65,.226);root.add(q);
      [-1,1].forEach(s=>{box(.06,.012,.012,black,0,s*.014,0,q).rotation.z=s*Math.sign(x)*.5;});squint.push(rest(q,false));
    });
    const mouth=rest(add(new THREE.TorusGeometry(.04,.009,5,12,Math.PI),black,0,.54,.192,root,'mouth'),false);
    const antPivot=new THREE.Group();antPivot.position.y=.805;root.add(antPivot);
    const ant=new THREE.Group();ant.name='ant';antPivot.add(ant);
    add(new THREE.CylinderGeometry(.024,.03,.024,10),dark,0,.014,0,ant);
    add(new THREE.CylinderGeometry(.009,.013,.115,8),dark,0,.08,0,ant);
    const bulb=ball(.042,mat(0xffc83d,{emissive:0x6b4500,emissiveIntensity:.3,roughness:.3}),0,.16,0,antPivot,'bulb');
    [-1,1].forEach(s=>{
      const arm=new THREE.Group();arm.name=s<0?'bitArmLeft':'bitArmRight';arm.position.set(s*.175,.415,0);root.add(arm);
      const joint=add(new THREE.CylinderGeometry(.037,.037,.026,10),steel,0,0,0,arm);joint.rotation.z=Math.PI/2;
      ball(.033,violet,s*.016,0,0,arm);
      const stem=add(new THREE.CylinderGeometry(.023,.026,.082,8),violet,s*.026,-.051,0,arm);stem.rotation.z=s*.26;
      const cuff=add(new THREE.CylinderGeometry(.035,.035,.055,8),cream,s*.038,-.1,0,arm);cuff.rotation.z=s*.26;
      const claw=add(new THREE.TorusGeometry(.027,.009,4,10,Math.PI*1.5),violet,s*.047,-.153,0,arm);claw.rotation.z=-Math.PI/4;
    });
    // Один общий набор геометрии трака с ребром на модель; 20 звеньев на ленту.
    const slab=new THREE.BoxGeometry(.125,.018,.043).toNonIndexed();
    const rib=new THREE.BoxGeometry(.112,.006,.009).translate(0,.012,0).toNonIndexed();
    const treadGeo=new THREE.BufferGeometry();
    ['position','normal','uv'].forEach(key=>{
      const a=slab.attributes[key],b=rib.attributes[key],data=new Float32Array(a.array.length+b.array.length);
      data.set(a.array);data.set(b.array,a.array.length);treadGeo.setAttribute(key,new THREE.BufferAttribute(data,a.itemSize));
    });slab.dispose();rib.dispose();
    [-1,1].forEach(s=>{
      const track=new THREE.Group();track.name=s<0?'bitTrackLeft':'bitTrackRight';track.position.set(s*.172,.087,0);root.add(track);
      box(.09,.113,.30,dark,0,0,0,track);
      for(let i=0;i<20;i++){
        const link=add(treadGeo,treadMat,0,0,0,track,'bitTread');link.userData.offset=i*LOOP/20;
      }
      [[.113,.062,0],[-.013,.044,-.019],[-.112,.044,-.019]].forEach(([z,r,y])=>{
        const wheel=new THREE.Group();wheel.name='bitWheel';wheel.position.set(0,y,z);wheel.userData.radius=r;track.add(wheel);
        const disc=add(new THREE.CylinderGeometry(r,r,.104,10),steel,0,0,0,wheel);disc.rotation.z=Math.PI/2;
        const hub=add(new THREE.CylinderGeometry(r*.37,r*.37,.113,10),gold,0,0,0,wheel);hub.rotation.z=Math.PI/2;
        // Риска на ступице делает вращение видимым и на небольшой модели.
        box(.004,r*.3,.006,dark,s*.059,r*.13,0,wheel);
      });
      const guard=bevelBox(.145,.025,.365,.007,cream,s*.172,.189,0,root,'bitFender');
      guard.rotation.x=-.04;
    });
    const shape=new THREE.Shape();shape.moveTo(-.16,0);shape.lineTo(.16,0);shape.lineTo(0,.2);shape.closePath();
    const arrow=add(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:0xffc83d,transparent:true,opacity:.9}),0,.012,.3,root,'arrow');arrow.rotation.x=-Math.PI/2;
    [head,antPivot,bulb].forEach(o=>rest(o));
    advance(root,0,0);update(root,0,{reduceMotion:true});
    return {root,parts:{skin:'bit',body,head,violet,violetLight,eyes,pupils,joy,squint,mouth,feet:[],antPivot,ant,bulb,ears:[],tail:null,fx:null}};
  }
  function nodes(root){
    let p=cache.get(root);if(p)return p;
    const find=n=>root.getObjectByName(n);if(!find('bitTrackLeft'))return null;
    p={tracks:['bitTrackLeft','bitTrackRight'].map(n=>{const group=find(n);return {links:group.children.filter(o=>o.name==='bitTread'),wheels:group.children.filter(o=>o.name==='bitWheel'),distance:0};}),arms:[find('bitArmLeft'),find('bitArmRight')],needle:find('bitNeedle')};
    cache.set(root,p);return p;
  }
  function advance(root,left,right){
    const p=nodes(root);if(!p)return;
    p.tracks.forEach((t,i)=>{
      t.distance=(t.distance+[left,right][i])%LOOP;
      t.links.forEach(link=>{const at=trackPoint(t.distance+link.userData.offset);link.position.set(0,at.y,at.z);link.rotation.x=at.angle;});
      t.wheels.forEach(w=>{w.rotation.x+= [left,right][i]/w.userData.radius;w.rotation.x%=Math.PI*2;});
    });
  }
  function update(root,time,{mood='',event='',age=Infinity,reduceMotion=false}={}){
    const p=nodes(root);if(!p)return;
    const pulse=!reduceMotion&&age>=0&&age<.65?Math.sin(age/.65*Math.PI):0;
    const happy=mood==='happy',sad=mood==='sad';
    p.needle.rotation.z=sad?1.1:happy?-.85:event==='check'?.65-pulse*.9:.65;
    p.arms.forEach((a,i)=>{const s=i===0?-1:1;a.rotation.z=s*(happy&&!reduceMotion?.55:.12);a.rotation.x=reduceMotion?0:(['take','open','pull','check'].includes(event)?-pulse*.35:Math.sin(time*1.6+i)*.025);});
  }
  function reset(root){cache.delete(root);}
  return {build,update,advance,reset,trackPoint,soundFor:()=>undefined};
})();
if(typeof module!=='undefined')module.exports=HeroBit;
