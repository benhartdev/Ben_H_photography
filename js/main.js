/* =========================================================
   PERSPECTIVES — l'expérience 3D, en plusieurs univers
   - « couloir » : on avance dans une galerie de photographies
   - « ecrin »   : des objets d'art en lévitation, sous projecteur
   Les photos et les univers se règlent dans js/photos.js
   ========================================================= */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const hasMouse = matchMedia("(pointer: fine)").matches;
  const isTouch = matchMedia("(pointer: coarse)").matches;
  const motion = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.3 : 1;

  /* ---------- Coordonnées : reconstituées ici pour ne pas apparaître en clair dans la page ---------- */
  {
    const m = ["ben", "hoffele", "photographe"].join(".") + String.fromCharCode(64) + ["outlook", "fr"].join(".");
    const t = ["06", "68", "10", "52", "51"];
    document.querySelectorAll('[data-contact="mail"]').forEach((a) => { a.href = "mailto:" + m; a.textContent = m; });
    document.querySelectorAll('[data-contact="tel"]').forEach((a) => { a.href = "tel:+33" + t.join("").slice(1); a.textContent = t.join(" "); });
  }

  function notice(title, html) {
    $("#noticeTitle").textContent = title;
    $("#noticeText").innerHTML = html;
    $("#notice").hidden = false;
    $("#loader").style.display = "none";
  }

  /* ---------- 0. Vérifications ---------- */
  if (location.protocol === "file:") {
    notice("Ce site s'ouvre avec un petit serveur",
      `Les effets 3D ne fonctionnent pas en ouvrant le fichier directement.<br>
       Dans Git Bash, à la racine du projet, lance :
       <code>python -m http.server 8000</code>
       puis ouvre dans ton navigateur :
       <code>http://localhost:8000</code>`);
    return;
  }
  if (typeof THREE === "undefined") {
    notice("La bibliothèque 3D n'a pas pu se charger", "Vérifie ta connexion internet, puis recharge la page.");
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $("#gl"), antialias: false, powerPreference: "high-performance" });
  } catch (e) {
    notice("Ton navigateur ne peut pas afficher la 3D", "Essaie avec une version récente de Chrome, Edge ou Firefox.");
    return;
  }

  /* ---------- 1. Réglages ---------- */
  const CAM_START = 6;       // position de départ de la caméra dans un univers
  const FLY_IN = 16;         // recul de la caméra à l'arrivée dans un univers
  const FLOOR_Y = -1.75;     // sol (pour les reflets)
  const LOW_TEX = isTouch ? 900 : 1280;
  const HI_TEX = Math.min(3200, Math.round(Math.max(screen.width, screen.height) * Math.min(devicePixelRatio, 2) * 1.05));
  const PR = Math.min(devicePixelRatio, 1.75);

  const STYLES = {
    couloir: {
      bg: 0x0a0a0b, step: 4.4, chGap: 10, view: 6.2, fog: [9, 34],
      ink: "rgba(235,231,224,", accent: "rgba(235,231,224,", dust: [0.93, 0.91, 0.87], dustCount: 2400
    },
    ecrin: {
      bg: 0x06070b, step: 6.4, chGap: 11, view: 5.2, fog: [8, 31],
      ink: "rgba(238,233,224,", accent: "rgba(214,188,136,", dust: [0.72, 0.78, 1.0], dustCount: 1600
    }
  };

  /* ---------- 2. Scène, caméra, rendu ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STYLES.couloir.bg);
  scene.fog = new THREE.Fog(STYLES.couloir.bg, 9, 34);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 90);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight, false);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const RT = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
    ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
  const rt = new RT(innerWidth * PR, innerHeight * PR, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  if (rt.samples !== undefined) rt.samples = 4;

  const uTime = { value: 0 };

  /* Passe finale : vitesse, téléportation, aberration, vignette, grain */
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: rt.texture }, uVel: { value: 0 }, uWarp: { value: 0 }, uTime,
      uRes: { value: new THREE.Vector2(innerWidth * PR, innerHeight * PR) }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uVel; uniform float uWarp; uniform float uTime; uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        float sp = uVel + uWarp * 1.6;
        vec2 uv = 0.5 + c * (1.0 - r2 * sp * 0.45);
        vec2 off = c * (0.0035 + sp * 0.035);
        vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
        vec3 acc = col;
        for (int i = 1; i < 10; i++) {
          float t = float(i) / 10.0 * (uVel * 0.07 + uWarp * 0.42);
          acc += texture2D(tDiffuse, uv - c * t).rgb;
        }
        col = acc / 10.0;
        col += uWarp * uWarp * 0.35 * vec3(0.85, 0.9, 1.0) * (1.0 - smoothstep(0.0, 0.5, length(c)));
        col *= 1.0 - smoothstep(0.7, 1.0, uWarp) * 0.92;
        float vig = smoothstep(1.0, 0.3, length(c * vec2(1.0, 0.92)));
        col *= mix(0.5, 1.0, vig);
        /* tramage invisible (1/255) : évite les « marches » dans les dégradés sombres, sans grain visible */
        col += (hash(vUv * uRes) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ---------- 3. Shaders des photos ---------- */
  const PHOTO_VERT = `
    uniform float uVel; uniform float uHover; uniform vec2 uMouse;
    varying vec2 vUv; varying float vDepth;
    void main(){
      vUv = uv;
      vec3 p = position;
      p.z += sin(uv.x * 3.14159265) * uVel * 0.55;
      p.z += (1.0 - smoothstep(0.0, 0.6, distance(uv, uMouse))) * uHover * 0.08;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const PHOTO_FRAG = `
    uniform sampler2D uTex; uniform float uLoaded; uniform float uReveal; uniform float uVel;
    uniform float uHover; uniform vec2 uMouse; uniform float uTime; uniform vec3 uBg;
    uniform float uReflect; uniform float uDim; uniform float uMask; uniform vec2 uFog;
    varying vec2 vUv; varying float vDepth;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    void main(){
      vec2 uv = vUv;
      vec2 toM = uv - uMouse; float d = length(toM);
      float ripple = sin(d * 42.0 - uTime * 4.0) * 0.0045 * uHover * (1.0 - smoothstep(0.0, 0.5, d));
      uv += (d > 0.0001 ? toM / d : vec2(0.0)) * ripple;
      uv = (uv - 0.5) * (1.0 - 0.035 * uHover) + 0.5;
      float s = uVel * 0.025;
      vec3 tex = vec3(texture2D(uTex, uv + vec2(s, 0.0)).r, texture2D(uTex, uv).g, texture2D(uTex, uv - vec2(s, 0.0)).b);
      vec3 ph = vec3(0.05) + 0.03 * noise(vUv * 5.0 + uTime * 0.3);
      vec3 col = mix(ph, tex, uLoaded);

      /* apparition : dissolution lumineuse */
      float n = noise(vUv * 7.0 + 3.0) * 0.65 + noise(vUv * 31.0) * 0.35;
      float r = uReveal * 1.25 - 0.12;
      float vis = smoothstep(n - 0.015, n + 0.015, r);
      float e = r - n;
      float edge = smoothstep(0.0, 0.03, e) * (1.0 - smoothstep(0.03, 0.11, e));
      col += vec3(0.95, 0.93, 0.88) * edge * (1.0 - uReveal) * 1.6;

      /* cadre fin et coins de visée (couloir), bords fondus dans le noir (écrin) */
      vec2 bd = min(vUv, 1.0 - vUv);
      float m = min(bd.x, bd.y);
      float border = 1.0 - smoothstep(0.0, fwidth(m) * 1.5, m);
      float corner = step(bd.x, 0.06) * step(bd.y, 0.06);
      float line = border * (0.35 + corner * 0.65) * (1.0 - uMask);
      col = mix(vec3(0.85, 0.83, 0.79), col, vis);

      col *= uDim;
      col = mix(col, uBg, smoothstep(uFog.x - 1.0, uFog.y - 2.0, vDepth));
      float alpha = max(vis, line * (1.0 - uReveal * 0.85));
      float soft = smoothstep(0.0, 0.22, bd.x) * smoothstep(0.0, 0.22, bd.y);
      alpha *= mix(1.0, soft, uMask);
      if (uReflect > 0.5) alpha *= (1.0 - smoothstep(0.0, 0.5, vUv.y)) * mix(0.13, 0.2, uMask);
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(col, alpha);
    }`;

  /* Faisceau de projecteur, flaque de lumière, halo (univers écrin) */
  const BEAM_VERT = `
    varying vec3 vN; varying vec3 vView; varying float vH; varying float vDepth;
    void main(){
      vH = uv.y;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      vN = normalize(normalMatrix * normal);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;
  const BEAM_FRAG = `
    uniform vec3 uColor; uniform float uInt; uniform float uTime;
    varying vec3 vN; varying vec3 vView; varying float vH; varying float vDepth;
    void main(){
      float facing = abs(dot(vN, vView));
      float a = pow(facing, 3.0) * (0.35 + 0.65 * vH) * uInt;
      a *= smoothstep(0.0, 0.35, vH) * (1.0 - smoothstep(0.62, 0.95, vH));
      a *= (1.0 - smoothstep(12.0, 30.0, vDepth)) * smoothstep(0.4, 2.5, vDepth);
      a *= 0.9 + 0.1 * sin(uTime * 1.6 + vH * 11.0);
      gl_FragColor = vec4(uColor, a * 0.03);
    }`;
  const GLOW_VERT = `
    varying vec2 vUv; varying float vDepth;
    void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
  const GLOW_FRAG = `
    uniform vec3 uColor; uniform float uInt; uniform float uPow;
    varying vec2 vUv; varying float vDepth;
    void main(){
      float r = length(vUv - 0.5) * 2.0;
      float a = pow(1.0 - smoothstep(0.0, 1.0, r), uPow) * uInt;
      a *= 1.0 - smoothstep(12.0, 30.0, vDepth);
      gl_FragColor = vec4(uColor, a);
    }`;

  const geo = new THREE.PlaneGeometry(1, 1, 40, 40);
  const quad = new THREE.PlaneGeometry(1, 1);
  const beamGeo = new THREE.CylinderGeometry(0.06, 1, 1, 48, 1, true);
  beamGeo.translate(0, 0.5, 0);
  const poolGeo = new THREE.CircleGeometry(0.5, 48);
  const blank = new THREE.DataTexture(new Uint8Array([14, 14, 15, 255]), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;

  /* ---------- 4. Construction des univers ---------- */
  const CFG = typeof UNIVERS !== "undefined" && UNIVERS.length ? UNIVERS : [{
    nom: "Perspectives", accroche: "Photographies", sousTitre: "Une traversée en noir et blanc", style: "couloir",
    dossier: typeof DOSSIER_PHOTOS !== "undefined" ? DOSSIER_PHOTOS : "photos/",
    chapitres: typeof CHAPITRES !== "undefined" ? CHAPITRES : []
  }];

  function buildWorld(cfg, wi) {
    const st = STYLES[cfg.style] || STYLES.couloir;
    const ecrin = cfg.style === "ecrin";
    const w = {
      cfg, st, ecrin, index: wi, nom: cfg.nom || `Univers ${wi + 1}`, sousTitre: cfg.sousTitre || "",
      accroche: cfg.accroche || "", items: [], chapters: [], titleMeshes: [], photoMeshes: [],
      group: new THREE.Group(), bg: new THREE.Color(st.bg)
    };
    let z = -14;
    (cfg.chapitres || []).forEach((ch, ci) => {
      const c = { titre: ch.titre, sousTitre: ch.sousTitre || "", index: ci, z, items: [], world: w };
      w.chapters.push(c);
      z -= st.chGap;
      (ch.photos || []).forEach((p) => {
        const it = {
          ...p, chapter: c, world: w, index: w.items.length, z,
          side: w.items.length % 2 ? 1 : -1,
          ratio: p.w && p.h ? p.w / p.h : 1.5,
          url: (cfg.dossier || "photos/") + encodeURIComponent(p.f),
          state: null, revealT: 0, phase: Math.random() * 6.28
        };
        w.items.push(it);
        c.items.push(it);
        z -= st.step;
      });
      z -= st.chGap - st.step;
    });
    w.END_Z = z - 4;
    w.EPI_Z = w.END_Z - 5.6;
    w.MAX_S = CAM_START - w.END_Z;
    const sFor = (zz, back) => clamp(CAM_START - zz - back, 0, w.MAX_S);
    w.items.forEach((it) => (it.s = sFor(it.z, st.view)));
    w.chapters.forEach((c) => (c.s = sFor(c.z, 7.5)));

    /* photos + reflets */
    w.items.forEach((it) => {
      const u = {
        uTex: { value: blank }, uLoaded: { value: 0 }, uReveal: { value: 0 }, uVel: { value: 0 },
        uHover: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime,
        uBg: { value: new THREE.Vector3(w.bg.r, w.bg.g, w.bg.b) }, uReflect: { value: 0 }, uDim: { value: 1 },
        uMask: { value: ecrin ? 1 : 0 }, uFog: { value: new THREE.Vector2(st.fog[0], st.fog[1]) }
      };
      const common = { vertexShader: PHOTO_VERT, fragmentShader: PHOTO_FRAG, transparent: true, extensions: { derivatives: true } };
      it.u = u;
      it.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...common, uniforms: u }));
      it.refl = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...common, uniforms: { ...u, uReflect: { value: 1 } }, depthWrite: false, side: THREE.DoubleSide }));
      it.mesh.userData.item = it;
      w.photoMeshes.push(it.mesh);
      w.group.add(it.mesh, it.refl);

      if (ecrin) {
        it.light = { value: 0 };
        const beamMat = new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(0.86, 0.9, 1.0) }, uInt: it.light, uTime },
          vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        it.beam = new THREE.Mesh(beamGeo, beamMat);
        const glowMat = (color, power, k) => new THREE.ShaderMaterial({
          uniforms: { uColor: { value: color }, uInt: { value: 0 }, uPow: { value: power } },
          vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, userData: { k }
        });
        it.pool = new THREE.Mesh(poolGeo, glowMat(new THREE.Color(0.78, 0.84, 1.0), 2.0, 0.28));
        it.pool.rotation.x = -Math.PI / 2;
        it.halo = new THREE.Mesh(quad, glowMat(new THREE.Color(0.35, 0.45, 0.95), 2.6, 0.11));
        it.halo.renderOrder = -1;
        w.group.add(it.beam, it.pool, it.halo);
      }
    });

    /* poussière lumineuse */
    {
      const N = Math.round((isTouch ? 0.4 : 1) * st.dustCount);
      const pos = new Float32Array(N * 3), seed = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 1] = FLOOR_Y + Math.random() * 6.5;
        pos[i * 3 + 2] = lerp(CAM_START + FLY_IN + 8, w.END_Z - 12, Math.random());
        seed[i] = Math.random();
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime, uPR: { value: PR }, uColor: { value: new THREE.Vector3(...st.dust) } },
        vertexShader: `
          uniform float uTime; uniform float uPR; attribute float aSeed; varying float vA;
          void main(){
            vec3 p = position;
            p.y += sin(uTime * 0.2 + aSeed * 6.283) * 0.18;
            p.x += cos(uTime * 0.13 + aSeed * 12.0) * 0.14;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float d = -mv.z;
            gl_PointSize = (1.0 + aSeed * 2.4) * uPR * (12.0 / max(d, 0.5));
            vA = (0.3 + 0.7 * fract(aSeed * 7.31)) * (1.0 - smoothstep(10.0, 30.0, d)) * smoothstep(0.3, 2.0, d)
               * (0.55 + 0.45 * sin(uTime * 1.3 + aSeed * 40.0));
          }`,
        fragmentShader: `
          uniform vec3 uColor; varying float vA;
          void main(){
            float r = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, r) * vA * 0.6);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      w.group.add(new THREE.Points(g, m));
    }

    /* lignes de fuite au sol (couloir) */
    if (!ecrin) {
      const v = [];
      const z0 = CAM_START + FLY_IN + 14, z1 = w.END_Z - 30;
      [-4.2, -1.15, 1.15, 4.2].forEach((x) => v.push(x, FLOOR_Y, z0, x, FLOOR_Y, z1));
      for (let zz = z0; zz > z1; zz -= 2.2) v.push(-1.15, FLOOR_Y, zz, -0.95, FLOOR_Y, zz, 0.95, FLOOR_Y, zz, 1.15, FLOOR_Y, zz);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      w.group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x55534f, transparent: true, opacity: 0.55 })));
    }

    w.group.visible = false;
    scene.add(w.group);
    return w;
  }

  const worlds = CFG.map(buildWorld);
  let W = worlds[0];
  W.group.visible = true;

  function layoutWorld(w) {
    const narrow = innerWidth / innerHeight < 1;
    w.items.forEach((it) => {
      let h, wd, x, rot, y;
      if (w.ecrin) {
        h = narrow ? 1.5 : 2.4;
        wd = h * it.ratio;
        const maxW = narrow ? 1.9 : 3.4, maxH = narrow ? 2.0 : 2.8;
        if (wd > maxW) { wd = maxW; h = wd / it.ratio; }
        if (h > maxH) { h = maxH; wd = h * it.ratio; }
        x = narrow ? it.side * 0.5 : it.side * (0.6 + wd / 2);
        rot = narrow ? -it.side * 0.08 : -it.side * 0.18;
        y = 0.3;
      } else {
        h = narrow ? 1.45 : 2.3;
        wd = h * it.ratio;
        const maxW = narrow ? 1.9 : 4.6, maxH = narrow ? 2.1 : 2.9;
        if (wd > maxW) { wd = maxW; h = wd / it.ratio; }
        if (h > maxH) { h = maxH; wd = h * it.ratio; }
        rot = narrow ? -it.side * 0.14 : -it.side * 0.3;
        x = narrow ? it.side * 0.62 : it.side * (1.15 + (wd / 2) * Math.cos(0.3));
        y = 0.12 + Math.max(0, h - 2.3) * 0.25;
      }
      it.w3 = wd; it.h3 = h; it.baseY = y; it.baseRot = rot;
      it.mesh.position.set(x, y, it.z);
      it.mesh.rotation.set(0, rot, 0);
      it.mesh.scale.set(wd, h, 1);
      it.refl.position.set(x, 2 * FLOOR_Y - y, it.z);
      it.refl.rotation.set(0, rot, 0);
      it.refl.scale.set(wd, -h, 1);
      if (w.ecrin) {
        const top = 4.6, rad = Math.max(wd, h) * 0.62;
        it.beam.position.set(x, FLOOR_Y, it.z);
        it.beam.scale.set(rad, top - FLOOR_Y, rad);
        it.pool.position.set(x, FLOOR_Y + 0.01, it.z);
        it.pool.scale.setScalar(rad * 2.4);
        it.halo.position.set(x, y, it.z - 0.08);
        it.halo.rotation.set(0, rot, 0);
        it.halo.scale.set(wd * 1.7, h * 1.7, 1);
      }
    });
    const titleScale = narrow ? clamp((innerWidth / innerHeight) * 1.25, 0.45, 1) : 1;
    w.titleMeshes.forEach((m) => m.scale.setScalar(titleScale));
  }

  /* ---------- 5. Titres flottants (dessinés en texte) ---------- */
  function wrapLines(ctx, text, maxW) {
    const out = []; let line = "";
    text.split(/\s+/).forEach((wd) => {
      const test = line ? line + " " + wd : wd;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test;
    });
    if (line) out.push(line);
    return out;
  }
  function textPlane(w, lines, wd, h, zz, opts = {}) {
    const cv = document.createElement("canvas");
    cv.width = 2048; cv.height = 1024;
    const ctx = cv.getContext("2d");
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    lines.forEach((l) => {
      if (l.rule) { ctx.fillStyle = l.color; ctx.fillRect(1024 - l.rule / 2, l.y, l.rule, 2); return; }
      ctx.font = l.font; ctx.fillStyle = l.color;
      if ("letterSpacing" in ctx) ctx.letterSpacing = l.spacing || "0px";
      if (l.wrap) wrapLines(ctx, l.text, l.wrap).forEach((t, i) => ctx.fillText(t, 1024, l.y + i * l.lh));
      else ctx.fillText(l.text, 1024, l.y);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = maxAniso;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wd, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    mesh.position.set(0, opts.y !== undefined ? opts.y : 0.3, zz);
    mesh.userData.z = zz;
    mesh.userData.epi = !!opts.epi;
    w.group.add(mesh);
    w.titleMeshes.push(mesh);
  }
  const MONO = '"IBM Plex Mono", monospace', SERIF = '"Cormorant Garamond", serif';
  function buildTitles(w) {
    const I = w.st.ink, A = w.st.accent;
    textPlane(w, [
      { text: `BENJAMIN HOFFELÉ  —  ${(w.accroche || "").toUpperCase()}`, font: `300 34px ${MONO}`, color: A + ".7)", spacing: "14px", y: 300 },
      { text: w.nom, font: `italic 300 300px ${SERIF}`, color: I + "1)", y: 540 },
      { rule: 120, color: A + ".45)", y: 720 },
      { text: w.sousTitre, font: `300 60px ${SERIF}`, color: I + ".7)", y: 800 }
    ], 8.6, 4.3, -3);
    w.chapters.forEach((c) => textPlane(w, [
      { text: `CHAPITRE ${ROMAN[c.index] || c.index + 1}`, font: `300 34px ${MONO}`, color: A + ".7)", spacing: "14px", y: 300 },
      { rule: 90, color: A + ".45)", y: 350 },
      { text: c.titre, font: `italic 300 240px ${SERIF}`, color: I + "1)", y: 530 },
      { text: c.sousTitre, font: `300 64px ${SERIF}`, color: I + ".72)", y: 720 },
      { text: `${pad(c.items.length)} ${w.ecrin ? "ŒUVRES" : "PHOTOGRAPHIES"}`, font: `300 26px ${MONO}`, color: A + ".55)", spacing: "10px", y: 830 }
    ], 7.4, 3.7, c.z));
    const txt = (s) => ($(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "");
    textPlane(w, [
      { text: "ÉPILOGUE", font: `300 30px ${MONO}`, color: A + ".7)", spacing: "14px", y: 140 },
      { text: txt(".about__quote"), font: `italic 300 108px ${SERIF}`, color: I + "1)", y: 290, wrap: 1760, lh: 118 },
      { text: txt(".about__text"), font: `300 36px Inter, sans-serif`, color: I + ".62)", y: 560, wrap: 1180, lh: 60 },
      { text: txt(".about__mail"), font: `300 72px ${SERIF}`, color: I + "1)", y: 800 },
      { text: txt(".about__tel"), font: `300 34px ${MONO}`, color: I + ".6)", spacing: "10px", y: 880 },
      { rule: 160, color: A + ".5)", y: 930 }
    ], 7.4, 3.7, w.EPI_Z, { epi: true, y: 0.1 });
    layoutWorld(w);
  }

  /* ---------- 6. Chargement des images ---------- */
  async function decodeScaled(url, maxSide) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const k = Math.min(1, maxSide / Math.max(nw, nh));
    const wd = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
    let src = img;
    if (window.createImageBitmap) {
      try { src = await createImageBitmap(img, { resizeWidth: wd, resizeHeight: h, resizeQuality: "high" }); } catch (e) { src = img; }
    }
    const cv = document.createElement("canvas");
    cv.width = wd; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, wd, h);
    if (src.close) src.close();
    img.src = "";
    return { canvas: cv, ratio: nw / nh };
  }
  function makeTex(cv) {
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = maxAniso;
    /* envoi immédiat à la carte graphique : évite les à-coups quand l'image entre dans le champ */
    if (renderer.initTexture) renderer.initTexture(t);
    return t;
  }

  let active = 0, doneCount = 0;
  const totalCount = worlds.reduce((n, w) => n + w.items.length, 0);
  const FIRST = Math.min(4, worlds[0].items.length);
  const firstSet = new Set(worlds[0].items.slice(0, FIRST));
  let firstDone = 0;
  function pump() {
    while (active < 2) {
      const camZ = CAM_START - current;
      let best = null, bd = Infinity;
      for (const it of W.items) {
        if (it.state) continue;
        const d = camZ - it.z;
        const score = d >= -6 ? d : 60 - d;
        if (score < bd) { bd = score; best = it; }
      }
      if (!best) for (const w of worlds) { if (w === W) continue; best = w.items.find((it) => !it.state); if (best) break; }
      if (!best) return;
      loadItem(best);
    }
  }
  async function loadItem(it) {
    it.state = "loading";
    active++;
    try {
      const r = await decodeScaled(it.url, LOW_TEX);
      it.lowTex = makeTex(r.canvas);
      if (!it.hiTex) it.u.uTex.value = it.lowTex;
      const th = document.createElement("canvas");
      const k = 520 / Math.max(r.canvas.width, r.canvas.height);
      th.width = Math.round(r.canvas.width * k); th.height = Math.round(r.canvas.height * k);
      th.getContext("2d").drawImage(r.canvas, 0, 0, th.width, th.height);
      it.thumb = th;
      if (Math.abs(r.ratio - it.ratio) > 0.01) { it.ratio = r.ratio; layoutWorld(it.world); }
      it.state = "done";
    } catch (e) {
      console.warn("Photo illisible :", it.url, e);
      it.state = "error";
    }
    active--;
    doneCount++;
    if (firstSet.has(it)) firstDone++;
    pump();
  }

  /* ---------- 7. Écran d'entrée ---------- */
  const loaderEl = $("#loader");
  const ringFg = $("#ringFg");
  const pctEl = $("#loaderPct");
  const subEl = $("#loaderSub");
  let fontsReady = false, ready = false, entered = false, shownPct = 0;
  const t0 = performance.now();
  Promise.race([
    Promise.all([
      document.fonts.load(`italic 300 100px "Cormorant Garamond"`),
      document.fonts.load(`300 100px "Cormorant Garamond"`),
      document.fonts.load(`300 20px "IBM Plex Mono"`)
    ]),
    new Promise((r) => setTimeout(r, 4000))
  ]).then(() => { fontsReady = true; worlds.forEach(buildTitles); });

  function tickLoader() {
    const real = ((fontsReady ? 1 : 0) + firstDone) / (FIRST + 1);
    const timeCap = Math.min(1, (performance.now() - t0) / 1800);
    shownPct = lerp(shownPct, Math.min(real, timeCap), 0.06);
    if (real >= 1 && timeCap >= 1 && shownPct > 0.995) shownPct = 1;
    pctEl.textContent = pad(Math.round(shownPct * 100), 3);
    ringFg.style.strokeDashoffset = 603.2 * (1 - shownPct);
    if (!ready && (shownPct >= 1 || performance.now() - t0 > 30000)) {
      ready = true;
      loaderEl.classList.add("is-ready");
      subEl.textContent = "Prêt";
    }
  }
  function enter(withSound) {
    if (entered || !ready) return;
    entered = true;
    document.body.classList.add("is-entered");
    document.body.classList.remove("is-loading");
    if (withSound) setSound(true);
    target = 0;
  }
  $("#enterSound").addEventListener("click", () => enter(true));
  $("#enterSilent").addEventListener("click", () => enter(false));

  /* ---------- 8. Son (bande son personnelle ou ambiance générée) ---------- */
  let audio = null, soundOn = false;
  const MUSIC_URL = typeof MUSIQUE !== "undefined" && MUSIQUE ? encodeURI(MUSIQUE) : "";
  function startSynth(a) {
    if (a.synth) return;
    a.synth = true;
    const { ctx, filter } = a;
    filter.frequency.value = 520;
    [55, 82.41, 110, 164.81, 220.5, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? "sine" : "triangle"; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 10;
      const g = ctx.createGain(); g.gain.value = 0.16 / (i + 1);
      const l = ctx.createOscillator(); l.frequency.value = 0.04 + i * 0.027;
      const lg = ctx.createGain(); lg.gain.value = 0.07 / (i + 1);
      l.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(filter); o.start(); l.start();
    });
    if (soundOn) a.master.gain.setTargetAtTime(0.32, ctx.currentTime, 1.2);
  }
  function buildAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 18000; filter.Q.value = 0.6;
    filter.connect(master);
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 500; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0;
    noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start();
    const a = { ctx, master, filter, nf, ng, synth: false, el: null };
    if (MUSIC_URL) {
      const el = new Audio();
      el.loop = true;
      el.preload = "auto";
      el.src = MUSIC_URL;
      ctx.createMediaElementSource(el).connect(filter);
      el.addEventListener("error", () => { a.el = null; startSynth(a); }, { once: true });
      a.el = el;
    } else startSynth(a);
    return a;
  }
  function setSound(on) {
    soundOn = on;
    $("#btnSound").setAttribute("aria-pressed", String(on));
    $("#soundLabel").textContent = on ? "Son" : "Muet";
    if (on && !audio) audio = buildAudio();
    if (!audio) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    if (on) {
      audio.ctx.resume();
      if (audio.el) audio.el.play().catch(() => { audio.el = null; startSynth(audio); });
      audio.master.gain.setTargetAtTime(audio.synth ? 0.32 : 0.85, now, 1.2);
    } else {
      audio.master.gain.setTargetAtTime(0, now, 0.3);
      if (audio.el) setTimeout(() => { if (!soundOn && audio.el) audio.el.pause(); }, 1500);
    }
  }
  function chime() {
    if (!audio || !soundOn) return;
    const { ctx, master } = audio, t = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 / (i + 1), t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 2.3);
    });
  }
  $("#btnSound").addEventListener("click", () => setSound(!soundOn));
  $("#soundLabel").textContent = "Muet";

  /* ---------- 9. Navigation ---------- */
  let target = -FLY_IN, current = -FLY_IN, prevCurrent = -FLY_IN, velN = 0, speedFx = 0;
  let mode = "travel"; // travel | focus | index | worlds | warp
  let focusItem = null, hovered = null, pendingFocus = null, firstInput = false;
  const warp = { active: false, t: 0, to: null, switched: false, fx: 0 };
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };

  function addScroll(d) {
    if (!entered || mode === "index" || mode === "worlds" || mode === "warp") return;
    if (mode === "focus") closeFocus();
    pendingFocus = null;
    target = clamp(target + d, 0, W.MAX_S);
    if (!firstInput) { firstInput = true; $("#hint").classList.add("is-gone"); }
  }
  const inOverlay = (el) => el && el.closest && el.closest("#index, #worlds");
  addEventListener("wheel", (e) => {
    if (inOverlay(e.target)) return;
    e.preventDefault();
    let d = e.deltaY || e.deltaX;
    if (e.deltaMode === 1) d *= 33;
    if (e.deltaMode === 2) d *= innerHeight;
    addScroll(d * 0.0085);
  }, { passive: false });

  let touchY = null;
  addEventListener("touchstart", (e) => {
    if (inOverlay(e.target)) return;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (touchY === null) return;
    const y = e.touches[0].clientY;
    addScroll((touchY - y) * 0.03);
    touchY = y;
  }, { passive: true });
  addEventListener("touchend", () => { touchY = null; });

  addEventListener("keydown", (e) => {
    if (!entered || mode === "warp") return;
    if (e.key === "Escape") {
      if (mode === "focus") closeFocus(); else if (mode === "index") closeIndex(); else if (mode === "worlds") closeWorlds();
      return;
    }
    if (mode === "focus") {
      if (e.key === "ArrowRight") stepFocus(1);
      if (e.key === "ArrowLeft") stepFocus(-1);
      if (["ArrowDown", "ArrowUp", " ", "PageDown", "PageUp"].includes(e.key)) { e.preventDefault(); closeFocus(); }
      return;
    }
    if (mode !== "travel") return;
    if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); addScroll(W.st.step); }
    if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); addScroll(-W.st.step); }
    if (e.key === "Home") target = 0;
    if (e.key === "End") target = W.MAX_S;
  });

  addEventListener("mousemove", (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = (e.clientX / innerWidth) * 2 - 1;
    mouse.ny = -((e.clientY / innerHeight) * 2 - 1);
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(W.photoMeshes, false);
    for (const h of hits) {
      const it = h.object.userData.item;
      if (it.u.uReveal.value > 0.4 && camera.position.z - it.z < 26) return { it, uv: h.uv };
    }
    return null;
  }
  $("#gl").addEventListener("click", (e) => {
    if (!entered) return;
    if (mode === "focus") { closeFocus(); return; }
    if (mode !== "travel") return;
    const p = pick(e.clientX, e.clientY);
    if (p) openFocus(p.it);
  });

  /* Photo ouverte */
  const focusNum = $("#focusNum"), focusTitle = $("#focusTitle"), focusMeta = $("#focusMeta");
  let dropTimer = null;
  async function loadHi(it) {
    if (it.hiTex || it.hiLoading) return;
    it.hiLoading = true;
    try {
      const r = await decodeScaled(it.url, HI_TEX);
      if (focusItem === it) { it.hiTex = makeTex(r.canvas); it.u.uTex.value = it.hiTex; }
    } catch (e) { /* on garde la version légère */ }
    it.hiLoading = false;
  }
  function dropHi(it) {
    if (!it || !it.hiTex) return;
    const t = it.hiTex; it.hiTex = null;
    it.u.uTex.value = it.lowTex || blank;
    t.dispose();
  }
  function openFocus(it) {
    if (focusItem && focusItem !== it) dropHi(focusItem);
    clearTimeout(dropTimer);
    mode = "focus";
    focusItem = it;
    hovered = null;
    target = it.s;
    document.body.classList.add("is-focus");
    focusNum.textContent = `${W.nom} · ${ROMAN[it.chapter.index] || ""} · ${pad(it.index + 1)} / ${pad(W.items.length)}`;
    focusTitle.textContent = it.titre || "";
    focusMeta.textContent = [it.lieu, it.annee, it.chapter.titre].filter(Boolean).join("  ·  ");
    loadHi(it);
    chime();
  }
  function closeFocus() {
    if (mode !== "focus") return;
    const it = focusItem;
    mode = "travel";
    focusItem = null;
    document.body.classList.remove("is-focus");
    dropTimer = setTimeout(() => dropHi(it), 1500);
  }
  function stepFocus(d) {
    if (!focusItem) return;
    openFocus(W.items[(focusItem.index + d + W.items.length) % W.items.length]);
  }
  $("#focusPrev").addEventListener("click", () => stepFocus(-1));
  $("#focusNext").addEventListener("click", () => stepFocus(1));
  $("#focusClose").addEventListener("click", closeFocus);

  /* Index (de l'univers en cours) */
  const indexList = $("#indexList");
  const preview = $("#indexPreview");
  const pctx = preview.getContext("2d");
  const prev = { x: 0, y: 0, on: false };
  function buildIndex() {
    indexList.innerHTML = "";
    $(".index__kicker").textContent = `Index — ${W.nom}`;
    let delay = 0;
    W.chapters.forEach((c) => {
      const box = document.createElement("div");
      box.className = "index__chapter";
      box.innerHTML = `<h3><em>${ROMAN[c.index] || c.index + 1}</em>${c.titre}<span style="margin-left:auto">${pad(c.items.length)}</span></h3>`;
      c.items.forEach((it) => {
        const b = document.createElement("button");
        b.className = "index__item";
        b.style.setProperty("--d", (0.15 + (delay++) * 0.018).toFixed(3) + "s");
        b.innerHTML = `<span>${it.titre || ""}</span><small>${pad(it.index + 1)}</small>`;
        b.dataset.cursor = "Y aller";
        b.addEventListener("mouseenter", () => {
          if (!it.thumb) { prev.on = false; preview.classList.remove("is-on"); return; }
          preview.width = it.thumb.width; preview.height = it.thumb.height;
          pctx.drawImage(it.thumb, 0, 0);
          prev.on = true; preview.classList.add("is-on");
        });
        b.addEventListener("mouseleave", () => { prev.on = false; preview.classList.remove("is-on"); });
        b.addEventListener("click", () => { closeIndex(); target = it.s; pendingFocus = it; });
        box.appendChild(b);
      });
      indexList.appendChild(box);
    });
  }
  function openIndex() {
    if (!entered || mode === "warp") return;
    if (mode === "focus") closeFocus();
    if (mode === "worlds") closeWorlds();
    mode = "index";
    document.body.classList.add("is-index");
    $("#index").setAttribute("aria-hidden", "false");
  }
  function closeIndex() {
    if (mode !== "index") return;
    mode = "travel";
    document.body.classList.remove("is-index");
    $("#index").setAttribute("aria-hidden", "true");
    preview.classList.remove("is-on");
  }

  /* Choix de l'univers */
  const worldsList = $("#worldsList"), worldsBg = $("#worldsBg");
  function buildWorldsMenu() {
    worldsList.innerHTML = "";
    worlds.forEach((w, i) => {
      const b = document.createElement("button");
      b.className = "world";
      b.style.setProperty("--d", (0.25 + i * 0.12) + "s");
      b.dataset.cursor = w === W ? "Vous êtes ici" : "Voyager";
      b.innerHTML = `
        <span class="world__num">${ROMAN[i]} — ${w.accroche}</span>
        <span class="world__name">${w.nom}</span>
        <span class="world__sub">${w.sousTitre}</span>
        <span class="world__meta ${w === W ? "world__here" : ""}">${w === W ? "● Vous êtes ici" : `${pad(w.items.length)} ${w.ecrin ? "œuvres" : "photographies"}`}</span>`;
      b.addEventListener("mouseenter", () => {
        const it = w.items.find((x) => x.thumb);
        if (!it) return;
        if (!it.thumbUrl) it.thumbUrl = it.thumb.toDataURL("image/jpeg", 0.8);
        worldsBg.style.backgroundImage = `url("${it.thumbUrl}")`;
        worldsBg.classList.add("is-on");
      });
      b.addEventListener("mouseleave", () => worldsBg.classList.remove("is-on"));
      b.addEventListener("click", () => { if (w === W) closeWorlds(); else teleport(w); });
      worldsList.appendChild(b);
    });
  }
  function openWorlds() {
    if (!entered || mode === "warp") return;
    if (mode === "focus") closeFocus();
    if (mode === "index") closeIndex();
    buildWorldsMenu();
    mode = "worlds";
    document.body.classList.add("is-worlds");
    $("#worlds").setAttribute("aria-hidden", "false");
  }
  function closeWorlds() {
    if (mode !== "worlds") return;
    mode = "travel";
    document.body.classList.remove("is-worlds");
    $("#worlds").setAttribute("aria-hidden", "true");
    worldsBg.classList.remove("is-on");
  }

  /* Téléportation d'un univers à l'autre */
  function whoosh() {
    if (!audio || !soundOn) return;
    const { ctx, ng, nf } = audio, t = ctx.currentTime;
    ng.gain.cancelScheduledValues(t);
    ng.gain.setValueAtTime(ng.gain.value, t);
    ng.gain.linearRampToValueAtTime(0.5, t + 0.8);
    ng.gain.linearRampToValueAtTime(0.0, t + 2.6);
    nf.frequency.cancelScheduledValues(t);
    nf.frequency.setValueAtTime(300, t);
    nf.frequency.exponentialRampToValueAtTime(3800, t + 0.85);
    nf.frequency.exponentialRampToValueAtTime(250, t + 2.6);
  }
  function teleport(w) {
    if (warp.active || w === W) return;
    closeWorlds();
    if (mode === "focus") closeFocus();
    if (mode === "index") closeIndex();
    mode = "warp";
    document.body.classList.add("is-warp");
    Object.assign(warp, { active: true, t: 0, to: w, switched: false });
    pendingFocus = null;
    whoosh();
  }
  function switchWorld(w) {
    W.group.visible = false;
    W = w;
    W.group.visible = true;
    scene.background.copy(W.bg);
    scene.fog.color.copy(W.bg);
    scene.fog.near = W.st.fog[0];
    scene.fog.far = W.st.fog[1];
    target = 0;
    current = prevCurrent = -FLY_IN;
    camera.position.set(0, 0, CAM_START + FLY_IN);
    W.items.forEach((it) => { it.revealT = 0; it.u.uReveal.value = 0; });
    lastChapter = -2; lastTitle = "";
    buildRail();
    buildIndex();
    updateAboutNext();
    layoutWorld(W);
  }

  /* Rail des chapitres */
  const rail = $("#rail"), railFill = $("#railFill");
  let ticks = [];
  function buildRail() {
    ticks.forEach((t) => t.remove());
    ticks = W.chapters.map((c) => {
      const t = document.createElement("i");
      t.className = "rail__tick";
      t.style.top = (c.s / W.MAX_S) * 100 + "%";
      t.innerHTML = `<span>${ROMAN[c.index] || ""} — ${c.titre}</span>`;
      rail.appendChild(t);
      return t;
    });
  }

  /* Fin de parcours : proposer l'univers suivant */
  const aboutNext = $("#aboutNext");
  function updateAboutNext() {
    const next = worlds.length > 1 ? worlds[(W.index + 1) % worlds.length] : null;
    aboutNext.textContent = next ? `Voyager vers ${next.nom} →` : "";
    aboutNext.onclick = next ? () => teleport(next) : null;
  }

  $("#btnIndex").addEventListener("click", () => (mode === "index" ? closeIndex() : openIndex()));
  $("#indexClose").addEventListener("click", closeIndex);
  $("#btnWorlds").addEventListener("click", () => (mode === "worlds" ? closeWorlds() : openWorlds()));
  $("#worldsClose").addEventListener("click", closeWorlds);
  const leaveOverlays = () => { if (mode === "index") closeIndex(); if (mode === "worlds") closeWorlds(); if (mode === "focus") closeFocus(); };
  $("#btnAbout").addEventListener("click", () => { if (mode === "warp") return; leaveOverlays(); target = W.MAX_S; });
  $("#brand").addEventListener("click", (e) => { e.preventDefault(); if (mode === "warp") return; leaveOverlays(); target = 0; });
  $("#restart").addEventListener("click", () => { target = 0; });

  /* Curseur */
  const cursor = $("#cursor"), cursorLabel = $("#cursorLabel");
  const cur = { x: mouse.x, y: mouse.y };
  let domHover = null;
  if (hasMouse) {
    document.documentElement.classList.add("has-cursor");
    document.addEventListener("mouseover", (e) => {
      domHover = e.target.closest && e.target.closest("[data-cursor], button, a");
    });
  }

  /* ---------- 10. Boucle d'animation ---------- */
  const nowChapter = $("#nowChapter"), nowTitle = $("#nowTitle"), coordZ = $("#coordZ"), coordPct = $("#coordPct");
  let lastTitle = "", lastChapter = -2;
  const camTargetPos = new THREE.Vector3(), camTargetQuat = new THREE.Quaternion();
  const euler = new THREE.Euler(), tmpN = new THREE.Vector3();
  camera.position.set(0, 0, CAM_START - current);
  let last = performance.now();

  function setNowTitle(t) {
    if (t === lastTitle) return;
    lastTitle = t;
    nowTitle.classList.add("is-swap");
    setTimeout(() => { nowTitle.textContent = t; nowTitle.classList.remove("is-swap"); }, 250);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const f = (k) => 1 - Math.pow(1 - k, dt * 60);
    uTime.value += dt;

    if (!ready) tickLoader();
    pump();

    /* téléportation */
    if (warp.active) {
      warp.t += dt;
      const T1 = 0.95, T2 = 1.7;
      if (warp.t < T1) {
        const k = warp.t / T1;
        warp.fx = k * k;
        target = Math.min(W.MAX_S + 30, target + dt * 40 * k);
      } else {
        if (!warp.switched) { warp.switched = true; switchWorld(warp.to); }
        const k = clamp((warp.t - T1) / T2, 0, 1);
        warp.fx = 1 - k * k * (3 - 2 * k);
        if (warp.t > T1 + T2) {
          warp.active = false; warp.fx = 0; mode = "travel";
          document.body.classList.remove("is-warp");
        }
      }
    }
    postMat.uniforms.uWarp.value = warp.fx * motion;

    /* déplacement */
    current = lerp(current, target, f(entered ? 0.065 : 0.02));
    const vel = (current - prevCurrent) / Math.max(dt * 60, 0.001);
    prevCurrent = current;
    velN = lerp(velN, clamp(vel / 0.5, -1, 1), f(0.15));
    speedFx = Math.abs(velN) * motion;
    const camZ = CAM_START - current;

    if (pendingFocus && Math.abs(current - target) < 0.2) { openFocus(pendingFocus); pendingFocus = null; }

    /* caméra */
    if (mode === "focus" && focusItem) {
      const m = focusItem.mesh;
      const tf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const dist = Math.max((focusItem.h3 / 2) / tf, (focusItem.w3 / 2) / (tf * camera.aspect)) * 1.22;
      tmpN.set(0, 0, 1).applyQuaternion(m.quaternion);
      camTargetPos.copy(m.position).addScaledVector(tmpN, dist);
      camTargetPos.y -= focusItem.h3 * 0.05;
      camTargetQuat.copy(m.quaternion);
    } else {
      camTargetPos.set(mouse.nx * 0.35, mouse.ny * 0.16, camZ);
      euler.set(mouse.ny * 0.045, -mouse.nx * 0.075, -velN * 0.02 * motion);
      camTargetQuat.setFromEuler(euler);
    }
    const ck = mode === "focus" ? f(0.07) : f(0.14);
    camera.position.lerp(camTargetPos, ck);
    camera.quaternion.slerp(camTargetQuat, ck);

    /* survol */
    let hit = null;
    if (hasMouse && entered && mode === "travel" && !domHover) hit = pick(mouse.x, mouse.y);
    hovered = hit ? hit.it : null;
    if (hit) hit.it.u.uMouse.value.lerp(hit.uv, f(0.2));

    /* objets de l'univers en cours */
    const t = uTime.value;
    for (const it of W.items) {
      const u = it.u;
      const ahead = camera.position.z - it.z;
      const has = it.lowTex || it.hiTex ? 1 : 0;
      u.uLoaded.value = lerp(u.uLoaded.value, has, f(0.08));
      if (has && ahead < 24 && ahead > -6) it.revealT = 1;
      if (it === focusItem) it.revealT = 1;
      if (it.revealT) u.uReveal.value = Math.min(1, u.uReveal.value + dt * 0.55);
      u.uVel.value = velN * 0.6 * motion;
      u.uHover.value = lerp(u.uHover.value, it === hovered ? 1 : 0, f(0.08));
      const dim = mode === "focus" && it !== focusItem ? 0.14 : 1;
      u.uDim.value = lerp(u.uDim.value, dim, f(0.06));
      if (W.ecrin) {
        /* lévitation douce */
        const y = it.baseY + Math.sin(t * 0.55 + it.phase) * 0.06;
        const ry = it.baseRot + Math.sin(t * 0.32 + it.phase) * 0.04;
        if (it !== focusItem) {
          it.mesh.position.y = y; it.mesh.rotation.y = ry;
          it.refl.position.y = 2 * FLOOR_Y - y; it.refl.rotation.y = ry;
          it.halo.position.y = y; it.halo.rotation.y = ry;
        }
        /* le projecteur s'allume quand l'œuvre apparaît */
        const on = smooth(0.1, 0.9, u.uReveal.value) * (mode === "focus" && it !== focusItem ? 0.15 : 1);
        it.light.value = lerp(it.light.value, on, f(0.05));
        it.pool.material.uniforms.uInt.value = it.light.value * it.pool.material.userData.k;
        it.halo.material.uniforms.uInt.value = it.light.value * it.halo.material.userData.k * (1 + u.uHover.value * 0.35);
        /* on ne dessine la lumière que pour les œuvres allumées et pas trop loin */
        const lit = it.light.value > 0.01 && ahead < 32 && ahead > -4;
        it.beam.visible = it.pool.visible = it.halo.visible = lit;
      }
    }

    /* titres flottants */
    const atEnd = entered && mode === "travel" && current > W.MAX_S - 0.6;
    for (const m of W.titleMeshes) {
      const d = camera.position.z - m.userData.z;
      let op = m.userData.epi
        ? (1 - smooth(22, 36, d)) * (atEnd ? 0 : 1)
        : smooth(0.6, 4, d) * (1 - smooth(16, 30, d));
      if (mode === "focus") op *= 0.1;
      m.material.opacity = lerp(m.material.opacity, op, f(m.userData.epi && atEnd ? 0.05 : 0.2));
    }

    /* interface */
    document.body.classList.toggle("is-about", atEnd);
    $("#about").setAttribute("aria-hidden", String(!atEnd));
    let ci = -1;
    W.chapters.forEach((c, i) => { if (current >= c.s - 1) ci = i; });
    if (ci !== lastChapter) {
      lastChapter = ci;
      nowChapter.textContent = ci < 0 ? `${W.nom} — Prologue` : `${W.nom} · ${ROMAN[ci]} — ${W.chapters[ci].titre}`;
      ticks.forEach((tk, i) => tk.classList.toggle("is-active", i === ci));
    }
    let near = null, nd = Infinity;
    for (const it of W.items) { const d = Math.abs(it.s - current); if (d < nd) { nd = d; near = it; } }
    if (atEnd) setNowTitle("Épilogue");
    else if (near && nd < W.st.step * 0.8) setNowTitle(near.titre || "");
    else setNowTitle(ci < 0 ? W.nom : W.chapters[ci].sousTitre || W.chapters[ci].titre);
    railFill.style.transform = `scaleY(${clamp(current / W.MAX_S, 0, 1)})`;
    const zv = -camZ;
    coordZ.textContent = (zv < 0 ? "−" : "+") + Math.abs(zv).toFixed(1).padStart(6, "0");
    coordPct.textContent = pad(Math.round(clamp(current / W.MAX_S, 0, 1) * 100), 3);

    /* curseur */
    if (hasMouse) {
      cur.x = lerp(cur.x, mouse.x, f(0.25));
      cur.y = lerp(cur.y, mouse.y, f(0.25));
      cursor.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
      const label = hovered ? "Ouvrir" : mode === "focus" && !domHover ? "Revenir" : domHover ? domHover.dataset.cursor || "" : "";
      cursor.classList.toggle("is-hover", !!(hovered || domHover));
      if (cursorLabel.textContent !== label) cursorLabel.textContent = label;
      if (prev.on) {
        prev.x = lerp(prev.x, mouse.x + 40, f(0.12));
        prev.y = lerp(prev.y, mouse.y - preview.offsetHeight / 2, f(0.12));
        preview.style.transform = `translate3d(${prev.x}px, ${prev.y}px, 0) rotate(${clamp((mouse.x + 40 - prev.x) * 0.02, -6, 6)}deg)`;
      }
    }

    /* son */
    if (audio && soundOn) {
      const ta = audio.ctx.currentTime;
      const fq = audio.synth ? 480 + speedFx * 2600 : mode === "focus" || mode === "index" || mode === "worlds" ? 1800 : 18000;
      audio.filter.frequency.setTargetAtTime(fq, ta, audio.synth ? 0.15 : 0.6);
      if (!warp.active) {
        audio.ng.gain.setTargetAtTime(speedFx * 0.22, ta, 0.12);
        audio.nf.frequency.setTargetAtTime(400 + speedFx * 1800, ta, 0.15);
      }
    }

    /* rendu */
    postMat.uniforms.uVel.value = speedFx;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
    requestAnimationFrame(frame);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? 62 : 50;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    rt.setSize(innerWidth * PR, innerHeight * PR);
    postMat.uniforms.uRes.value.set(innerWidth * PR, innerHeight * PR);
    worlds.forEach(layoutWorld);
  }
  addEventListener("resize", resize);
  buildRail();
  buildIndex();
  updateAboutNext();
  resize();
  requestAnimationFrame(frame);

  /* Petit accès pour les tests automatiques */
  window.__perspectives = {
    enter: () => { ready = true; enter(false); },
    go: (s) => { target = clamp(s, 0, W.MAX_S); },
    jump: (s) => { target = current = prevCurrent = clamp(s, 0, W.MAX_S); camera.position.set(0, 0, CAM_START - current); },
    focus: (i) => openFocus(W.items[i]),
    index: openIndex,
    worlds: openWorlds,
    teleport: (i) => teleport(worlds[i]),
    world: (i) => { switchWorld(worlds[i]); },
    info: () => ({ world: W.nom, MAX_S: W.MAX_S, current, mode, loaded: doneCount, total: totalCount, errors: worlds.flatMap((w) => w.items.filter((i) => i.state === "error").map((i) => i.url)) }),
    get items() { return W.items; },
    get chapters() { return W.chapters; }
  };
})();
