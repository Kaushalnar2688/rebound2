import * as THREE from "three";

const $ = (id) => document.getElementById(id);
const canvas = $("game-canvas");
const ui = {
  title: $("title-screen"), intro: $("intro-cutscene"), hud: $("hud"),
  pause: $("pause-screen"), ending: $("ending-screen"), loading: $("loading-screen"),
  transition: $("transition-wash"), objective: $("objective-text"), timerPanel: $("timer-panel"),
  timer: $("past-timer"), timeline: $("timeline-name"), chip: $("timeline-chip"),
  prompt: $("interaction-prompt"), promptText: $("interaction-text"), toast: $("toast"),
  caption: $("memory-caption"), subtitle: $("subtitle-bar"), danger: $("danger-edge"),
  flashlight: $("flashlight-status"), flashlightLabel: $("flashlight-label")
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0e);
scene.fog = new THREE.FogExp2(0x090b0e, 0.027);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.08, 120);
camera.rotation.order = "YXZ";
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0,0);
const world = new THREE.Group(); scene.add(world);
const present = new THREE.Group(), past = new THREE.Group();
world.add(present, past);

const state = {
  started:false, paused:false, locked:false, timeline:"present", transitioning:false,
  switches:0, instability:1, pastTime:60, pastDuration:60, elapsed:0,
  flashlight:false, hasFlashlight:false, hasCard:false, hasKey:false, hasTape:false,
  cutsceneTimers:[], cutsceneComplete:null, cutsceneDone:{intro:false,past:false,final:false},
  hasPhoto:false, hasObservedRecording:false, hasMemory1:false, hasMemory2:false, hasMemory3:false,
  birthdayCode:"", codeSolved:false, staffUnlocked:false, finalSequence:0,
  ending:"", chapter:1, objective:"Find the flashlight at reception.",
  interactable:null, toastTimer:0, subtitleTimer:0, cutscene:false,
  enemyMode:"watching", enemyLastMove:0, enemyVisible:false, chase:false,
  death:false, gameOver:false, introDone:false, hiddenMemory:false,
  copyPosition:new THREE.Vector3(0,0,-15), lastSafe:new THREE.Vector3(0,1.7,7),
  keys:{}, mouseYaw:0, mousePitch:0, verticalVelocity:0, grounded:true,
  bob:0, jumpLock:0, forcedWarned:false, randomEventAt:0
};

const mats = {};
function mat(name,color,roughness=.8,metalness=0,emissive=0x000000,emissiveIntensity=0){
  mats[name]=new THREE.MeshStandardMaterial({color,roughness,metalness,emissive,emissiveIntensity});
  return mats[name];
}
mat("concrete",0x343638,.96); mat("ceiling",0x24272a,.95); mat("rubber",0x17191b,.95);
mat("metal",0x4b5052,.48,.65); mat("rust",0x624333,.88,.1); mat("yellow",0xd4a73d,.65);
mat("blue",0x286d9d,.58); mat("pink",0xc45e83,.65); mat("purple",0x66518f,.65);
mat("green",0x4d846d,.7); mat("white",0xd7d4c9,.65); mat("black",0x090b0d,.4);
mat("wood",0x654b36,.82); mat("glass",0x34535b,.2,.1); mat("foam",0x415d78,.9);
mat("skin",0xc18b6d,.8); mat("shirt",0x4a6681,.9); mat("hood",0x171a20,.95);
mat("gold",0xb68c50,.32,.75); mat("lightPast",0xffdca0,.3,0,0xffc46c,.25);
mat("lightPresent",0x71818c,.35,0,0x6888a0,.08);

const ambient = new THREE.HemisphereLight(0x9bb8d0,0x17131d,0.48); scene.add(ambient);
const keyFill = new THREE.DirectionalLight(0xb5c8d8,0.42); keyFill.position.set(-12,18,8); keyFill.castShadow=true; keyFill.shadow.mapSize.set(1024,1024); scene.add(keyFill);
const presentGroup = new THREE.Group(), pastGroup = new THREE.Group();
present.add(presentGroup); past.add(pastGroup);
const flashlight = new THREE.SpotLight(0xfff0cf,0,34,Math.PI/6,.55,1.1);
flashlight.position.set(0,0,0); flashlight.castShadow=true; flashlight.shadow.mapSize.set(1024,1024);
flashlight.target.position.set(0,0,-1);
camera.add(flashlight); camera.add(flashlight.target); scene.add(camera);
const fillLight = new THREE.PointLight(0xffd59a,0,7,2); camera.add(fillLight); fillLight.position.set(0,-.15,-.1);

function box(parent,x,y,z,w,h,d,material,opts={}){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.castShadow=opts.cast!==false; mesh.receiveShadow=true;
  if(opts.rot) mesh.rotation.set(...opts.rot);
  parent.add(mesh); return mesh;
}
function cyl(parent,x,y,z,r1,r2,h,material,segments=16){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
  mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function sphere(parent,x,y,z,r,material,scale=null){
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,18,14),material);
  mesh.position.set(x,y,z); if(scale) mesh.scale.set(...scale); mesh.castShadow=true; parent.add(mesh); return mesh;
}
function addTextPanel(parent,x,y,z,w,h,label,sub="",color=0xd7c6a5){
  const panel=new THREE.Group(); panel.position.set(x,y,z); parent.add(panel);
  box(panel,0,0,0,w,h,.08,mat("sign"+Math.random(),0x171a1c,.7));
  box(panel,0,h*.25,.05,w*.78,.025,.02,new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22}));
  const canvas=document.createElement("canvas"); canvas.width=512; canvas.height=256;
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#171a1c";ctx.fillRect(0,0,512,256);
  ctx.fillStyle="#d7c6a5";ctx.font="bold 42px Arial";ctx.fillText(label.toUpperCase(),28,104);
  ctx.fillStyle="#a5a098";ctx.font="22px Arial";ctx.fillText(sub.toUpperCase(),28,156);
  const tex=new THREE.CanvasTexture(canvas); tex.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.PlaneGeometry(w*.9,h*.8),new THREE.MeshBasicMaterial({map:tex}));
  face.position.z=.052; panel.add(face); return panel;
}
function makeLamp(parent,x,y,z,pastMode=false){
  const fixture=box(parent,x,y,z,1.5,.09,.34,mat("fixture"+Math.random(),pastMode?0xf1e3c5:0x353b3e,.55,.4));
  const light=new THREE.PointLight(pastMode?0xffd99b:0x9bb4c5,pastMode?1.2:.18,pastMode?13:7,2);
  light.position.set(x,y-.16,z); parent.add(light);
  if(pastMode){const glow=box(parent,x,y-.08,z,1.25,.035,.2,new THREE.MeshBasicMaterial({color:0xffd9a0}));}
  return light;
}
function floor(parent,x,z,w,d,material){return box(parent,x,-.15,z,w,.3,d,material,{cast:false});}
function wall(parent,x,y,z,w,h,d,material){return box(parent,x,y,z,w,h,d,material);}
function makeTrampoline(parent,x,z,color,active=false){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const frame=box(g,0,.34,0,2.7,.12,2.7,mat("frame"+Math.random(),0x3d4549,.45,.7));
  const matTop=new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.05,emissive:active?0x18252b:0x000000,emissiveIntensity:.22,side:THREE.DoubleSide});
  const top=new THREE.Mesh(new THREE.PlaneGeometry(2.48,2.48,16,16),matTop);top.rotation.x=-Math.PI/2;top.position.y=.43;top.receiveShadow=true;g.add(top);
  const edge=new THREE.Mesh(new THREE.TorusGeometry(1.78,.055,8,48),new THREE.MeshStandardMaterial({color:0x879094,metalness:.65,roughness:.38}));
  edge.rotation.x=Math.PI/2;edge.position.y=.43;g.add(edge);
  for(let i=0;i<4;i++){
    const xx=i<2?-1.1:1.1,zz=i%2===0?-1.1:1.1;
    cyl(g,xx,.18,zz,.07,.09,.36,mat("leg"+Math.random(),0x62686a,.45,.75),10);
  }
  for(let i=-3;i<=3;i++){
    box(g,i*.34,.34,-1.33,.025,.035,.05,mat("spring"+Math.random(),0x8a8e8f,.35,.8));
    box(g,i*.34,.34,1.33,.025,.035,.05,mat("spring"+Math.random(),0x8a8e8f,.35,.8));
    box(g,-1.33,.34,i*.34,.05,.035,.025,mat("spring"+Math.random(),0x8a8e8f,.35,.8));
    box(g,1.33,.34,i*.34,.05,.035,.025,mat("spring"+Math.random(),0x8a8e8f,.35,.8));
  }
  g.userData={type:"trampoline",active,top,baseY:.43,phase:Math.random()*6.28,bounce:0};
  return g;
}
function makeBench(parent,x,z,rot=0){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;parent.add(g);
  box(g,0,.55,0,2,.12,.55,mats.wood);for(const xx of [-.8,.8])box(g,xx,.27,0,.12,.55,.4,mats.metal);
}
function makeFoamPit(parent,x,z,pastMode=false){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  box(g,0,.22,0,8,.44,6,mat("pitbase"+Math.random(),pastMode?0x316b87:0x262c31));
  for(let i=0;i<5;i++)for(let j=0;j<4;j++){
    const colors=pastMode?[mats.blue,mats.pink,mats.yellow,mats.purple,mats.green]:[mats.foam,mats.rubber,mats.black];
    const cube=box(g,-3.1+i*1.55,.58+Math.random()*.16,-2.25+j*1.5,1.38,.65,1.3,colors[(i+j)%colors.length]);
    cube.rotation.set((Math.random()-.5)*.2,Math.random()*2,(Math.random()-.5)*.2);
  }
  for(const [xx,zz,ww,dd] of [[0,-3.1,8,.2],[0,3.1,8,.2],[-4,0,.2,6],[4,0,.2,6]])box(g,xx,.6,zz,ww,.9,dd,mat("pitwall"+Math.random(),pastMode?0x286b83:0x383b3c));
  return g;
}
function makeArcade(parent,x,z,pastMode=false){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  box(g,0,1.05,0,.85,2,.72,mat("arcadebody"+Math.random(),pastMode?0x304b68:0x242629,.65));
  box(g,0,1.55,.38,.62,.68,.025,new THREE.MeshBasicMaterial({color:pastMode?0x4cbbd1:0x18252b}));
  box(g,0,.72,.38,.55,.12,.025,mats.black);
  sphere(g,0,.72,.42,.05,mats.gold);
  if(pastMode){const glow=new THREE.PointLight(0x56b9ff,.6,3);glow.position.set(0,1.5,.7);g.add(glow);}
}
function makeChild(parent,x,y,z,shirt,variant=0){
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  const body=cyl(g,0,.75,0,.22,.28,.75,shirt,12);body.rotation.z=variant?.06:0;
  sphere(g,0,1.28,0,.22,mats.skin,[.88,1.05,.92]);
  sphere(g,-.22,1.3,.015,.07,mat("hair"+Math.random(),0x29201b),[1,.6,1]);
  sphere(g,.22,1.3,.015,.07,mat("hair"+Math.random(),0x29201b),[1,.6,1]);
  for(const sx of [-.13,.13]){cyl(g,sx,.3,0,.075,.085,.55,mat("pants"+Math.random(),0x313943),10);sphere(g,sx,.05,.07,.09,mats.black,[1,.5,1.5]);}
  for(const sx of [-.28,.28]){cyl(g,sx,.78,0,.07,.08,.55,shirt,10);}
  g.userData={child:true,baseY:y,phase:Math.random()*6.28};
  return g;
}
function makeCopy(){
  const g=new THREE.Group();scene.add(g);
  const dark=new THREE.MeshStandardMaterial({color:0x101317,roughness:.92});
  const body=cyl(g,0,.86,0,.28,.34,.95,dark,12);
  sphere(g,0,1.53,0,.25,dark,[.9,1.15,.92]);
  sphere(g,-.22,1.57,.04,.08,mat("copyhair",0x08090a),[1,.7,1]);
  sphere(g,.22,1.57,.04,.08,mat("copyhair2",0x08090a),[1,.7,1]);
  const eyeMat=new THREE.MeshBasicMaterial({color:0xb94b3e});
  sphere(g,-.09,1.55,.265,.025,eyeMat);sphere(g,.09,1.55,.265,.025,eyeMat);
  for(const sx of [-.17,.17])cyl(g,sx,.25,0,.09,.1,.55,dark,10);
  g.visible=false;g.userData={phase:0};return g;
}
const copy=makeCopy();

function buildPark(){
  // Shared building footprint: reception north, arena center, foam/dodgeball west,
  // birthday/staff wing east, exit north-east. Wide corridors preserve navigation.
  const W=42,D=50;
  for(const group of [presentGroup,pastGroup]){
    const isPast=group===pastGroup;
    const fm=isPast?new THREE.MeshStandardMaterial({color:0x333a3d,roughness:.85}):mats.concrete;
    floor(group,0,0,W,D,fm);
    wall(group,0,5,-25,W,10,.5,isPast?mats.white:mats.rust);
    wall(group,0,5,25,W,10,.5,isPast?mats.white:mats.concrete);
    wall(group,-21,5,0,.5,10,D,isPast?mats.white:mats.concrete);
    wall(group,21,5,0,.5,10,D,isPast?mats.white:mats.concrete);
    box(group,0,10,0,W,.35,D,isPast?mats.ceiling:mats.black);
    // Structural beams and overhead fixtures
    for(let x=-18;x<=18;x+=6){box(group,x,9.65,0,.18,.35,D,isPast?mats.white:mats.metal);}
    for(let z=-21;z<=21;z+=7)makeLamp(group,0,9.25,z,isPast);
    // Main arena barriers; central openings at x +- 7
    wall(group,-14,1.8,-4,14,3,.25,isPast?mats.blue:mats.rust);
    wall(group,14,1.8,-4,14,3,.25,isPast?mats.blue:mats.rust);
    wall(group,-18.5,1.8,7,5,3,.25,isPast?mats.blue:mats.rust);
    wall(group,-8.5,1.8,7,3,3,.25,isPast?mats.blue:mats.rust);
    wall(group,8.5,1.8,7,3,3,.25,isPast?mats.blue:mats.rust);
    wall(group,18.5,1.8,7,5,3,.25,isPast?mats.blue:mats.rust);
    // Reception desk and entrance hall
    box(group,0,.65,-20,9,1.3,1.2,isPast?mats.wood:mats.rust);
    addTextPanel(group,0,3.5,-24.65,5,1.5,"JUMP ZONE","TRAMPOLINE & ADVENTURE",isPast?0x4a9bc7:0xc9a77a);
    // Birthday room east
    wall(group,8.5,2.1,16,7,4,.25,isPast?mats.pink:mats.rust);
    wall(group,17.5,2.1,16,7,4,.25,isPast?mats.pink:mats.rust);
    box(group,13,.45,15,5,.9,2.2,isPast?mats.wood:mats.rust);
    // Staff corridor behind birthday room
    wall(group,8.5,2.1,22,7,4,.25,isPast?mats.white:mats.rust);
    wall(group,17.5,2.1,22,7,4,.25,isPast?mats.white:mats.rust);
    // Foam pit / dodgeball west
    wall(group,-18.5,2.1,16,5,4,.25,isPast?mats.blue:mats.rust);
    wall(group,-8.5,2.1,16,3,4,.25,isPast?mats.blue:mats.rust);
    makeFoamPit(group,-13,12,isPast);
    // Reception props
    makeBench(group,-5,-19,.1); makeBench(group,5,-19,-.1);
    makeArcade(group,-3,-14,isPast);makeArcade(group,3,-14,isPast);
    // Arena trampolines
    const pads=[[-12,-1,0x2b799e],[-8,-1,0x7b4b8d],[-3,-1,0x2c7c72],[3,-1,0xb16c39],[8,-1,0x3b719b],[12,-1,0x86536b],[-12,5,0x397d8a],[-8,5,0x9b5c76],[-3,5,0x426f9a],[3,5,0x98713e],[8,5,0x3c7c73],[12,5,0x875b9a]];
    pads.forEach((p,i)=>makeTrampoline(group,p[0],p[1],isPast?p[2]:0x22292c,i===0));
    // Special time pads in both timelines
    const special=makeTrampoline(group,0,13,isPast?0xe2ad66:0x4a6570,true);
    special.userData.special=true;
    const pitPad=makeTrampoline(group,-13,3,isPast?0xe3a0b2:0x546c7c,true);pitPad.userData.special=true;pitPad.userData.name="foam trampoline";
    const birthdayPad=makeTrampoline(group,13,3,isPast?0xf0c77d:0x586b7a,true);birthdayPad.userData.special=true;
    // Birthday room decorations
    for(let i=0;i<5;i++){
      const balloon=sphere(group,8+i*2.3,3.2,13+Math.sin(i)*.6,.42,[mats.pink,mats.blue,mats.yellow,mats.purple,mats.green][i],[.82,1.1,.82]);
      cyl(group,8+i*2.3,2.55,13+Math.sin(i)*.6,.008,.008,.8,mats.white,6);
    }
    for(let i=0;i<4;i++)box(group,7+i*3.8,3.6,10,.8,.04,.4,mats.yellow,{rot:[0,0,.15]});
    makeArcade(group,17,18,isPast);
    // Staff door, visible and reachable from party room through doorway at x13
    const door=box(group,13,1.6,21.7,2.2,3.2,.22,isPast?mats.wood:mats.rust);
    door.userData.staffDoor=true;
    // wall signs
    addTextPanel(group,-13,3.6,5.8,4,1.1,"FOAM PIT","WATCH YOUR STEP",isPast?0x72c7d6:0xc9a77a);
    addTextPanel(group,13,3.6,5.8,4,1.1,"PARTY ROOMS","BIRTHDAY WING",isPast?0xf4b5c7:0xc9a77a);
    // Columns, vents, grime panels
    for(let x=-18;x<=18;x+=6)for(let z=-22;z<=22;z+=11){
      box(group,x,4.7,z,.45,9.4,.45,isPast?mats.white:mats.rust);
    }
    // past memory children: repeated movement loops
    if(isPast){
      const younger=makeChild(group,-3,0,-3,mats.shirt,0);
      const brother=makeChild(group,1,0,-2,mats.yellow,1);
      younger.userData.role="youngerSelf";brother.userData.role="brother";
      const distant=makeChild(group,-16,0,-15,mats.pink,0);distant.scale.setScalar(.8);
      group.userData.memoryActors=[younger,brother,distant];
      // bright floor lanes
      for(let i=0;i<5;i++)box(group,-15+i*7,.012,-9,5,.02,1.3,[mats.blue,mats.pink,mats.yellow,mats.green,mats.purple][i],{cast:false});
    }else{
      // abandoned debris / subtle story props
      for(let i=0;i<14;i++){
        const x=-18+Math.random()*36,z=-22+Math.random()*44;
        if(Math.abs(x)<6&&Math.abs(z)<8)continue;
        box(group,x,.08,z,.3,.12,.5,mat("debris"+i,0x3c3a35,.95),{rot:[Math.random()*.2,Math.random()*2,Math.random()*.2]});
      }
      // hanging cables
      for(let i=0;i<5;i++){
        const cable=cyl(group,-18+i*8,8.5,-12,.025,.025,2.5,mats.black,6);
        cable.rotation.z=.15;
      }
    }
  }
  // Interactive story props in present, matching positions in past
  addTextPanel(presentGroup,0,2.6,-18.9,3.4,1.1,"RECEPTION","CLOSED SINCE 2019");
  addTextPanel(pastGroup,0,2.6,-18.9,3.4,1.1,"WELCOME","HAVE A GREAT JUMP");
  const card=box(presentGroup,-2.2,.82,-19.3,.42,.04,.62,mats.gold);card.userData={type:"membership",label:"Pick up your brother's membership card"};
  const flashlightItem=cyl(presentGroup,0,1.65,-20.15,.09,.09,.48,mats.metal,12);flashlightItem.rotation.z=Math.PI/2;flashlightItem.userData={type:"flashlight",label:"Pick up the flashlight"};
  const flashlightGlow=new THREE.PointLight(0xd6c18e,.65,2.4);flashlightGlow.position.set(0,1.9,-20.15);presentGroup.add(flashlightGlow);
  const keychain=sphere(pastGroup,-4,.78,4,.14,mats.gold);keychain.userData={type:"keychain",label:"Take the keychain memory"};
  const hiddenKey=box(presentGroup,-8.5,.75,14,.28,.12,.38,mats.gold);hiddenKey.userData={type:"hiddenKey",label:"Retrieve the staff key"};
  const birthdayPhoto=box(presentGroup,13,1.2,12,.65,.5,.035,mats.wood);birthdayPhoto.userData={type:"photo",label:"Examine the birthday photograph"};
  const birthdayCake=cyl(pastGroup,13,.95,15,.75,.75,.5,mats.pink,24);birthdayCake.userData={type:"cake",label:"Remember the birthday code"};
  const console=box(presentGroup,13,1.25,23,.9,1.3,.6,mats.metal);console.userData={type:"console",label:"Recover the security recording"};
  const pastConsole=box(pastGroup,13,1.25,23,.9,1.3,.6,mats.blue);pastConsole.userData={type:"pastConsole",label:"Observe the security monitor"};
  const finalPad=makeTrampoline(presentGroup,0,-7,0x8a4e42,true);finalPad.userData.special=true;finalPad.userData.finalPad=true;
  const finalPadPast=makeTrampoline(pastGroup,0,-7,0xd8a66e,true);finalPadPast.userData.special=true;finalPadPast.userData.finalPad=true;
  // Secret memory collectible in staff corridor
  const secret=box(presentGroup,18,.8,23,.25,.3,.12,mats.gold);secret.userData={type:"secret",label:"Find the hidden memory"};
  // Security door indicator
  const lock=box(presentGroup,11.8,1.7,21.55,.18,.35,.12,mats.black);lock.userData={type:"doorLock"};
}
buildPark();

// STYLIZED ART DIRECTION PASS -------------------------------------------------
// Procedural hand-painted textures keep the project self-contained and avoid
// changing any gameplay meshes, triggers, collision volumes, or puzzle state.
function paintedTexture(base, accent, seed=1, repeatX=1, repeatY=1){
  const c=document.createElement("canvas"); c.width=512; c.height=512;
  const ctx=c.getContext("2d"); ctx.fillStyle=base; ctx.fillRect(0,0,512,512);
  let n=seed>>>0; const rand=()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};
  // broad soft brush strokes
  for(let i=0;i<180;i++){
    const x=rand()*512,y=rand()*512,w=8+rand()*95,h=2+rand()*18;
    ctx.globalAlpha=.025+rand()*.075; ctx.fillStyle=accent;
    ctx.beginPath();ctx.ellipse(x,y,w,h,rand()*Math.PI,0,Math.PI*2);ctx.fill();
  }
  // fine grain and scattered worn flecks
  for(let i=0;i<4200;i++){
    const x=rand()*512,y=rand()*512;ctx.globalAlpha=.025+rand()*.1;
    ctx.fillStyle=rand()>.5?"#fff":"#08090d";ctx.fillRect(x,y,1+rand()*2,1+rand()*2);
  }
  ctx.globalAlpha=1;
  const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(repeatX,repeatY);
  tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()); return tex;
}
function applyPaint(material,base,accent,seed,rx=1,ry=1){
  if(!material||!material.isMeshStandardMaterial)return;
  material.map=paintedTexture(base,accent,seed,rx,ry);material.color.set(0xffffff);
  material.needsUpdate=true;
}
applyPaint(mats.concrete,"#55565b","#c5b9a7",11,5,6);
applyPaint(mats.ceiling,"#242934","#778092",12,5,5);
applyPaint(mats.rubber,"#202631","#667080",13,2,2);
applyPaint(mats.metal,"#69747b","#d5c6a8",14,2,2);
applyPaint(mats.rust,"#554047","#d18c72",15,3,3);
applyPaint(mats.wood,"#725640","#d6a77b",16,2,2);
applyPaint(mats.white,"#c9c2b2","#fff0d5",17,3,3);
applyPaint(mats.foam,"#405c79","#8eb2c5",18,2,2);
// Give the abandoned and memory timelines distinct, intentional palettes.
presentGroup.traverse(o=>{if(o.isMesh&&o.material?.isMeshStandardMaterial){o.material.roughness=Math.max(.58,o.material.roughness);}});
pastGroup.traverse(o=>{if(o.isMesh&&o.material?.isMeshStandardMaterial){o.material.roughness=Math.max(.48,o.material.roughness);}});
function addWorldArt(group,isPast){
  const trim=isPast?new THREE.MeshStandardMaterial({color:0x6e9aa0,roughness:.62,metalness:.12}):new THREE.MeshStandardMaterial({color:0x654d60,roughness:.78});
  const glow=isPast?0xffc985:0x83b9d0;
  // Colored perimeter rails and repeated wall pilasters break up giant flat walls.
  for(let x=-18;x<=18;x+=6){
    box(group,x,.42,-24.68,.12,.12,.12,trim,{cast:false});
    box(group,x,.42,24.68,.12,.12,.12,trim,{cast:false});
    box(group,x,8.8,-24.68,.08,.08,.08,trim,{cast:false});
    box(group,x,8.8,24.68,.08,.08,.08,trim,{cast:false});
  }
  // Ceiling luminous strips and suspended acoustic baffles.
  for(let z=-20;z<=20;z+=8){
    const strip=new THREE.Mesh(new THREE.BoxGeometry(4.2,.035,.16),new THREE.MeshBasicMaterial({color:glow}));
    strip.position.set(0,9.38,z);group.add(strip);
    const lamp=new THREE.PointLight(glow,isPast?.42:.22,9,2);lamp.position.set(0,8.95,z);group.add(lamp);
    for(const x of [-16,-8,8,16]){
      box(group,x,9.25,z,.16,.12,3.4,isPast?mats.blue:mats.metal,{cast:false});
    }
  }
  // Floor lane markings: graphic but worn, like a real family entertainment venue.
  const laneColors=isPast?[0x55a6b4,0xe58aa8,0xe4bd69,0x7e8fc4]:[0x334451,0x51404d,0x6a5140,0x344d50];
  for(let i=0;i<4;i++){
    const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.8,38),new THREE.MeshStandardMaterial({color:laneColors[i],roughness:.9,transparent:true,opacity:isPast?.28:.12}));
    stripe.rotation.x=-Math.PI/2;stripe.position.set(-15+i*10,-.001,0);group.add(stripe);
  }
  // Acoustic wall panels add scale and rhythm without obstructing walkable space.
  for(const z of [-17,-9,1,11,20])for(const side of [-1,1]){
    const panel=box(group,side*20.68,5,z,.035,2.2,3.4,trim,{cast:false});
    panel.material=trim;
    for(let k=0;k<5;k++)box(group,side*20.63,4.15+k*.36,z,.025,.025,2.9,isPast?mats.yellow:mats.metal,{cast:false});
  }
  // Low-poly hanging pennants in the party wing.
  if(isPast){
    for(let i=0;i<9;i++){
      const pennant=new THREE.Mesh(new THREE.ConeGeometry(.28,.62,3),new THREE.MeshStandardMaterial({color:[0xe88eaa,0x70b7c3,0xe8c36e,0x9b8ac7][i%4],roughness:.8}));
      pennant.rotation.z=Math.PI; pennant.position.set(8+i*.95,4.25,9.3);group.add(pennant);
    }
  }
}
addWorldArt(presentGroup,false);addWorldArt(pastGroup,true);
// A subtle atmospheric gradient and floating dust motes, d in update().
const dustMaterial=new THREE.MeshBasicMaterial({color:0xc6bca7,transparent:true,opacity:.22,depthWrite:false});
const dust=new THREE.Group();
for(let i=0;i<110;i++){const mote=new THREE.Mesh(new THREE.SphereGeometry(.012+Math.random()*.018,5,4),dustMaterial);mote.position.set((Math.random()-.5)*38,1+Math.random()*7,(Math.random()-.5)*44);mote.userData.phase=Math.random()*6.28;dust.add(mote);}
scene.add(dust);

const walls=[
  // Outer shell
  {minX:-21,maxX:21,minZ:-25.5,maxZ:-24.5},
  {minX:-21,maxX:21,minZ:24.5,maxZ:25.5},
  {minX:-21.5,maxX:-20.5,minZ:-25,maxZ:25},
  {minX:20.5,maxX:21.5,minZ:-25,maxZ:25},
  // divider wall sections leave central wide access
  {minX:-21,maxX:-7,minZ:-4.2,maxZ:-3.8},{minX:7,maxX:21,minZ:-4.2,maxZ:-3.8},
  {minX:-21,maxX:-16,minZ:6.8,maxZ:7.2},{minX:-11,maxX:-7,minZ:6.8,maxZ:7.2},{minX:7,maxX:11,minZ:6.8,maxZ:7.2},{minX:16,maxX:21,minZ:6.8,maxZ:7.2},
  // rear partitions leave wide door openings into both wings
  {minX:-21,maxX:-14.2,minZ:15.8,maxZ:16.2},{minX:-11.8,maxX:-5.2,minZ:15.8,maxZ:16.2},
  {minX:5.2,maxX:11.8,minZ:15.8,maxZ:16.2},{minX:14.2,maxX:21,minZ:15.8,maxZ:16.2},
  // staff corridor wall leaves a real doorway at x=13
  {minX:5,maxX:11.8,minZ:21.8,maxZ:22.2},{minX:14.2,maxX:21,maxZ:22.2,minZ:21.8}
];

function collides(x,z,r=.34){
  for(const w of walls)if(x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ)return true;
  // keep the foam-pit basin itself solid; the storage compartment is on its near edge
  if(x>-17&&x<-9&&z>9&&z<15.2)return true;
  return false;
}
function moveWithCollision(dx,dz){
  const p=camera.position, r=.36;
  if(!collides(p.x+dx,p.z,r))p.x+=dx;
  if(!collides(p.x,p.z+dz,r))p.z+=dz;
  p.x=THREE.MathUtils.clamp(p.x,-20.1,20.1);
  p.z=THREE.MathUtils.clamp(p.z,-24.1,24.1);
}
function setTimeline(t){
  state.timeline=t;
  presentGroup.visible=t==="present"; pastGroup.visible=t==="past";
  scene.fog.color.set(t==="past"?0x9d9a87:0x090b0e);
  scene.fog.density=t==="past"?.012:.027;
  scene.background.set(t==="past"?0xaaa38e:0x090b0e);
  ambient.intensity=t==="past"?.9:.23;
  ambient.color.set(t==="past"?0xffdfb0:0x71808d);
  ui.timeline.textContent=t.toUpperCase();
  ui.chip.style.borderColor=t==="past"?"rgba(236,197,135,.55)":"rgba(255,255,255,.2)";
  ui.chip.querySelector(".timeline-dot").style.background=t==="past"?"#f0c982":"#d0a96f";
  ui.timerPanel.classList.toggle("hidden",t!=="past");
  if(t==="past"){state.pastDuration=[60,50,40,30,20][Math.min(4,state.instability-1)];state.pastTime=state.pastDuration;state.forcedWarned=false;}
  else{state.pastTime=0;}
  copy.visible=t==="present"&&state.switches>=1;
  if(t==="present") updateCopySpawn();
}
function updateObjective(s){state.objective=s;ui.objective.textContent=s;}
function toast(s,d=2600){
  ui.toast.textContent=s;ui.toast.classList.add("show");clearTimeout(state.toastTimer);
  state.toastTimer=setTimeout(()=>ui.toast.classList.remove("show"),d);
}
function caption(s,d=3600){
  ui.caption.textContent=s;ui.caption.classList.add("show");setTimeout(()=>ui.caption.classList.remove("show"),d);
}
function subtitle(s,d=2600){
  ui.subtitle.textContent=s;ui.subtitle.classList.add("show");clearTimeout(state.subtitleTimer);
  state.subtitleTimer=setTimeout(()=>ui.subtitle.classList.remove("show"),d);
}
function setFlashlight(on){
  state.flashlight=Boolean(on&&state.hasFlashlight);
  flashlight.intensity=state.flashlight?115:0;
  fillLight.intensity=state.flashlight?1.1:0;
  ui.flashlight.classList.toggle("on",state.flashlight);ui.flashlightLabel.textContent=state.flashlight?"ON":"OFF";
  if(state.flashlight)playTone(950,.035,"sine",.025);
}
function playTone(freq,duration=.12,type="sine",volume=.05,when=0){
  if(!audio.ctx)return;
  const ctx=audio.ctx,osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,ctx.currentTime+when);
  gain.gain.setValueAtTime(volume,ctx.currentTime+when);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+when+duration);
  osc.connect(gain);gain.connect(audio.master);osc.start(ctx.currentTime+when);osc.stop(ctx.currentTime+when+duration+.02);
}
function noiseBurst(duration=.3,volume=.05,filter=700){
  if(!audio.ctx)return;
  const ctx=audio.ctx,buffer=ctx.createBuffer(1,ctx.sampleRate*duration,ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
  src.buffer=buffer;f.type="lowpass";f.frequency.value=filter;g.gain.value=volume;
  src.connect(f);f.connect(g);g.connect(audio.master);src.start();
}
const audio={ctx:null,master:null,pastOsc:null,presentOsc:null,ambience:null,started:false};
function initAudio(){
  if(audio.ctx)return;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  audio.ctx=new AC();audio.master=audio.ctx.createGain();audio.master.gain.value=.72;audio.master.connect(audio.ctx.destination);
  const low=audio.ctx.createOscillator(),lg=audio.ctx.createGain();low.type="sine";low.frequency.value=43;lg.gain.value=.018;low.connect(lg);lg.connect(audio.master);low.start();
  const hum=audio.ctx.createOscillator(),hg=audio.ctx.createGain();hum.type="triangle";hum.frequency.value=59;hg.gain.value=.006;hum.connect(hg);hg.connect(audio.master);hum.start();
  audio.ambience={low,lg,hum,hg};
}
function ambienceForTimeline(){
  if(!audio.ctx)return;
  const t=audio.ctx.currentTime;
  audio.ambience.lg.gain.cancelScheduledValues(t);
  audio.ambience.lg.gain.linearRampToValueAtTime(state.timeline==="past"?.006:.025,t+1);
  audio.ambience.hg.gain.linearRampToValueAtTime(state.timeline==="past"?.018:.004,t+1);
}
function playFootstep(){
  if(!audio.ctx)return;
  noiseBurst(.055,.025,state.timeline==="past"?1300:500);
  playTone(state.timeline==="past"?140:82,.055,"sine",.018);
}
function playBounce(){
  playTone(62,.32,"sine",.13);playTone(180,.2,"triangle",.04,.06);noiseBurst(.16,.055,900);
}
function playTransition(){
  noiseBurst(.8,.12,1600);playTone(48,.9,"sine",.12);playTone(420,.45,"sawtooth",.025,.12);
}
function playSting(){playTone(49,.9,"sawtooth",.14);playTone(230,.5,"sine",.07,.08);noiseBurst(.5,.1,900);}
function playClick(){playTone(680,.04,"square",.025);}

function lockPointer(){
  if(!state.started||state.paused||state.cutscene||state.gameOver)return;
  canvas.requestPointerLock?.();
}
document.addEventListener("pointerlockchange",()=>{state.locked=document.pointerLockElement===canvas;});
document.addEventListener("mousemove",e=>{
  if(!state.locked)return;
  state.mouseYaw-=e.movementX*.0021;
  state.mousePitch-=e.movementY*.0018;
  state.mousePitch=THREE.MathUtils.clamp(state.mousePitch,-1.45,1.45);
});
document.addEventListener("keydown",e=>{
  if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
  state.keys[e.code]=true;
  if(e.code==="Escape"&&state.started&&!state.cutscene&&!state.gameOver){togglePause();}
  if(e.code==="KeyF"&&!e.repeat&&state.started&&!state.paused)setFlashlight(!state.flashlight);
  if(e.code==="KeyE"&&!e.repeat&&state.started&&!state.paused)interact();
  if(e.code==="Space"&&!e.repeat&&state.started&&!state.paused)tryJump();
});
document.addEventListener("keyup",e=>state.keys[e.code]=false);
canvas.addEventListener("click",()=>{if(state.started&&!state.paused&&!state.cutscene&&!state.locked)lockPointer();});

function togglePause(force=null){
  state.paused=force===null?!state.paused:force;
  ui.pause.classList.toggle("hidden",!state.paused);
  if(state.paused){document.exitPointerLock?.();}else lockPointer();
}
function finishCutscene(onComplete){
  state.cutsceneTimers.forEach(clearTimeout);state.cutsceneTimers=[];
  ui.intro.classList.add("hidden");state.cutscene=false;
  ui.intro.querySelector(".scene-visual").className="scene-visual";
  const done=onComplete||state.cutsceneComplete;state.cutsceneComplete=null;
  if(done)done();
}
function playStoryCutscene(kicker, shots, onComplete){
  state.cutscene=true;state.cutsceneComplete=onComplete||null;document.exitPointerLock?.();ui.intro.classList.remove("hidden");
  const visual=$("scene-visual"),captionText=$("scene-caption"),subtitleText=$("scene-subtitle");
  let index=0;
  const show=()=>{
    if(index>=shots.length){finishCutscene(onComplete);return;}
    const shot=shots[index++];
    $("scene-kicker").textContent=shot.kicker||kicker;
    captionText.textContent=shot.caption;
    subtitleText.textContent=shot.subtitle||"";
    visual.className="scene-visual "+(shot.visual||"");
    state.cutsceneTimers.push(setTimeout(show,shot.duration||3200));
  };
  show();
}
function startGame(){
  initAudio();audio.ctx?.resume();state.started=true;state.paused=false;
  ui.title.classList.add("hidden");ui.hud.classList.remove("hidden");
  ui.loading.classList.remove("done");
  camera.position.set(0,1.7,-22.8);state.mouseYaw=Math.PI;state.mousePitch=0;
  setTimeline("present");ambienceForTimeline();
  ui.loading.classList.add("done");setTimeout(()=>ui.loading.classList.add("hidden"),750);
  runIntroCutscene();
}
function runIntroCutscene(){
  state.cutsceneDone.intro=true;
  playStoryCutscene("UNKNOWN NUMBER · VOICEMAIL",[
    {kicker:"UNKNOWN NUMBER · VOICEMAIL",caption:"Your phone vibrates. The screen lights up in the dark.",subtitle:"AUDIO MESSAGE · 00:17",visual:"phone-shot",duration:3000},
    {kicker:"VOICE MESSAGE · 00:04",caption:"Hey... it's me.",subtitle:"UNKNOWN VOICE",visual:"phone-shot",duration:2800},
    {kicker:"VOICE MESSAGE · 00:08",caption:"I'm still here. Remember our favorite place?",subtitle:"AUDIO MESSAGE · 00:08",visual:"memory-shot",duration:3200},
    {kicker:"VOICE MESSAGE · 00:13",caption:"Can we play one more time?",subtitle:"AUDIO MESSAGE · 00:13",visual:"memory-shot",duration:3200},
    {kicker:"SEVEN YEARS LATER",caption:"You know that voice. You never forgot it.",subtitle:"JUMP ZONE · CLOSED SINCE 2019",visual:"dark-shot",duration:3600}
  ],()=>{updateObjective("Find the flashlight at reception.");toast("The entrance is unlocked. Find a light.");lockPointer();});
}
$("skip-cutscene").addEventListener("click",()=>finishCutscene());
$("start-button").addEventListener("click",startGame);
$("resume-button").addEventListener("click",()=>togglePause(false));
$("restart-button").addEventListener("click",()=>location.reload());
$("ending-restart").addEventListener("click",()=>location.reload());

function tryJump(){
  if(state.jumpLock>0)return;
  if(state.grounded){state.verticalVelocity=6.1;state.grounded=false;state.jumpLock=.18;playTone(120,.08,"sine",.02);}
}
function interact(){
  if(!state.interactable)return;
  const obj=state.interactable;
  const type=obj.userData.type;
  if(type==="flashlight"){
    state.hasFlashlight=true;obj.visible=false;setFlashlight(true);toast("Flashlight acquired.");updateObjective("Find your brother's membership card at reception.");playClick();
  }else if(type==="membership"){
    if(!state.hasFlashlight){toast("It's too dark to make out the details.");return;}
    state.hasCard=true;obj.visible=false;toast("Membership card: ARI K. · MEMBER SINCE 2016");caption("ARI K.  /  MEMBER SINCE 2016");
    updateObjective("Follow the sound of bouncing to the main arena.");playClick();
  }else if(type==="keychain"){
    if(state.timeline!=="past"){return;}
    state.hasMemory1=true;obj.visible=false;toast("A tiny astronaut keychain. He carried it everywhere.");caption("He never went anywhere without it.");
    updateObjective("Return to the present. Something may have followed you.");playClick();
  }else if(type==="hiddenKey"){
    if(!state.hasMemory1){toast("The compartment is stuck. You need to know where to look.");return;}
    state.hasKey=true;obj.visible=false;toast("Staff key recovered.");updateObjective("Find the birthday room and its photograph.");playClick();
  }else if(type==="photo"){
    state.hasPhoto=true;state.hasMemory2=true;toast("The date on the cake: 08 · 14 · 16.");caption("A birthday. One last jump. Then everything changed.");
    updateObjective("Use the birthday clue to access the staff console.");playClick();
  }else if(type==="cake"){
    state.birthdayCode="0814";state.hasMemory2=true;toast("The cake reads AUGUST 14. Remember: 0814.");caption("AUGUST 14, 2016");playClick();
  }else if(type==="console"){
    if(!state.staffUnlocked){toast("STAFF ACCESS LOCKED. A key is required.");return;}
    if(state.birthdayCode!=="0814"){toast("The console needs the birthday code. Check the cake in the past.");return;}
    if(!state.hasObservedRecording){toast("The console is missing its timestamp. Observe the working monitor in the past.");return;}
    state.hasTape=true;state.hasMemory3=true;toast("SECURITY CLIP RESTORED · 23:47");caption("You were both still here after closing time.",4200);
    updateObjective("Return to the main arena. Find the final memory.");playClick();
  }else if(type==="pastConsole"){
    if(state.timeline!=="past")return;
    toast("The monitor shows the foam pit. The time reads 23:47.");state.hasObservedRecording=true;state.hasMemory3=true;playClick();
  }else if(type==="secret"){
    state.hiddenMemory=true;obj.visible=false;toast("SECRET MEMORY FOUND · A second pair of shoes by the exit.");caption("You remember more than you think.",3600);playClick();
  }else if(type==="door"){
    if(!state.hasKey){toast("The staff door is locked. Find the key.");return;}
    state.staffUnlocked=true;obj.visible=false;toast("STAFF DOOR UNLOCKED.");playClick();
  }else if(type==="final"){
    if(state.finalSequence===0){
      if(!state.hasTape){toast("The memory is incomplete. Recover the security recording first.");return;}
      state.finalSequence=1;state.hasMemory3=true;toast("The final sequence is waiting.");startFinalSequence();
    }
  }
}
function updateCopySpawn(){
  const p=camera.position;
  const spots=[new THREE.Vector3(0,0,1),new THREE.Vector3(16,0,11),new THREE.Vector3(-16,0,12),new THREE.Vector3(0,0,19),new THREE.Vector3(0,0,-13)];
  let target=spots[Math.min(spots.length-1,Math.floor((state.switches-1)/2))];
  if(state.switches>=3&&state.enemyMode!=="hunting"){
    const behind=new THREE.Vector3(p.x+Math.sin(state.mouseYaw)*-7,0,p.z+Math.cos(state.mouseYaw)*-7);
    target=behind;
  }
  copy.position.set(target.x,0,target.z);copy.visible=state.timeline==="present"&&state.switches>0;
  state.enemyLastMove=state.elapsed+2;
}
function transitionTimeline(reason="voluntary"){
  if(state.transitioning||state.cutscene)return;
  state.transitioning=true;state.switches++;
  state.instability=Math.min(5,Math.floor((state.switches-1)/2)+1);
  const entering=state.timeline==="present";
  playTransition();
  ui.transition.style.transition="opacity .18s ease";
  ui.transition.style.opacity="1";
  const bounceY=camera.position.y;
  setTimeout(()=>{
    setTimeline(entering?"past":"present");ambienceForTimeline();
    if(!entering){
      // The Copy's presence escalates with each return.
      if(state.switches>=2){copy.visible=true;copy.position.set(camera.position.x+4,0,camera.position.z-8);}
      if(state.switches>=4){state.enemyMode="stalking";}
      if(state.switches>=6){state.enemyMode="following";}
      if(state.switches>=8){state.enemyMode="hunting";state.chase=true;}
    }
    ui.transition.style.transition="opacity .65s ease";ui.transition.style.opacity="0";
    setTimeout(()=>{state.transitioning=false;},680);
    if(entering){
      toast(`MEMORY WINDOW · ${state.pastDuration} SECONDS`,1800);
      if(state.switches===1&&!state.cutsceneDone.past){
        state.cutsceneDone.past=true;
        playStoryCutscene("MEMORY RESTORED · AUGUST 2016",[
          {kicker:"MEMORY RESTORED · AUGUST 2016",caption:"The lights come back. The colors return. The park is alive again.",subtitle:"SOMEWHERE IN THE DISTANCE, TWO CHILDREN ARE LAUGHING.",visual:"memory-shot",duration:3600},
          {kicker:"THE PAST",caption:"You see your younger self bouncing beside your brother. Neither of them knows what happens next.",subtitle:"BROTHER: BET YOU CAN'T BEAT MY JUMP!",visual:"past-shot",duration:4200},
          {kicker:"MEMORY WINDOW",caption:"You cannot stay here. Find a trampoline before the memory collapses.",subtitle:"60 SECONDS REMAIN",visual:"past-shot",duration:3200}
        ],()=>{caption("For a moment, everything is exactly as it was.",3000);lockPointer();});
      }
      if(state.switches>=3&&state.hasMemory1===false)caption("Your brother is looking right at you.",2800);
    }else{
      if(state.switches===2)toast("Something is standing across the arena.",3000);
      if(state.switches>=4)toast("THE COPY IS CLOSER.",1800);
    }
    if(state.instability>=3&&state.timeline==="past"){
      setTimeout(()=>{if(state.timeline==="past"&&state.instability>=3)glitchPulse();},5000);
    }
  },520);
}
function glitchPulse(){
  ui.transition.style.background="#d9c9a7";ui.transition.style.opacity=".18";
  playTone(38,.4,"sawtooth",.08);
  setTimeout(()=>{ui.transition.style.opacity="0";ui.transition.style.background="#f5e9ca";},150);
}
function checkTrampolineLanding(prevY){
  if(state.grounded&&state.verticalVelocity===0&&prevY>.45&&camera.position.y<=2.05){
    const group=state.timeline==="present"?presentGroup:pastGroup;
    for(const pad of group.children){
      if(pad.userData?.type!=="trampoline")continue;
      const dx=camera.position.x-pad.position.x,dz=camera.position.z-pad.position.z;
      if(Math.abs(dx)<1.2&&Math.abs(dz)<1.2){
        const special=pad.userData.special;
        state.verticalVelocity=8.7;state.grounded=false;state.jumpLock=.5;playBounce();
        pad.userData.bounce=.28;
        if(special){transitionTimeline("trampoline");}
        else if(pad.userData.finalPad&&state.hasTape){startFinalSequence();}
        break;
      }
    }
  }
}
function updateTrampolines(dt){
  for(const group of [presentGroup,pastGroup]){
    for(const pad of group.children){
      if(pad.userData?.type==="trampoline"){
        pad.userData.phase+=dt*2.5;
        const b=pad.userData.bounce||0;
        pad.userData.bounce=Math.max(0,b-dt);
        const dip=b>0?Math.sin((.28-b)/.28*Math.PI)*.17:Math.sin(pad.userData.phase)*.012;
        pad.userData.top.position.y=.43-dip;
      }
    }
  }
}
function nearestInteractable(){
  const group=state.timeline==="present"?presentGroup:pastGroup;
  raycaster.setFromCamera(center,camera);
  const hits=raycaster.intersectObjects(group.children,true);
  let best=null;
  for(const hit of hits){
    let o=hit.object;
    while(o&&o.parent!==group&&!o.userData.type)o=o.parent;
    if(!o?.userData.type)continue;
    if(hit.distance>3.4)continue;
    const type=o.userData.type;
    if(type==="keychain"&&state.timeline!=="past")continue;
    if(type==="cake"&&state.timeline!=="past")continue;
    if(type==="pastConsole"&&state.timeline!=="past")continue;
    if(type==="hiddenKey"&&!state.hasMemory1)continue;
    if(type==="console"&&!state.staffUnlocked)continue;
    if(type==="secret"&&state.hiddenMemory)continue;
    if(type==="membership"&&state.hasCard)continue;
    if(type==="flashlight"&&state.hasFlashlight)continue;
    best=o;break;
  }
  return best;
}
function updateInteractPrompt(){
  state.interactable=nearestInteractable();
  if(state.interactable){
    ui.prompt.classList.remove("hidden");
    ui.promptText.textContent=state.interactable.userData.label||"INTERACT";
  }else ui.prompt.classList.add("hidden");
}
function updatePlayer(dt){
  const p=camera.position;
  camera.rotation.y=state.mouseYaw;camera.rotation.x=state.mousePitch;
  const forward=new THREE.Vector3(-Math.sin(state.mouseYaw),0,-Math.cos(state.mouseYaw));
  const right=new THREE.Vector3(Math.cos(state.mouseYaw),0,-Math.sin(state.mouseYaw));
  let mx=0,mz=0;
  if(state.keys.KeyW||state.keys.ArrowUp){mx+=forward.x;mz+=forward.z;}
  if(state.keys.KeyS||state.keys.ArrowDown){mx-=forward.x;mz-=forward.z;}
  if(state.keys.KeyD||state.keys.ArrowRight){mx+=right.x;mz+=right.z;}
  if(state.keys.KeyA||state.keys.ArrowLeft){mx-=right.x;mz-=right.z;}
  const moving=Math.abs(mx)+Math.abs(mz)>0;
  if(moving){const l=Math.hypot(mx,mz);mx/=l;mz/=l;}
  const sprint=state.keys.ShiftLeft||state.keys.ShiftRight;
  const speed=sprint?5.4:3.25;
  moveWithCollision(mx*speed*dt,mz*speed*dt);
  const prevY=p.y;
  if(!state.grounded){state.verticalVelocity-=18*dt;p.y+=state.verticalVelocity*dt;if(p.y<=1.7){p.y=1.7;state.verticalVelocity=0;state.grounded=true;}}
  if(state.grounded&&moving){
    state.bob+=dt*(sprint?13:9);
    p.y=1.7+Math.sin(state.bob)*.025;
    if(Math.floor(state.bob*1.6)!==Math.floor((state.bob-dt*(sprint?13:9))*1.6))playFootstep();
  }else if(state.grounded)p.y=THREE.MathUtils.lerp(p.y,1.7,.2);
  state.jumpLock=Math.max(0,state.jumpLock-dt);
  checkTrampolineLanding(prevY);
}
function updateEnemy(dt){
  if(!copy.visible||state.timeline!=="present")return;
  const p=camera.position;
  const toPlayer=new THREE.Vector3(p.x-copy.position.x,0,p.z-copy.position.z);
  const distance=toPlayer.length();
  const facing=new THREE.Vector3(-Math.sin(state.mouseYaw),0,-Math.cos(state.mouseYaw));
  const dir=toPlayer.clone().normalize();
  const looking=facing.dot(dir)>.82;
  const level=state.instability;
  if(state.enemyMode==="watching"){
    if(distance<10&&looking){copy.visible=false;state.enemyLastMove=state.elapsed+3;}
    else if(state.elapsed>state.enemyLastMove){state.enemyMode=level>=3?"stalking":"watching";state.enemyLastMove=state.elapsed+4;}
  }else if(state.enemyMode==="stalking"||state.enemyMode==="following"){
    if(looking&&distance<9){copy.visible=false;state.enemyLastMove=state.elapsed+2.2;}
    else{
      const speed=state.enemyMode==="following"?.75:.35;
      if(!looking||distance>7){copy.position.x+=dir.x*speed*dt;copy.position.z+=dir.z*speed*dt;}
      if(distance<5&&level>=4){state.enemyMode="hunting";state.chase=true;playSting();}
    }
  }else if(state.enemyMode==="hunting"){
    copy.visible=true;
    copy.position.x+=dir.x*2.3*dt;copy.position.z+=dir.z*2.3*dt;
    if(distance<1.45){triggerDeath();}
  }
  copy.rotation.y=Math.atan2(p.x-copy.position.x,p.z-copy.position.z);
  copy.position.y=Math.sin(state.elapsed*4)*.025;
}
function triggerDeath(){
  if(state.death)return;state.death=true;state.chase=false;playSting();
  caption("YOU CAN'T OUTRUN A MEMORY.",2600);
  ui.transition.style.background="#070607";ui.transition.style.transition="opacity 1s";ui.transition.style.opacity="1";
  setTimeout(()=>{
    ui.transition.style.opacity="0";state.death=false;copy.visible=false;state.enemyMode="stalking";
    camera.position.copy(state.lastSafe);camera.position.y=1.7;
    toast("You escaped it. For now.",2200);
  },1500);
}
function updatePastTimer(dt){
  if(state.timeline!=="past"||state.transitioning)return;
  state.pastTime-=dt;
  ui.timer.textContent=`${Math.ceil(Math.max(0,state.pastTime))}<span>s</span>`;
  ui.timer.classList.toggle("urgent",state.pastTime<10);
  if(state.pastTime<30&&Math.random()<dt*.06)glitchPulse();
  if(state.pastTime<15&&Math.random()<dt*.13)playTone(90+Math.random()*40,.08,"sine",.015);
  if(state.pastTime<10&&!state.forcedWarned){state.forcedWarned=true;toast("MEMORY COLLAPSING. FIND A TRAMPOLINE.",3000);playSting();}
  if(state.pastTime<=0){toast("MEMORY EXPIRED.");transitionTimeline("forced");}
}
function updateInstabilityEvents(dt){
  if(state.instability>=2&&state.elapsed>state.randomEventAt){
    state.randomEventAt=state.elapsed+8+Math.random()*8;
    if(state.timeline==="present"&&Math.random()<.45){noiseBurst(.25,.035,600);playTone(210,.18,"sine",.02);}
    if(state.timeline==="past"&&state.instability>=3&&Math.random()<.45)glitchPulse();
  }
  if(state.switches>=7&&state.timeline==="past"&&state.elapsed>state.randomEventAt+3&&!state.transitioning){
    if(Math.random()<dt*.025){toast("THE TIMELINES ARE COLLAPSING.");transitionTimeline("instability");}
  }
}
function updateMemoryActors(dt){
  if(state.timeline!=="past")return;
  const actors=pastGroup.userData.memoryActors||[];
  actors.forEach((actor,i)=>{
    actor.position.y=actor.userData.baseY+Math.abs(Math.sin(state.elapsed*2.2+actor.userData.phase))*.08;
    actor.rotation.y=Math.sin(state.elapsed*.7+i)*.15;
  });
  if(state.switches>=3&&!state.hasMemory1&&Math.floor(state.elapsed/9)%3===1){
    const brother=actors.find(a=>a.userData.role==="brother");
    if(brother){brother.rotation.y=state.mouseYaw+Math.PI; if(Math.random()<dt*.04)subtitle("BROTHER: You're late.",2500);}
  }
  if(state.switches>=5&&Math.floor(state.elapsed/13)%4===2){
    const younger=actors.find(a=>a.userData.role==="youngerSelf");
    if(younger)younger.visible=false;
  }else{actors.forEach(a=>a.visible=true);}
}
function checkProgress(){
  if(state.hasCard&&state.switches===0)updateObjective("Follow the sound of bouncing to the main arena.");
  if(state.switches>=1&&!state.hasMemory1)updateObjective("Explore the past. Find the keychain your brother left behind.");
  if(state.hasMemory1&&!state.hasKey)updateObjective("Return to the present and search the foam-pit storage compartment.");
  if(state.hasKey&&!state.hasPhoto)updateObjective("Enter the birthday room and examine the photograph.");
  if(state.hasPhoto&&!state.hasTape&&!state.hasObservedRecording)updateObjective("Switch to the past. Read the cake code and observe the security monitor.");
  if(state.hasObservedRecording&&!state.hasTape)updateObjective("Return to the present and recover the security recording.");
  if(state.hasTape&&state.finalSequence===0)updateObjective("Return to the main arena. Find the final trampoline.");
  if(state.finalSequence===1)updateObjective("Survive the chase and reach the final trampoline.");
}
function startEnding(which){
  state.gameOver=true;document.exitPointerLock?.();ui.hud.classList.add("hidden");
  ui.ending.classList.remove("hidden");ui.transition.style.opacity="1";ui.transition.style.background="#050608";
  const title=$("ending-title"),copyText=$("ending-copy"),kicker=$("ending-kicker");
  if(which==="run"){
    kicker.textContent="ENDING A · RUN AWAY";title.innerHTML="SOME THINGS<br><em>DON'T STAY BURIED.</em>";
    copyText.textContent="You make it outside. You don't look back. In the driver's seat, your phone rings again. The same unknown number. The same voice. “Can we play one more time?”";
  }else if(which==="secret"){
    kicker.textContent="ENDING C · YOU NEVER LEFT";title.innerHTML="YOU NEVER<br><em>LEFT.</em>";
    copyText.textContent="The front door is gone. Your younger self stands on a trampoline in the empty reception. He turns around. It is you. The bouncing starts again.";
  }else{
    kicker.textContent="ENDING B · THE LAST REBOUND";title.innerHTML="IT'S OKAY.<br><em>YOU CAME BACK.</em>";
    copyText.textContent="You stop running. The Copy's shape softens. For one last moment, you see your brother as he was. You were twelve. You were scared. You came back. “It's okay. You came back.”";
  }
  playTone(which==="secret"?38:180,1.2,"sine",.09);setTimeout(()=>ui.transition.style.opacity="0",1000);
}
function startFinalChoice(){
  state.cutscene=true;document.exitPointerLock?.();
  const choice=document.createElement("div");choice.className="choice-overlay";
  choice.innerHTML=`<div class="choice-card"><div class="eyebrow">THE LAST MEMORY</div><h2>WHAT DO YOU DO?</h2><p>The Copy stands where your brother used to wait for you.</p><button data-choice="stay" class="primary-button">STAY THIS TIME <span>↗</span></button><button data-choice="run" class="secondary-button">RUN FOR THE EXIT</button>${state.hiddenMemory?'<button data-choice="secret" class="secondary-button">FOLLOW YOUR YOUNGER SELF</button>':''}</div>`;
  document.body.appendChild(choice);
  choice.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    const v=b.dataset.choice;choice.remove();state.cutscene=false;
    if(v==="stay")startEnding("accept");else if(v==="run")startEnding("run");else startEnding("secret");
  }));
}
function startFinalSequence(){
  if(state.finalSequence===2)return;
  state.finalSequence=2;state.chase=true;state.enemyMode="hunting";copy.visible=true;state.enemyLastMove=state.elapsed+2;
  playSting();
  updateObjective("Reach the final trampoline and face The Copy.");
  if(!state.cutsceneDone.final){
    state.cutsceneDone.final=true;
    playStoryCutscene("THE LAST MEMORY",[
      {kicker:"THE LAST MEMORY",caption:"The bouncing stops. Every light in the park goes out.",subtitle:"23:47 · SECURITY RECORDING RESTORED",visual:"dark-shot",duration:3500},
      {kicker:"THE FOAM PIT",caption:"You remember the sound. The waterless pit. His hand slipping from yours.",subtitle:"BROTHER: YOU LEFT ME HERE.",visual:"past-shot",duration:4200},
      {kicker:"THE COPY",caption:"Across the arena, something wearing your shape takes one step forward.",subtitle:"DON'T LOOK AWAY.",visual:"copy-shot",duration:3600}
    ],()=>{caption("Reach the final trampoline.",2500);lockPointer();});
  }
}
function updateFinal(dt){
  if(state.finalSequence!==2)return;
  if(state.timeline==="past"&&state.hasTape&&state.hiddenMemory){
    // Secret path gives access to the alternate ending at the final pad.
  }
  const dx=camera.position.x, dz=camera.position.z+7;
  if(Math.hypot(dx,dz)<1.7&&state.finalSequence===2&&state.elapsed>state.enemyLastMove+2){
    state.enemyLastMove=state.elapsed+1000;startFinalChoice();
  }
}
function checkEndingShortcut(){
  if(state.timeline==="present"&&camera.position.z<-23&&state.switches>0&&state.hasTape===false){
    if(state.hasCard){startEnding("run");}
  }
}
function updateChapter(){
  if(state.switches>=1&&state.chapter<2){state.chapter=2;$("chapter-name").textContent="CHAPTER 02 / THE MEMORIES";}
  if(state.hasMemory1&&state.chapter<3){state.chapter=3;$("chapter-name").textContent="CHAPTER 03 / THE FOAM PIT";}
  if(state.hasPhoto&&state.chapter<4){state.chapter=4;$("chapter-name").textContent="CHAPTER 04 / THE TRUTH";}
}
function update(dt){
  if(dust){dust.children.forEach(m=>{m.position.y+=Math.sin(state.elapsed*0.55+m.userData.phase)*dt*0.018;m.position.x+=Math.sin(state.elapsed*.22+m.userData.phase)*dt*.012;});}
  state.elapsed+=dt;
  if(!state.started||state.paused||state.cutscene||state.gameOver)return;
  updatePlayer(dt);updateTrampolines(dt);updatePastTimer(dt);updateInstabilityEvents(dt);checkEndingShortcut();
  updateEnemy(dt);updateMemoryActors(dt);updateInteractPrompt();checkProgress();updateChapter();updateFinal(dt);
  if(state.timeline==="present"&&state.elapsed-state.enemyLastMove>2.5&&state.switches>=2&&!copy.visible&&state.enemyMode!=="hunting"){
    copy.visible=true;copy.position.set(camera.position.x+Math.sin(state.elapsed)*7,0,camera.position.z-8);
    state.enemyLastMove=state.elapsed+4;
  }
  if(state.elapsed%2<dt)state.lastSafe.copy(camera.position);
  // Light flicker and timeline ambience
  if(state.timeline==="present"&&state.instability>=2){
    const flicker=Math.random()<dt*(state.instability*1.2)?0.15:1;
    ambient.intensity=.23*flicker;
  }
  if(state.timeline==="past"&&state.instability>=3&&Math.random()<dt*.04)glitchPulse();
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);
  update(dt);renderer.render(scene,camera);
}
animate();
// Hide the initial loading screen once the game has initialized
ui.loading.classList.add("hidden");

window.addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));
});

// Hook up the staff door and final-pad interaction as invisible trigger volumes.
function triggerVolumes(){
  // The staff doorway sits in the east party wing; use E near its handle.
  const doorTrigger={userData:{type:"door",label:"Unlock the staff door"},position:new THREE.Vector3(13,1.6,20.2)};
  const finalTrigger={userData:{type:"final",label:"Face the final memory"},position:new THREE.Vector3(13,1,18.5)};
  state.extraTriggers=[doorTrigger,finalTrigger];
}
triggerVolumes();
const oldNearest=nearestInteractable;
nearestInteractable=function(){
  const base=oldNearest();
  if(base)return base;
  for(const t of state.extraTriggers||[]){
    const d=camera.position.distanceTo(t.position);
    if(d<2.5){
      if(t.userData.type==="door"&&!state.staffUnlocked)return t;
      if(t.userData.type==="final"&&state.hasTape)return t;
    }
  }
  return null;
};
// Add explicit door/key progression after the first key is recovered.
const originalInteract=interact;
interact=function(){
  if(state.interactable?.userData.type==="door"){
    if(!state.hasKey){toast("The staff door is locked. Find the key in the foam-pit storage compartment.");return;}
    state.staffUnlocked=true;toast("STAFF ACCESS GRANTED.");playClick();return;
  }
  if(state.interactable?.userData.type==="final"){startFinalSequence();return;}
  originalInteract();
};
// Final trampoline is also a physical timeline pad, but only activates final confrontation once story is ready.
const baseTransition=transitionTimeline;
transitionTimeline=function(reason){
  baseTransition(reason);
  if(state.switches>=8&&state.timeline==="present"&&state.hasTape&&state.finalSequence===0)startFinalSequence();
};

// Make the final pad physically bounce into the ending sequence when landed on.
const originalCheck=checkTrampolineLanding;
checkTrampolineLanding=function(prevY){
  originalCheck(prevY);
  if(state.hasTape&&state.finalSequence===2&&Math.abs(camera.position.x)<1.5&&Math.abs(camera.position.z+7)<1.5){
    state.verticalVelocity=8;state.grounded=false;startFinalChoice();
  }
};

// Click-to-start and browser audio unlock.
document.addEventListener("visibilitychange",()=>{if(document.hidden&&state.started&&!state.paused)togglePause(true);});
window.addEventListener("beforeunload",()=>{audio.ctx?.close();});
