/* Финист: один игровой герой, две декоративные формы. Геометрию и события
   курса не меняет. Все узлы анимации принадлежат своей модели/копии. */
const HeroFinist = (() => {
  const cache = new WeakMap();
  const soundFor = event => ({ select: 'finistHello', jump: 'finistFlight', check: 'finistCompass', win: 'finistWin', fail: 'finistFail' })[event];
  function build(THREE) {
    const root = new THREE.Group(); root.name = 'finist';
    const human = new THREE.Group(); human.name = 'finistHuman'; root.add(human);
    const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.75, flatShading: true });
    const blue = mat(0x285c83), skin = mat(0xffc49a), hair = mat(0x70432a), dark = mat(0x302b2b);
    const gold = mat(0xe4b346), silver = mat(0xb4becb), featherBlue = mat(0x527ba9), white = mat(0xfff4dd), red = mat(0xdc4938);
    const gem = new THREE.MeshStandardMaterial({ color: 0x35d5d2, emissive: 0x178f92, emissiveIntensity: 0.3, flatShading: true });
    const add = (geo, m, x, y, z, parent = human, name = '') => {
      const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.name = name; o.castShadow = true; parent.add(o); return o;
    };
    const box = (w, h, d, m, x, y, z, parent, name) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, name);
    const ball = (r, m, x, y, z, parent, name) => add(new THREE.SphereGeometry(r, 10, 6), m, x, y, z, parent, name);
    const rest = (o, visible = true) => {
      o.visible = visible; o.userData.rest = { p: o.position.toArray(), s: o.scale.toArray(), r: o.rotation.toArray().slice(0, 3), v: visible }; return o;
    };
    // Объёмное перо из шести вершин: широкое основание, острый конец, один гребень.
    function feather(w, h, m, parent, x = 0, y = 0, z = 0) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([-w/2,0,0, w/2,0,0, w*.43,-h*.56,0, 0,-h,0, -w*.43,-h*.56,0, 0,-h*.38,.026], 3));
      g.setIndex([0,5,1,1,5,2,2,5,3,3,5,4,4,5,0,0,3,4,0,2,3,0,1,2]); g.computeVertexNormals();
      return add(g, m, x, y, z, parent);
    }
    const body = add(new THREE.CylinderGeometry(.12,.18,.27,10), blue, 0,.34,0,human,'body');
    add(new THREE.CylinderGeometry(.176,.183,.025,10), gold,0,.212,0);
    add(new THREE.CylinderGeometry(.157,.164,.035,10),hair,0,.345,0);
    box(.047,.039,.018,gold,0,.345,.151);
    [-1,1].forEach(s => {
      box(.047,.066,.05,blue,s*.042,.478,.087).rotation.z=s*.22;
    });
    const brooch=add(new THREE.OctahedronGeometry(.041),gold,0,.45,.137); brooch.scale.z=.32;
    add(new THREE.OctahedronGeometry(.029),gem,0,.45,.152).scale.z=.25;
    const head=add(new THREE.SphereGeometry(.21,12,8).scale(1,.9,.95).translate(0,.028,0),skin,0,.62,0,human,'head');
    // Боковой пробор: линия волос остаётся выше глаз, затылок закрыт.
    const vertices=[],indices=[],segments=12,rows=4;
    for(let row=0;row<=rows;row++)for(let i=0;i<=segments;i++){
      const phi=-Math.PI+i/segments*Math.PI*2;
      const front=(1+Math.cos(phi))/2;
      const edge=1.95-front*.94+Math.sin(phi)*.18;
      const theta=row/rows*edge;
      vertices.push(.224*Math.sin(theta)*Math.sin(phi),.224*Math.cos(theta)+.016,.218*Math.sin(theta)*Math.cos(phi)-.012);
      if(row<rows&&i<segments){const k=row*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
    }
    const hairGeo=new THREE.BufferGeometry();hairGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));hairGeo.setIndex(indices);hairGeo.computeVertexNormals();
    add(hairGeo,hair,0,0,0,head,'hair');
    [-1,1].forEach(s=> {
      ball(.035,skin,s*.202,-.005,0,head).scale.set(.6,1,.75);
      const lock=add(new THREE.DodecahedronGeometry(.07),hair,s*.18,.025,.015,head); lock.scale.set(.65,1.6,.45);lock.rotation.z=-.4;
    });
    const fringe=add(new THREE.DodecahedronGeometry(.115),hair,-.035,.139,.137,head);fringe.scale.set(1.28,.48,.45);fringe.rotation.z=.35;
    const tuft=add(new THREE.ConeGeometry(.045,.1,3),hair,.06,.218,-.025,head);tuft.rotation.z=.45;
    const hairFeathers=new THREE.Group();hairFeathers.position.set(-.19,.095,.035);head.add(hairFeathers);
    for(let i=0;i<2;i++){const f=feather(.06,.105,silver,hairFeathers,i*.022,0,0);f.rotation.z=-2.4-i*.2;}
    const eyes=[],pupils=[],joy=[],squint=[];
    [-.08,.08].forEach(x=>{
      eyes.push(rest(ball(.057,white,x,.658,.175,human,'eye')));
      const pupil=ball(.027,dark,x,.658,.228,human,'pupil');pupil.scale.set(.83,1,.48);pupils.push(rest(pupil));
      joy.push(rest(add(new THREE.TorusGeometry(.034,.009,4,10,Math.PI),dark,x,.655,.228),false));
      const q=new THREE.Group();q.position.set(x,.658,.229);human.add(q);
      [-1,1].forEach(s=>{box(.05,.011,.012,dark,0,s*.012,0,q).rotation.z=s*Math.sign(x)*.5;});squint.push(rest(q,false));
    });
    const mouth=add(new THREE.TorusGeometry(.032,.006,4,12,Math.PI),dark,0,.565,.197,human,'mouth');mouth.rotation.z=Math.PI;rest(mouth);
    const arms=[];
    [-1,1].forEach(s=>{
      const arm=new THREE.Group();arm.name=s<0?'finistCompassArm':'finistArm';arm.position.set(s*.145,.44,0);human.add(arm);arms.push(arm);
      add(new THREE.CylinderGeometry(.047,.045,.14,6),blue,s*.025,-.056,.015,arm).rotation.z=s*.18;
      add(new THREE.CylinderGeometry(.047,.047,.025,6),gold,s*.04,-.125,.015,arm);
      add(new THREE.DodecahedronGeometry(.044),skin,s*.04,-.168,.02,arm);
    });
    const compass=new THREE.Group();compass.name='finistCompass';compass.position.set(-.04,-.117,.06);arms[0].add(compass);
    box(.105,.095,.035,hair,0,0,0,compass);
    const rim=add(new THREE.CylinderGeometry(.045,.045,.015,12),gold,0,0,.023,compass);rim.rotation.x=Math.PI/2;
    const dial=add(new THREE.CircleGeometry(.035,12),white,0,0,.032,compass);dial.name='compassDial';
    for(let i=0;i<4;i++){const a=i*Math.PI/2;box(.004,.008,.003,dark,Math.sin(a)*.029,Math.cos(a)*.029,.035,compass).rotation.z=-a;}
    const needle=new THREE.Group();needle.name='finistNeedle';needle.position.z=.037;compass.add(needle);
    [-1,1].forEach(s=>{const shape=new THREE.Shape();shape.moveTo(-.009,0);shape.lineTo(0,s*.028);shape.lineTo(.009,0);shape.closePath();add(new THREE.ShapeGeometry(shape),s>0?red:blue,0,0,0,needle,s>0?'compassNorth':'compassSouth');});
    ball(.006,dark,0,0,.003,needle).scale.z=.4;
    const wings=[];
    [-1,1].forEach(s=>{
      const wing=new THREE.Group();wing.name=s<0?'finistWingLeft':'finistWingRight';wing.position.set(s*.145,.49,-.025);human.add(wing);wings.push(wing);
      for(let i=2;i>=0;i--){const f=feather(.105,.17+i*.014,i===0?silver:featherBlue,wing,s*(.02+i*.026),-i*.068,-i*.018);f.rotation.z=s*(.47-i*.06);}
    });
    const feet=[-.075,.075].map(x=>{
      const foot=new THREE.Group();foot.name='foot';foot.position.set(x,.047,.018);human.add(foot);
      box(.062,.12,.067,dark,0,.081,-.018,foot);
      box(.095,.094,.1,hair,0,.008,0,foot);
      box(.105,.035,.105,hair,0,.063,-.012,foot);
      return rest(foot);
    });
    // Форма сокола видна только в воздухе при команде прыжка.
    const falcon=new THREE.Group();falcon.name='finistFalcon';falcon.position.y=.35;root.add(falcon);falcon.visible=false;
    const chest=add(new THREE.DodecahedronGeometry(.145),silver,0,0,0,falcon);chest.scale.set(.72,1,.9);
    add(new THREE.OctahedronGeometry(.045),gem,0,.015,.12,falcon).scale.z=.35;
    const birdHead=ball(.105,silver,0,.18,.055,falcon);birdHead.name='falconHead';
    const beak=add(new THREE.ConeGeometry(.044,.1,4),gold,0,.145,.173,falcon);beak.rotation.x=Math.PI/2;
    [-1,1].forEach(s=>{ball(.036,white,s*.047,.198,.136,falcon);ball(.018,dark,s*.047,.198,.168,falcon);box(.021,.035,.06,gold,s*.052,-.144,.027,falcon);});
    feather(.085,.14,featherBlue,falcon,0,-.015,-.1).rotation.x=.9;
    [-1,1].forEach(s=>{
      const wing=new THREE.Group();wing.name=s<0?'falconWingLeft':'falconWingRight';wing.position.set(s*.09,.06,-.025);falcon.add(wing);
      for(let i=2;i>=0;i--){const f=feather(.075,.21-i*.025,i===0?silver:featherBlue,wing,s*i*.028,-i*.018,-i*.03);f.rotation.z=s*1.15;}
    });
    const antPivot=new THREE.Group(),ant=new THREE.Object3D(),bulb=new THREE.Object3D();antPivot.add(ant,bulb);human.add(antPivot);ant.visible=bulb.visible=false;
    const arrowShape=new THREE.Shape();arrowShape.moveTo(-.16,0);arrowShape.lineTo(.16,0);arrowShape.lineTo(0,.2);arrowShape.closePath();
    const arrow=add(new THREE.ShapeGeometry(arrowShape),new THREE.MeshBasicMaterial({color:0xffc83d,transparent:true,opacity:.9}),0,.012,.3,root,'arrow');arrow.rotation.x=-Math.PI/2;
    [head,antPivot,bulb].forEach(o=>rest(o,o.visible));
    update(root,0,{reduceMotion:true});
    return {root,parts:{skin:'finist',body,head,violet:blue,violetLight:skin,eyes,pupils,joy,squint,mouth,feet,antPivot,ant,bulb,ears:[hairFeathers,tuft],tail:null,fx:null}};
  }
  function update(root,time,{moving=false,mood='',event='',age=Infinity,reduceMotion=false,flying=false,heading=0}={}) {
    let p=cache.get(root);
    if(!p){const find=n=>root.getObjectByName(n);if(!find('finistHuman'))return;
      p={human:find('finistHuman'),falcon:find('finistFalcon'),left:find('finistWingLeft'),right:find('finistWingRight'),birdLeft:find('falconWingLeft'),birdRight:find('falconWingRight'),arm:find('finistCompassArm'),needle:find('finistNeedle'),mouth:find('mouth')};cache.set(root,p);}
    const flight=flying&&!reduceMotion, happy=mood==='happy', sad=mood==='sad';
    p.human.visible=!flight;p.falcon.visible=flight;
    root.children.forEach(o=>{if(o.userData.gear&&o.userData.gear!=='pet')o.visible=!flight;});
    const pulse=!reduceMotion&&event==='check'&&age>=0&&age<.6?Math.sin(age/.6*Math.PI):0;
    const sway=reduceMotion?0:happy?.2+Math.sin(time*6)*.08:moving?Math.sin(time*8)*.06:Math.sin(time*2)*.025;
    p.left.rotation.z=-sway;p.right.rotation.z=sway;
    p.birdLeft.rotation.z=flight?Math.sin(time*15)*.22:0;p.birdRight.rotation.z=-p.birdLeft.rotation.z;
    p.arm.rotation.x=-pulse*.5;p.needle.rotation.z=-Math.PI/4-heading+pulse*.6;
    p.mouth.visible=true;p.mouth.position.set(0,sad?.54:.565,.197);p.mouth.rotation.set(0,0,sad?0:Math.PI);
  }
  function reset(root){cache.delete(root);}
  return {build,update,reset,soundFor};
})();
if(typeof module!=='undefined')module.exports=HeroFinist;
