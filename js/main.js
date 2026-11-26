/* =========================================================
   PERSPECTIVES — l'expérience 3D
   On avance dans un couloir de photographies.
   Les photos se règlent dans js/photos.js
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
  const BG = new THREE.Color(0x0a0a0b);
  const STEP = 4.4;          // distance entre deux photos
  const CH_GAP = 10;         // espace autour d'un titre de chapitre
  const CAM_START = 6;       // position de départ de la caméra
  const VIEW_DIST = 6.2;     // recul de la caméra devant une photo
  const PHOTO_H = 2.3;       // hauteur standard d'une photo
  const FLOOR_Y = -1.75;     // sol (pour les reflets)
  const LOW_TEX = isTouch ? 900 : 1280;
  const HI_TEX = Math.min(3200, Math.round(Math.max(screen.width, screen.height) * Math.min(devicePixelRatio, 2) * 1.05));
  const PR = Math.min(devicePixelRatio, 1.75);

  /* ---------- 2. Le parcours ---------- */
  const items = [];
  const chapters = [];
  const INTRO_Z = -3;
  let z = -14;
  (typeof CHAPITRES !== "undefined" ? CHAPITRES : []).forEach((ch, ci) => {
    const c = { titre: ch.titre, sousTitre: ch.sousTitre || "", index: ci, z, items: [] };
    chapters.push(c);
    z -= CH_GAP;
    (ch.photos || []).forEach((p) => {
      const it = {
        ...p, chapter: c, index: items.length, z,
        side: items.length % 2 ? 1 : -1,
        ratio: p.w && p.h ? p.w / p.h : 1.5,
        url: (typeof DOSSIER_PHOTOS !== "undefined" ? DOSSIER_PHOTOS : "photos/") + encodeURIComponent(p.f),
        state: null, revealT: 0
      };
      items.push(it);
      c.items.push(it);
      z -= STEP;
    });
    z -= CH_GAP - STEP;
  });
  const END_Z = z - 4;
  const EPI_Z = END_Z - 5.6;       // le panneau « Épilogue », juste devant l'arrivée
  const MAX_S = CAM_START - END_Z;
  const sForZ = (zz, back) => clamp(CAM_START - zz - back, 0, MAX_S);
  items.forEach((it) => (it.s = sForZ(it.z, VIEW_DIST)));
  chapters.forEach((c) => (c.s = sForZ(c.z, 7.5)));

  /* ---------- 3. Scène, caméra, rendu ---------- */
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 9, 34);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 90);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight, false);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const RT = renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget
    ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
  const rt = new RT(innerWidth * PR, innerHeight * PR, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  if (rt.samples !== undefined) rt.samples = 4;

  const uTime = { value: 0 };

  /* Passe finale : vitesse, aberration, vignette, grain */
  const postMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uVel: { value: 0 }, uTime, uRes: { value: new THREE.Vector2(innerWidth * PR, innerHeight * PR) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uVel; uniform float uTime; uniform vec2 uRes;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 uv = 0.5 + c * (1.0 - r2 * uVel * 0.45);
        vec2 off = c * (0.0035 + uVel * 0.035);
        vec3 col = vec3(texture2D(tDiffuse, uv + off).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - off).b);
        vec3 acc = col;
        for (int i = 1; i < 7; i++) {
          float t = float(i) / 7.0 * uVel * 0.07;
          acc += texture2D(tDiffuse, uv - c * t).rgb;
        }
        col = acc / 7.0;
        float vig = smoothstep(0.92, 0.18, length(c * vec2(1.0, 0.92)));
        col *= mix(0.28, 1.0, vig);
        col += (hash(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.055;
        gl_FragColor = vec4(col, 1.0);
      }`,
    depthTest: false, depthWrite: false
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ---------- 4. Les photos (avec reflet) ---------- */
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
    uniform float uReflect; uniform float uDim;
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

      /* cadre fin et coins de visée, avant l'apparition */
      vec2 bd = min(vUv, 1.0 - vUv);
      float m = min(bd.x, bd.y);
      float border = 1.0 - smoothstep(0.0, fwidth(m) * 1.5, m);
      float corner = step(bd.x, 0.06) * step(bd.y, 0.06);
      float line = border * (0.35 + corner * 0.65);
      col = mix(vec3(0.85, 0.83, 0.79), col, vis);

      col *= uDim;
      col = mix(col, uBg, smoothstep(8.0, 32.0, vDepth));
      float alpha = max(vis, line * (1.0 - uReveal * 0.85));
      if (uReflect > 0.5) alpha *= (1.0 - smoothstep(0.0, 0.5, vUv.y)) * 0.13;
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(col, alpha);
    }`;

  const geo = new THREE.PlaneGeometry(1, 1, 40, 40);
  const blank = new THREE.DataTexture(new Uint8Array([14, 14, 15, 255]), 1, 1, THREE.RGBAFormat);
  blank.needsUpdate = true;
  const photoMeshes = [];
  items.forEach((it) => {
    const u = {
      uTex: { value: blank }, uLoaded: { value: 0 }, uReveal: { value: 0 }, uVel: { value: 0 },
      uHover: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime,
      uBg: { value: new THREE.Vector3(BG.r, BG.g, BG.b) }, uReflect: { value: 0 }, uDim: { value: 1 }
    };
    const common = { vertexShader: PHOTO_VERT, fragmentShader: PHOTO_FRAG, transparent: true, extensions: { derivatives: true } };
    it.u = u;
    it.mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...common, uniforms: u }));
    it.refl = new THREE.Mesh(geo, new THREE.ShaderMaterial({ ...common, uniforms: { ...u, uReflect: { value: 1 } }, depthWrite: false, side: THREE.DoubleSide }));
    it.mesh.userData.item = it;
    photoMeshes.push(it.mesh);
    scene.add(it.mesh, it.refl);
  });

  function layout() {
    const narrow = innerWidth / innerHeight < 1;
    items.forEach((it) => {
      let h = narrow ? 1.45 : PHOTO_H;
      let w = h * it.ratio;
      const maxW = narrow ? 1.9 : 4.6, maxH = narrow ? 2.1 : 2.9;
      if (w > maxW) { w = maxW; h = w / it.ratio; }
      if (h > maxH) { h = maxH; w = h * it.ratio; }
      it.w3 = w; it.h3 = h;
      const rot = narrow ? -it.side * 0.14 : -it.side * 0.3;
      const x = narrow ? it.side * 0.62 : it.side * (1.15 + (w / 2) * Math.cos(0.3));
      const y = 0.12 + Math.max(0, h - PHOTO_H) * 0.25;
      it.mesh.position.set(x, y, it.z);
      it.mesh.rotation.set(0, rot, 0);
      it.mesh.scale.set(w, h, 1);
      it.refl.position.set(x, 2 * FLOOR_Y - y, it.z);
      it.refl.rotation.set(0, rot, 0);
      it.refl.scale.set(w, -h, 1);
    });
    const titleScale = narrow ? clamp(innerWidth / innerHeight * 1.25, 0.45, 1) : 1;
    titleMeshes.forEach((m) => m.scale.setScalar(titleScale));
  }

  /* ---------- 5. Titres flottants (dessinés en texte) ---------- */
  const titleMeshes = [];
  function wrapLines(ctx, text, maxW) {
    const out = []; let line = "";
    text.split(/\s+/).forEach((w) => {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    });
    if (line) out.push(line);
    return out;
  }
  function textPlane(lines, w, h, zz, opts = {}) {
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
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    mesh.position.set(0, opts.y !== undefined ? opts.y : 0.3, zz);
    mesh.userData.z = zz;
    mesh.userData.epi = !!opts.epi;
    scene.add(mesh);
    titleMeshes.push(mesh);
  }
  const INK = "rgba(235,231,224,", MONO = '"IBM Plex Mono", monospace', SERIF = '"Cormorant Garamond", serif';
  function buildTitles() {
    textPlane([
      { text: "BENJAMIN H.  —  PHOTOGRAPHIES", font: `300 34px ${MONO}`, color: INK + ".6)", spacing: "14px", y: 300 },
      { text: "Perspectives", font: `italic 300 300px ${SERIF}`, color: INK + "1)", y: 540 },
      { rule: 120, color: INK + ".35)", y: 720 },
      { text: "Une traversée en noir et blanc", font: `300 60px ${SERIF}`, color: INK + ".7)", y: 800 }
    ], 8.6, 4.3, INTRO_Z);
    chapters.forEach((c) => textPlane([
      { text: `CHAPITRE ${ROMAN[c.index] || c.index + 1}`, font: `300 34px ${MONO}`, color: INK + ".6)", spacing: "14px", y: 300 },
      { rule: 90, color: INK + ".35)", y: 350 },
      { text: c.titre, font: `italic 300 240px ${SERIF}`, color: INK + "1)", y: 530 },
      { text: c.sousTitre, font: `300 64px ${SERIF}`, color: INK + ".72)", y: 720 },
      { text: `${pad(c.items.length)} PHOTOGRAPHIES`, font: `300 26px ${MONO}`, color: INK + ".45)", spacing: "10px", y: 830 }
    ], 7.4, 3.7, c.z));
    /* Épilogue : le « À propos » flotte au bout du couloir (mêmes textes que la page) */
    const txt = (s) => ($(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "");
    textPlane([
      { text: "ÉPILOGUE", font: `300 30px ${MONO}`, color: INK + ".6)", spacing: "14px", y: 140 },
      { text: txt(".about__quote"), font: `italic 300 108px ${SERIF}`, color: INK + "1)", y: 290, wrap: 1760, lh: 118 },
      { text: txt(".about__text"), font: `300 36px Inter, sans-serif`, color: INK + ".62)", y: 560, wrap: 1180, lh: 60 },
      { text: txt(".about__mail"), font: `300 80px ${SERIF}`, color: INK + "1)", y: 820 },
      { rule: 160, color: INK + ".4)", y: 872 }
    ], 7.4, 3.7, EPI_Z, { epi: true, y: 0.1 });
    layout();
  }

  /* ---------- 6. Poussière lumineuse ---------- */
  {
    const N = isTouch ? 900 : 2400;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = FLOOR_Y + Math.random() * 6.5;
      pos[i * 3 + 2] = lerp(CAM_START + 22, END_Z - 12, Math.random());
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime, uPR: { value: PR } },
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
        varying float vA;
        void main(){
          float r = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vec3(0.93, 0.91, 0.87), smoothstep(0.5, 0.0, r) * vA * 0.6);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.Points(g, m));
  }

  /* ---------- 7. Lignes de fuite au sol ---------- */
  {
    const v = [];
    const z0 = CAM_START + 30, z1 = END_Z - 30;
    [-4.2, -1.15, 1.15, 4.2].forEach((x) => v.push(x, FLOOR_Y, z0, x, FLOOR_Y, z1));
    for (let zz = z0; zz > z1; zz -= 2.2) {
      v.push(-1.15, FLOOR_Y, zz, -0.95, FLOOR_Y, zz, 0.95, FLOOR_Y, zz, 1.15, FLOOR_Y, zz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x55534f, transparent: true, opacity: 0.55 })));
  }

  /* ---------- 8. Chargement des images ---------- */
  async function decodeScaled(url, maxSide) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const nw = img.naturalWidth, nh = img.naturalHeight;
    const k = Math.min(1, maxSide / Math.max(nw, nh));
    const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
    let src = img;
    if (window.createImageBitmap) {
      try { src = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }); } catch (e) { src = img; }
    }
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, w, h);
    if (src.close) src.close();
    img.src = "";
    return { canvas: cv, ratio: nw / nh };
  }
  function makeTex(cv) {
    const t = new THREE.CanvasTexture(cv);
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.anisotropy = maxAniso;
    return t;
  }

  let active = 0, doneCount = 0;
  const FIRST = Math.min(4, items.length);
  const firstSet = new Set(items.slice(0, FIRST));
  let firstDone = 0;
  function pump() {
    const camZ = CAM_START - current;
    while (active < 2) {
      let best = null, bd = Infinity;
      for (const it of items) {
        if (it.state) continue;
        const d = camZ - it.z;
        const score = d >= -6 ? d : 60 - d;
        if (score < bd) { bd = score; best = it; }
      }
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
      if (Math.abs(r.ratio - it.ratio) > 0.01) { it.ratio = r.ratio; layout(); }
      it.state = "done";
    } catch (e) {
      console.warn("Photo illisible :", it.f, e);
      it.state = "error";
    }
    active--;
    doneCount++;
    if (firstSet.has(it)) firstDone++;
    pump();
  }

  /* ---------- 9. Écran d'entrée ---------- */
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
  ]).then(() => { fontsReady = true; buildTitles(); });

  function tickLoader() {
    const real = ((fontsReady ? 1 : 0) + firstDone) / (FIRST + 1);
    const timeCap = Math.min(1, (performance.now() - t0) / 1800);
    shownPct = lerp(shownPct, Math.min(real, timeCap), 0.06);
    if (real >= 1 && timeCap >= 1 && shownPct > 0.995) shownPct = 1;
    const p = Math.round(shownPct * 100);
    pctEl.textContent = pad(p, 3);
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

  /* ---------- 10. Son d'ambiance (généré, aucun fichier) ---------- */
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
    /* souffle qui accompagne la vitesse */
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = "bandpass"; nf.frequency.value = 500; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0;
    noise.connect(nf); nf.connect(ng); ng.connect(master); noise.start();
    const a = { ctx, master, filter, nf, ng, synth: false, el: null };
    /* ta bande son, ou l'ambiance générée si le fichier est absent */
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

  /* ---------- 11. Navigation ---------- */
  let target = -16, current = -16, prevCurrent = -16, velN = 0, speedFx = 0;
  let mode = "travel"; // travel | focus | index
  let focusItem = null, hovered = null, pendingFocus = null, firstInput = false;
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };

  function addScroll(d) {
    if (!entered || mode === "index") return;
    if (mode === "focus") closeFocus();
    pendingFocus = null;
    target = clamp(target + d, 0, MAX_S);
    if (!firstInput) { firstInput = true; $("#hint").classList.add("is-gone"); }
  }
  addEventListener("wheel", (e) => {
    if (e.target.closest && e.target.closest("#index")) return;
    e.preventDefault();
    let d = e.deltaY || e.deltaX;
    if (e.deltaMode === 1) d *= 33;
    if (e.deltaMode === 2) d *= innerHeight;
    addScroll(d * 0.0085);
  }, { passive: false });

  let touchY = null;
  addEventListener("touchstart", (e) => {
    if (e.target.closest("#index")) return;
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
    if (!entered) return;
    if (e.key === "Escape") { if (mode === "focus") closeFocus(); else if (mode === "index") closeIndex(); return; }
    if (mode === "focus") {
      if (e.key === "ArrowRight") stepFocus(1);
      if (e.key === "ArrowLeft") stepFocus(-1);
      if (["ArrowDown", "ArrowUp", " ", "PageDown", "PageUp"].includes(e.key)) { e.preventDefault(); closeFocus(); }
      return;
    }
    if (mode === "index") return;
    if (["ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); addScroll(STEP); }
    if (["ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); addScroll(-STEP); }
    if (e.key === "Home") target = 0;
    if (e.key === "End") target = MAX_S;
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
    const hits = raycaster.intersectObjects(photoMeshes, false);
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
    focusNum.textContent = `${ROMAN[it.chapter.index] || ""} · ${pad(it.index + 1)} / ${pad(items.length)}`;
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
    openFocus(items[(focusItem.index + d + items.length) % items.length]);
  }
  $("#focusPrev").addEventListener("click", () => stepFocus(-1));
  $("#focusNext").addEventListener("click", () => stepFocus(1));
  $("#focusClose").addEventListener("click", closeFocus);

  /* Index */
  const indexList = $("#indexList");
  const preview = $("#indexPreview");
  const pctx = preview.getContext("2d");
  const prev = { x: 0, y: 0, on: false };
  let delay = 0;
  chapters.forEach((c) => {
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
  function openIndex() {
    if (!entered) return;
    if (mode === "focus") closeFocus();
    mode = "index";
    document.body.classList.add("is-index");
    $("#index").setAttribute("aria-hidden", "false");
  }
  function closeIndex() {
    mode = "travel";
    document.body.classList.remove("is-index");
    $("#index").setAttribute("aria-hidden", "true");
    preview.classList.remove("is-on");
  }
  $("#btnIndex").addEventListener("click", () => (mode === "index" ? closeIndex() : openIndex()));
  $("#indexClose").addEventListener("click", closeIndex);
  $("#btnAbout").addEventListener("click", () => { if (mode === "index") closeIndex(); if (mode === "focus") closeFocus(); target = MAX_S; });
  $("#brand").addEventListener("click", (e) => { e.preventDefault(); if (mode === "index") closeIndex(); if (mode === "focus") closeFocus(); target = 0; });
  $("#restart").addEventListener("click", () => { target = 0; });

  /* Repères de chapitres sur le rail */
  const rail = $("#rail"), railFill = $("#railFill");
  const ticks = chapters.map((c) => {
    const t = document.createElement("i");
    t.className = "rail__tick";
    t.style.top = (c.s / MAX_S) * 100 + "%";
    t.innerHTML = `<span>${ROMAN[c.index] || ""} — ${c.titre}</span>`;
    rail.appendChild(t);
    return t;
  });

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

  /* ---------- 12. Boucle d'animation ---------- */
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

    /* déplacement */
    current = lerp(current, target, f(entered ? 0.065 : 0.02));
    const vel = (current - prevCurrent) / Math.max(dt * 60, 0.001);
    prevCurrent = current;
    velN = lerp(velN, clamp(vel / 0.5, -1, 1), f(0.15));
    speedFx = Math.abs(velN) * motion;
    const camZ = CAM_START - current;

    /* index → aller à une photo puis l'ouvrir */
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

    /* survol des photos */
    let hit = null;
    if (hasMouse && entered && mode === "travel" && !domHover) hit = pick(mouse.x, mouse.y);
    hovered = hit ? hit.it : null;
    if (hit) hit.it.u.uMouse.value.lerp(hit.uv, f(0.2));

    /* photos */
    for (const it of items) {
      const u = it.u;
      const ahead = camera.position.z - it.z;
      const has = it.lowTex || it.hiTex ? 1 : 0;
      u.uLoaded.value = lerp(u.uLoaded.value, has, f(0.08));
      if (has && ahead < 24 && ahead > -6) it.revealT = 1;
      if (it === focusItem) it.revealT = 1;
      if (it.revealT) u.uReveal.value = Math.min(1, u.uReveal.value + dt * 0.55);
      u.uVel.value = velN * 0.6 * motion;
      u.uHover.value = lerp(u.uHover.value, it === hovered ? 1 : 0, f(0.08));
      u.uDim.value = lerp(u.uDim.value, mode === "focus" && it !== focusItem ? 0.14 : 1, f(0.06));
    }

    /* titres flottants (l'épilogue apparaît de loin, puis laisse place au vrai texte) */
    const atEnd = entered && mode === "travel" && current > MAX_S - 0.6;
    for (const m of titleMeshes) {
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
    chapters.forEach((c, i) => { if (current >= c.s - 1) ci = i; });
    if (ci !== lastChapter) {
      lastChapter = ci;
      nowChapter.textContent = ci < 0 ? "Prologue" : `Chapitre ${ROMAN[ci]} — ${chapters[ci].titre}`;
      ticks.forEach((t, i) => t.classList.toggle("is-active", i === ci));
    }
    let near = null, nd = Infinity;
    for (const it of items) { const d = Math.abs(it.s - current); if (d < nd) { nd = d; near = it; } }
    if (atEnd) setNowTitle("Épilogue");
    else if (near && nd < STEP * 0.8) setNowTitle(near.titre || "");
    else setNowTitle(ci < 0 ? "Perspectives" : chapters[ci].sousTitre || chapters[ci].titre);
    railFill.style.transform = `scaleY(${clamp(current / MAX_S, 0, 1)})`;
    const zv = -camZ;
    coordZ.textContent = (zv < 0 ? "−" : "+") + Math.abs(zv).toFixed(1).padStart(6, "0");
    coordPct.textContent = pad(Math.round(clamp(current / MAX_S, 0, 1) * 100), 3);

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
      const t = audio.ctx.currentTime;
      const fq = audio.synth ? 480 + speedFx * 2600 : mode === "focus" || mode === "index" ? 1800 : 18000;
      audio.filter.frequency.setTargetAtTime(fq, t, audio.synth ? 0.15 : 0.6);
      audio.ng.gain.setTargetAtTime(speedFx * 0.22, t, 0.12);
      audio.nf.frequency.setTargetAtTime(400 + speedFx * 1800, t, 0.15);
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
    layout();
  }
  addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);

  /* Petit accès pour les tests automatiques */
  window.__perspectives = {
    enter: () => { ready = true; enter(false); },
    go: (s) => { target = clamp(s, 0, MAX_S); },
    jump: (s) => { target = current = prevCurrent = clamp(s, 0, MAX_S); camera.position.set(0, 0, CAM_START - current); },
    focus: (i) => openFocus(items[i]),
    index: openIndex,
    info: () => ({ MAX_S, current, loaded: doneCount, total: items.length, errors: items.filter((i) => i.state === "error").map((i) => i.f) }),
    items, chapters
  };
})();
