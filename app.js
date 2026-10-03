'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let database, world, globeView;
  const extras = {CV:[-23.6,15.1],KM:[43.3,-11.7],NR:[166.9,-.5],XA:[40.8,43.1],XO:[44.25,42.3]};
  const tooltip=$('globe-tooltip'), canvas=$('globe'), dialog=$('country-dialog');
  const flag = iso => ['XA','XO'].includes(iso) ? '◉' : String.fromCodePoint(...[...iso].map(c => 127397+c.charCodeAt(0)));
  const plural = n => n%10===1 && n%100!==11 ? 'факт помощи' : n%10>=2 && n%10<=4 && !(n%100>=12&&n%100<=14) ? 'факта помощи' : 'фактов помощи';
  const byISO = new Map();
  function setPaused(value){
    paused=value; document.body.classList.toggle('motion-paused',paused);
    $('rotation-toggle').setAttribute('aria-pressed',String(paused));
    $('rotation-toggle').title=paused?'Продолжить анимацию':'Приостановить анимацию';
    $('rotation-label').textContent=paused?'Вращать':'Пауза';
    $('rotation-icon').textContent=paused?'▷':'Ⅱ';
  }
  setPaused(paused);
  $('rotation-toggle').addEventListener('click',()=>setPaused(!paused));
  reduced.addEventListener('change',e=>setPaused(e.matches));
  // Content stays readable when JavaScript or IntersectionObserver is unavailable.
  if ('IntersectionObserver' in window && !reduced.matches){
    const reveal = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pending');reveal.unobserve(e.target);}}),{threshold:.1});
    document.querySelectorAll('.reveal').forEach(el=>{el.classList.add('pending');reveal.observe(el);});
  }
  function playVideo(){
    const player=$('video-player');
    if(!player.querySelector('iframe')){
      const iframe=document.createElement('iframe');
      iframe.src='https://rutube.ru/play/embed/a71faa2a7500ad71acf6b9a4d0b67de0/?t=5847&stopTime=6375&autoStart=true';
      iframe.title='Презентация Гуманитарной карты на форуме Россия — Африка';
      iframe.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      iframe.allowFullscreen=true;
      player.replaceChildren(iframe);
    }
    $('play-fragment').textContent='Фрагмент открыт';
  }
  $('play-video').addEventListener('click',playVideo);
  $('play-fragment').addEventListener('click',playVideo);
  function showCountry(iso='KG'){
    if(!database)return;
    $('country-select').value=iso;
    renderCountry();
    if(!dialog.open)dialog.showModal();
  }
  $('explore').addEventListener('click',()=>showCountry());
  $('close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  $('country-select').addEventListener('change',()=>{renderCountry();globeView?.focus($('country-select').value);});
  function renderCountry(){
    const c=byISO.get($('country-select').value);if(!c)return;
    const rows=[...c.examples].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const target=$('country-detail');target.replaceChildren();
    const heading=document.createElement('div');heading.className='country-heading';
    const icon=document.createElement('span');icon.className='flag';icon.textContent=flag(c.iso);icon.setAttribute('aria-hidden','true');
    const title=document.createElement('h3');title.textContent=c.name;heading.append(icon,title);target.append(heading);
    const count=document.createElement('p');count.className='country-count';
    const strong=document.createElement('strong');strong.textContent=rows.length;count.append(strong,document.createTextNode(plural(rows.length)));target.append(count);
    rows.slice(0,5).forEach(e=>{
      const fact=document.createElement('article');fact.className='fact';
      const date=document.createElement('time');date.textContent=e.date?new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(new Date(e.date+'T12:00:00')):'Дата требует уточнения';if(e.date)date.dateTime=e.date;
      const p=document.createElement('p');p.textContent=e.text;fact.append(date,p);
      if(e.source){try{const url=new URL(e.source);if(['https:','http:'].includes(url.protocol)){const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Источник · '+url.hostname.replace(/^www\./,'');fact.append(a);}}catch{}}
      target.append(fact);
    });
  }
  function showTooltip(iso,event){
    const c=byISO.get(iso);if(!c){tooltip.hidden=true;return;}
    tooltip.textContent=flag(iso)+' '+c.name+' · '+c.count+' '+plural(c.count);
    const b=canvas.getBoundingClientRect();tooltip.hidden=false;
    tooltip.style.left=Math.max(8,Math.min(event.clientX-b.left+12,b.width-tooltip.offsetWidth-8))+'px';
    tooltip.style.top=Math.max(8,event.clientY-b.top-44)+'px';
  }
  function textureCanvas(pulseMask=false){
    const tex=document.createElement('canvas');tex.width=2048;tex.height=1024;
    const ctx=tex.getContext('2d');const projection=d3.geoEquirectangular().translate([1024,512]).scale(2048/(2*Math.PI));const path=d3.geoPath(projection,ctx);
    world.features.forEach(f=>{
      ctx.beginPath();path(f);
      const iso=f.properties.iso;const present=byISO.has(iso);
      if(pulseMask){
        if(present){ctx.fillStyle=pulseColor(iso);ctx.fill();}
        return;
      }
      if(present){
        const hue=174+(iso.charCodeAt(0)*13+iso.charCodeAt(1)*7)%47;
        const gradient=ctx.createLinearGradient(0,200,2048,850);gradient.addColorStop(0,`hsla(${hue+10},95%,55%,.54)`);gradient.addColorStop(.5,`hsla(${hue},94%,45%,.62)`);gradient.addColorStop(1,`hsla(${hue-20},90%,53%,.48)`);ctx.fillStyle=gradient;ctx.fill();
      }else{ctx.fillStyle='rgba(12,49,77,.18)';ctx.fill();}
    });
    Object.entries(extras).forEach(([iso,coord])=>{const [x,y]=projection(coord);ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=pulseMask?pulseColor(iso):'#8cffe0';ctx.fill();});
    return tex;
  }
  function pulseSeed(iso){return (iso.charCodeAt(0)*47+iso.charCodeAt(1)*83)%251;}
  function pulseColor(iso){const seed=pulseSeed(iso);return `rgb(${seed},${(seed*37)%255},255)`;}
  function create3D(){
    const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;
    const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.z=5.7;
    const globe=new THREE.Group();scene.add(globe);globe.rotation.x=.22;globe.rotation.y=-Math.PI/2-25*Math.PI/180;
    const geometry=new THREE.SphereGeometry(1.8,96,64);
    const baseMat=new THREE.MeshPhongMaterial({color:0x9ebacb,shininess:8,specular:0x18475c,emissive:0x142a40,emissiveIntensity:.55});
    const earth=new THREE.Mesh(geometry,baseMat);globe.add(earth);
    new THREE.TextureLoader().load('./assets/earth-night.jpg',tex=>{tex.colorSpace=THREE.SRGBColorSpace;baseMat.map=tex;baseMat.emissiveMap=tex;baseMat.emissiveIntensity=.9;baseMat.needsUpdate=true;},undefined,()=>{});
    const map=new THREE.CanvasTexture(textureCanvas());map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    // Each country carries its own phase and tempo, so the glow breathes independently.
    const pulseMap=new THREE.CanvasTexture(textureCanvas(true));
    const pulseTime={value:0};
    const overlayMat=new THREE.MeshBasicMaterial({map,transparent:true,opacity:.9,depthWrite:false});
    overlayMat.onBeforeCompile=shader=>{
      shader.uniforms.pulseMap={value:pulseMap};shader.uniforms.pulseTime=pulseTime;
      shader.fragmentShader='uniform sampler2D pulseMap;\nuniform float pulseTime;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec4 region = texture2D(pulseMap, vMapUv);
        if (region.b > 0.5) {
          float wave = 0.5 + 0.5 * sin(pulseTime * (0.8 + region.g * 0.5) + region.r * 6.283185);
          float breath = smoothstep(0.05, 0.95, wave);
          diffuseColor.rgb *= mix(0.55, 1.65, breath);
          diffuseColor.a *= mix(0.38, 1.0, breath);
        }
      `);
    };
    const overlay=new THREE.Mesh(new THREE.SphereGeometry(1.804,96,64),overlayMat);globe.add(overlay);
    const atmosphereMat=new THREE.ShaderMaterial({uniforms:{glow:{value:new THREE.Color(0x3dc9ff)}},vertexShader:'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.0); vPosition=p.xyz; gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 glow; varying vec3 vNormal; varying vec3 vPosition; void main(){float rim=pow(1.0-max(0.0,dot(normalize(vNormal),normalize(-vPosition))),4.5); gl_FragColor=vec4(glow,rim*0.45);}',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.845,96,64),atmosphereMat));
    scene.add(new THREE.AmbientLight(0x6a9dbb,1.7));const sun=new THREE.DirectionalLight(0xaadfff,3);sun.position.set(-3,4,5);scene.add(sun);
    const raycaster=new THREE.Raycaster();const mouse=new THREE.Vector2();
    function at(e){const b=canvas.getBoundingClientRect();mouse.set((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObject(earth)[0];if(!hit)return null;const ll=[hit.uv.x*360-180,hit.uv.y*180-90];for(const [iso,coord] of Object.entries(extras)){if(d3.geoDistance(ll,coord)<.025)return iso;}return world.features.find(f=>byISO.has(f.properties.iso)&&d3.geoContains(f,ll))?.properties.iso;}
    let down=null,moved=false;
    canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY};moved=false;canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      if(down){const dx=e.clientX-down.lastX,dy=e.clientY-down.lastY;if(Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)>5)moved=true;if(e.pointerType!=='touch'||Math.abs(e.clientX-down.x)>Math.abs(e.clientY-down.y)){globe.rotation.y+=dx*.004;globe.rotation.x=Math.max(-1.15,Math.min(1.15,globe.rotation.x+dy*.003));}down.lastX=e.clientX;down.lastY=e.clientY;tooltip.hidden=true;}
      else showTooltip(at(e),e);
    });
    canvas.addEventListener('pointerup',e=>{if(down&&!moved){const iso=at(e);if(iso)showCountry(iso);}down=null;});
    canvas.addEventListener('pointercancel',()=>{down=null;});canvas.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
    let size=0;new ResizeObserver(()=>{const n=canvas.clientWidth;if(n===size)return;size=n;renderer.setSize(n,n,false);camera.updateProjectionMatrix();}).observe(canvas);
    let active=true;new IntersectionObserver(entries=>{active=entries[0].isIntersecting;},{rootMargin:'150px'}).observe(canvas);
    let last=0,time=0;
    function frame(stamp){requestAnimationFrame(frame);const dt=Math.min((stamp-last)/1000,.05);last=stamp;if(!active||document.hidden)return;
      if(!paused){time+=dt;pulseTime.value=time;if(!down&&!dialog.open)globe.rotation.y+=dt*.035;}
      renderer.render(scene,camera);
    }
    requestAnimationFrame(frame);
    return{focus(iso){const center=extras[iso]||world.features.find(f=>f.properties.iso===iso)?.properties.center;if(center){globe.rotation.y=-Math.PI/2-center[0]*Math.PI/180;globe.rotation.x=center[1]*Math.PI/180;}},renderer:'webgl'};
  }
  function create2D(){
    // Graceful fallback for browsers where WebGL is disabled.
    const old=canvas;const fallback=old.cloneNode(false);old.replaceWith(fallback);
    const ctx=fallback.getContext('2d');let lon=-25,size=0,time=0,last=0;
    function draw(stamp){requestAnimationFrame(draw);const dt=Math.min((stamp-last)/1000,.05);last=stamp;if(document.hidden)return;if(!paused)time+=dt;const w=fallback.clientWidth;if(w!==size){size=w;fallback.width=w*1.5;fallback.height=w*1.5;}const n=fallback.width;ctx.clearRect(0,0,n,n);const projection=d3.geoOrthographic().translate([n/2,n/2]).scale(n*.41).rotate([lon,-13]);const path=d3.geoPath(projection,ctx);const g=ctx.createRadialGradient(n*.35,n*.25,0,n/2,n/2,n*.43);g.addColorStop(0,'#145075');g.addColorStop(1,'#020c18');ctx.beginPath();path({type:'Sphere'});ctx.fillStyle=g;ctx.fill();world.features.forEach(f=>{ctx.beginPath();path(f);const seed=pulseSeed(f.properties.iso);const breath=.5+.5*Math.sin(time*(.8+((seed*37)%255)/255*.5)+seed/255*Math.PI*2);ctx.fillStyle=byISO.has(f.properties.iso)?`hsl(${183+seed%35},80%,${20+breath*35}%)`:'#163349';ctx.fill();});if(!paused&&!dialog.open)lon+=dt*2;}
    requestAnimationFrame(draw);return{focus(){},renderer:'canvas'};
  }
  Promise.all([fetch('./data.json').then(r=>{if(!r.ok)throw Error('data');return r.json();}),fetch('./world.json').then(r=>{if(!r.ok)throw Error('world');return r.json();})]).then(([data,geo])=>{
    database=data;world=geo;data.countriesData.forEach(c=>{byISO.set(c.iso,c);const option=document.createElement('option');option.value=c.iso;option.textContent=c.name;$('country-select').append(option);});
    try{globeView=create3D();}catch(error){console.warn('WebGL is unavailable; using 2D globe.');globeView=create2D();}
    $('globe-status').hidden=true;document.body.dataset.globeReady=globeView.renderer;
  }).catch(()=>{$('globe-status').textContent='Не удалось загрузить карту. Обновите страницу.';$('explore').textContent='Открыть Гуманитарную карту';$('explore').addEventListener('click',()=>window.open('https://russianassistance.ru/','_blank','noopener'));});
})();
