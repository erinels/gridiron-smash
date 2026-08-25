/* GRIDIRON SMASH - football + wrestling, built with three.js */
(function () {
'use strict';

// ---------------------------------------------------------------- helpers
var $ = function (id) { return document.getElementById(id); };
var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var rand = function (a, b) { return a + Math.random() * (b - a); };
var TAU = Math.PI * 2;

// ---------------------------------------------------------------- audio
var actx = null;
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f0, f1, dur, type, vol) {
  var a = ac(); if (!a) return;
  var o = a.createOscillator(), g = a.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, a.currentTime);
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(vol || 0.14, a.currentTime + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g); g.connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}
function noiseBurst(dur, vol, f0, f1, q) {
  var a = ac(); if (!a) return;
  var len = Math.floor(a.sampleRate * dur);
  var buf = a.createBuffer(1, len, a.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  var src = a.createBufferSource(); src.buffer = buf;
  var flt = a.createBiquadFilter(); flt.type = 'bandpass';
  flt.frequency.setValueAtTime(f0, a.currentTime);
  if (f1) flt.frequency.linearRampToValueAtTime(f1, a.currentTime + dur);
  flt.Q.value = q || 1;
  var g = a.createGain();
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(flt); flt.connect(g); g.connect(a.destination);
  src.start();
}
var SFX = {
  whistle: function () { tone(2100, 2400, 0.16, 'square', 0.09); setTimeout(function () { tone(2300, 2000, 0.2, 'square', 0.09); }, 130); },
  thud:    function () { tone(150, 45, 0.22, 'sine', 0.3); noiseBurst(0.16, 0.28, 300, 90, 0.8); },
  smash:   function () { tone(220, 60, 0.3, 'sawtooth', 0.22); noiseBurst(0.25, 0.35, 900, 120, 0.7); },
  spin:    function () { tone(500, 1100, 0.16, 'triangle', 0.14); },
  punch:   function () { noiseBurst(0.1, 0.3, 1400, 300, 1.2); tone(200, 80, 0.1, 'square', 0.14); },
  slam:    function () { tone(120, 35, 0.5, 'sine', 0.4); noiseBurst(0.45, 0.4, 500, 60, 0.6); },
  kick:    function () { tone(320, 90, 0.18, 'triangle', 0.26); noiseBurst(0.12, 0.2, 1200, 300, 1); },
  catchit: function () { tone(700, 950, 0.1, 'triangle', 0.16); },
  score:   function () { [0, 110, 220, 380].forEach(function (d, i) { setTimeout(function () { tone([523, 659, 784, 1047][i], null, 0.26, 'square', 0.14); }, d); }); },
  cheer:   function () { noiseBurst(1.7, 0.2, 700, 1500, 0.6); noiseBurst(1.7, 0.14, 2400, 1600, 0.5); },
  boo:     function () { tone(180, 90, 0.6, 'sawtooth', 0.13); },
  bell:    function () { tone(880, null, 0.5, 'sine', 0.2); setTimeout(function () { tone(1320, null, 0.6, 'sine', 0.15); }, 90); },
  gong:    function () { tone(110, 55, 1.6, 'sine', 0.32); tone(165, 82, 1.4, 'triangle', 0.16); noiseBurst(1.2, 0.16, 260, 70, 0.7); }
};

// ---------------------------------------------------------------- characters
var CHARS = {
  wrestler: {
    key: 'wrestler', name: 'WRESTLER', desc: 'Strongest guy. Hits the hardest.',
    skin: 0xc98a5e, jersey: 0xc0182f, pants: 0x16161d, shoes: 0xf2ead8, hair: 0x241610,
    helmet: false, headband: true, speed: 0.90, power: 1.40, build: 1.24, num: 1
  },
  soccer: {
    key: 'soccer', name: 'SOCCER PLAYER', desc: 'Super fast. Best kicker.',
    skin: 0xe8b98f, jersey: 0x1f7fd0, pants: 0xf4f4f4, shoes: 0x2ae07d, hair: 0x3d2712,
    helmet: false, headband: false, speed: 1.20, power: 0.80, build: 0.90, num: 10
  },
  football: {
    key: 'football', name: 'FOOTBALL PLAYER', desc: 'Good at everything. Has a helmet.',
    skin: 0x8a5a3b, jersey: 0x2fa832, pants: 0xededed, shoes: 0x14141c, hair: 0x120c08,
    helmet: true, headband: false, speed: 1.02, power: 1.08, build: 1.10, num: 7
  }
};
var CHAR_LIST = ['wrestler', 'soccer', 'football'];

// ------------------------------------------------- wrestling rivals (not playable)
// hp    = how much health the rival has (the player always has 100)
// dmg   = how hard the rival hits the player, 1 = full strength
// agg   = how often the rival attacks, 1 = normal
var RIVALS = {
  rookie: {
    key: 'rookie', name: 'THE ROOKIE', desc: 'New guy. Small and quick.',
    skin: 0xe8b98f, jersey: 0x2fa832, pants: 0x16161d, shoes: 0x14141c, hair: 0xd8a13c,
    helmet: false, headband: false, speed: 1.00, power: 0.72, build: 0.92, num: 2,
    hp: 80, dmg: 0.30, agg: 0.62,
    tip: 'THE ROOKIE is small. Run at him and punch a lot!'
  },
  tigre: {
    key: 'tigre', name: 'EL TIGRE', desc: 'Masked flyer. Very fast.',
    skin: 0xc98a5e, jersey: 0xf07818, pants: 0x16161d, shoes: 0x14141c, hair: 0x241610,
    helmet: true, headband: false, speed: 1.18, power: 0.92, build: 0.98, num: 3,
    hp: 100, dmg: 0.38, agg: 0.82,
    tip: 'EL TIGRE runs fast. Wait for him, then SLAM him!'
  },
  bigrig: {
    key: 'bigrig', name: 'BIG RIG', desc: 'Huge and slow. Big hits.',
    skin: 0xa9713f, jersey: 0x5b6b7d, pants: 0x16161d, shoes: 0x14141c, hair: 0x2b1c10,
    helmet: false, headband: true, speed: 0.70, power: 1.30, build: 1.46, num: 4,
    hp: 125, dmg: 0.44, agg: 0.70,
    tip: 'BIG RIG is slow. Run around him and hit him from behind!'
  },
  viper: {
    key: 'viper', name: 'THE VIPER', desc: 'Sneaky. Hits very fast.',
    skin: 0xd8a878, jersey: 0x7b3fd0, pants: 0x16161d, shoes: 0x14141c, hair: 0x101014,
    helmet: false, headband: true, speed: 1.10, power: 1.08, build: 1.06, num: 5,
    hp: 115, dmg: 0.48, agg: 0.95,
    tip: 'THE VIPER hits fast. Keep moving and hit him back!'
  },
  king: {
    key: 'king', name: 'KING SMASH', desc: 'THE BOSS. Gold mask. Massive.',
    skin: 0x8a5a3b, jersey: 0xd9a326, pants: 0x1a1206, shoes: 0x14141c, hair: 0x120c08,
    helmet: true, headband: false, speed: 0.90, power: 1.45, build: 1.62, num: 1,
    hp: 185, dmg: 0.55, agg: 1.15, tough: 0.5, getUp: 0.55, boss: true,
    tip: 'THE BOSS! Punches hardly hurt him. Use the BIG SLAM!'
  }
};
var RIVAL_LIST = ['rookie', 'tigre', 'bigrig', 'viper', 'king'];

// ---------------------------------------------------------------- number decal
var numCache = {};
function numberTexture(n, fg, bg) {
  var k = n + '|' + fg + '|' + bg;
  if (numCache[k]) return numCache[k];
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 128);
  g.fillStyle = fg; g.font = '900 88px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), 64, 70);
  var t = srgbTex(c);
  numCache[k] = t;
  return t;
}
function srgbTex(c) { var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; }
function hex(n) { return '#' + ('000000' + n.toString(16)).slice(-6); }

// ---------------------------------------------------------------- human model
function mat(color, rough) {
  return new THREE.MeshStandardMaterial({ color: color, roughness: rough === undefined ? 0.82 : rough, metalness: 0.02 });
}
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m); }
function sph(r, m, seg) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 16, (seg || 16) / 2), m); }

function makeHuman(cfg, jerseyColor, style) {
  var wwe = style === 'wwe';
  var b = cfg.build * (wwe ? 1.14 : 1);
  var jCol = jerseyColor === undefined ? cfg.jersey : jerseyColor;
  var skinM = mat(cfg.skin, 0.9);
  var jerM = mat(jCol, 0.72);
  var pantM = mat(cfg.pants, 0.78);
  var shoeM = mat(cfg.shoes, 0.55);
  var hairM = mat(cfg.hair, 0.95);
  // pro-wrestling gear
  var trunkM = mat(jCol, 0.5);
  var bootM = mat(0x14141c, 0.35);
  var padM = mat(0x22222c, 0.6);
  var tapeM = mat(0xf4f4f4, 0.85);
  var goldM = new THREE.MeshStandardMaterial({ color: 0xffcf3a, roughness: 0.22, metalness: 0.7 });

  var root = new THREE.Group();
  var body = new THREE.Group();          // whole body, used for knock-down tilt
  root.add(body);

  // ---- legs
  var hips = new THREE.Group(); hips.position.y = 0.92; body.add(hips);
  function leg(side) {
    var hip = new THREE.Group();
    hip.position.set(side * 0.115 * b, 0, 0);
    var thigh = cyl(0.085 * b, 0.075 * b, 0.42, wwe ? skinM : pantM);
    thigh.position.y = -0.21; hip.add(thigh);
    var knee = new THREE.Group(); knee.position.y = -0.42; hip.add(knee);
    var kneeBall = sph(0.072 * b, wwe ? padM : pantM, 10);
    if (wwe) kneeBall.scale.set(1.25, 1.25, 1.25);
    knee.add(kneeBall);
    var shin = cyl(0.068 * b, 0.055 * b, 0.40, skinM);
    shin.position.y = -0.20; knee.add(shin);
    if (wwe) {
      var boot = cyl(0.082 * b, 0.074 * b, 0.30, bootM);
      boot.position.y = -0.27; knee.add(boot);
      var lace = cyl(0.084 * b, 0.084 * b, 0.03, trunkM, 12);
      lace.position.y = -0.16; knee.add(lace);
    } else {
      var sock = cyl(0.071 * b, 0.062 * b, 0.16, jerM);
      sock.position.y = -0.06; knee.add(sock);
    }
    var foot = box(0.11 * b, 0.075, 0.26, wwe ? bootM : shoeM);
    foot.position.set(0, -0.42, 0.05); knee.add(foot);
    hips.add(hip);
    return { hip: hip, knee: knee };
  }
  var legL = leg(-1), legR = leg(1);

  // ---- torso
  var torso = new THREE.Group(); torso.position.y = 0.92; body.add(torso);
  var chest = box(0.44 * b, 0.40, 0.24 * b, wwe ? skinM : jerM);
  chest.position.y = 0.32; torso.add(chest);
  var waist = box(0.34 * b, 0.20, 0.21 * b, wwe ? trunkM : jerM);
  waist.position.y = 0.07; torso.add(waist);
  // shoulder pads bulk for footballer / wrestler traps
  var shoulders = box(0.56 * b, 0.16, 0.26 * b, wwe ? skinM : jerM);
  shoulders.position.y = 0.48; torso.add(shoulders);
  if (cfg.helmet && !wwe) { shoulders.scale.set(1.15, 1.3, 1.15); }

  if (wwe) {
    // trunks over the hip line, pecs, abs and a title belt
    var trunks = box(0.38 * b, 0.26, 0.25 * b, trunkM);
    trunks.position.y = 0.05; torso.add(trunks);
    [-1, 1].forEach(function (s) {
      var pec = box(0.19 * b, 0.13, 0.06, skinM);
      pec.position.set(s * 0.10 * b, 0.40, 0.115 * b); torso.add(pec);
      var ab = box(0.15 * b, 0.19, 0.045, skinM);
      ab.position.set(s * 0.075 * b, 0.24, 0.115 * b); torso.add(ab);
    });
    var belt = box(0.40 * b, 0.10, 0.245 * b, goldM);
    belt.position.y = 0.165; torso.add(belt);
    var plate = cyl(0.075, 0.075, 0.02, goldM, 16);
    plate.rotation.x = Math.PI / 2; plate.position.set(0, 0.165, 0.128 * b); torso.add(plate);
  } else {
    // jersey number on the back
    var numM = new THREE.MeshStandardMaterial({
      map: numberTexture(cfg.num, '#ffffff', hex(jCol)),
      roughness: 0.8
    });
    var numPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.26 * b, 0.26), numM);
    numPlate.position.set(0, 0.34, -0.125 * b - 0.001);
    numPlate.rotation.y = Math.PI; torso.add(numPlate);
  }

  function arm(side) {
    var sh = new THREE.Group();
    sh.position.set(side * 0.28 * b, 0.46, 0);
    var up = cyl(0.062 * b, 0.055 * b, 0.32, skinM);
    up.position.y = -0.16; sh.add(up);
    if (wwe) {
      var bicep = sph(0.075 * b, skinM, 10);
      bicep.scale.set(1, 1.25, 1); bicep.position.y = -0.11; sh.add(bicep);
      var elpad = sph(0.062 * b, padM, 10);
      elpad.scale.set(1.15, 1.15, 1.15); elpad.position.y = -0.31; sh.add(elpad);
    } else {
      var sleeve = cyl(0.066 * b, 0.062 * b, 0.13, jerM);
      sleeve.position.y = -0.06; sh.add(sleeve);
    }
    var el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    var fore = cyl(0.052 * b, 0.045 * b, 0.28, skinM);
    fore.position.y = -0.14; el.add(fore);
    if (wwe) {
      var tape = cyl(0.058 * b, 0.058 * b, 0.09, tapeM, 12);
      tape.position.y = -0.245; el.add(tape);
    }
    var hand = sph(0.058 * b, skinM, 10);
    hand.position.y = -0.30; el.add(hand);
    torso.add(sh);
    return { sh: sh, el: el, hand: hand };
  }
  var armL = arm(-1), armR = arm(1);

  // ---- head
  var head = new THREE.Group(); head.position.y = 0.60; torso.add(head);
  head.scale.setScalar(1 + Math.max(0, b - 1) * 0.4);   // big builds get a bigger head, not a pin head
  var neck = cyl(0.055, 0.062, 0.10, skinM); neck.position.y = 0.04; head.add(neck);
  var skull = sph(0.118, skinM, 18); skull.position.y = 0.19; skull.scale.set(1, 1.12, 1.02); head.add(skull);
  var jaw = box(0.15, 0.09, 0.15, skinM); jaw.position.set(0, 0.125, 0.015); head.add(jaw);
  var eyeM = mat(0x101018, 0.3);
  var eyeW = mat(0xffffff, 0.3);
  [-1, 1].forEach(function (s) {
    var w = sph(0.026, eyeW, 8); w.position.set(s * 0.045, 0.20, 0.100); head.add(w);
    var p = sph(0.013, eyeM, 8); p.position.set(s * 0.047, 0.198, 0.118); head.add(p);
    var brow = box(0.05, 0.012, 0.02, hairM); brow.position.set(s * 0.046, 0.235, 0.104); head.add(brow);
  });
  var nose = box(0.035, 0.05, 0.04, skinM); nose.position.set(0, 0.168, 0.112); head.add(nose);
  var mouth = box(0.06, 0.012, 0.02, mat(0x6b2b2b, 0.6)); mouth.position.set(0, 0.115, 0.105); head.add(mouth);

  if (wwe && cfg.helmet) {
    // lucha mask
    var maskM = mat(jCol, 0.6);
    var msk = sph(0.132, maskM, 18); msk.position.y = 0.195; msk.scale.set(1, 1.1, 1.04); head.add(msk);
    var mstripe = box(0.036, 0.02, 0.27, goldM); mstripe.position.set(0, 0.315, 0.0); head.add(mstripe);
    [-1, 1].forEach(function (s) {
      var ring = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.045, 14), new THREE.MeshBasicMaterial({ color: 0xffcf3a, side: THREE.DoubleSide }));
      ring.position.set(s * 0.046, 0.199, 0.126); head.add(ring);
    });
    var mmouth = box(0.075, 0.03, 0.02, mat(0x2a1010, 0.7)); mmouth.position.set(0, 0.118, 0.116); head.add(mmouth);
  } else if (cfg.helmet) {
    var helM = mat(cfg.jersey, 0.35);
    var hel = sph(0.145, helM, 18); hel.position.y = 0.20; hel.scale.set(1, 1.02, 1.06); head.add(hel);
    var brim = cyl(0.148, 0.148, 0.03, helM, 18); brim.position.set(0, 0.145, 0.01); head.add(brim);
    var barM = mat(0xdadada, 0.4);
    var bar1 = cyl(0.012, 0.012, 0.22, barM, 8); bar1.rotation.z = Math.PI / 2; bar1.position.set(0, 0.145, 0.135); head.add(bar1);
    var bar2 = cyl(0.012, 0.012, 0.20, barM, 8); bar2.rotation.z = Math.PI / 2; bar2.position.set(0, 0.098, 0.125); head.add(bar2);
    var bar3 = cyl(0.012, 0.012, 0.11, barM, 8); bar3.position.set(0, 0.12, 0.132); head.add(bar3);
    var stripe = box(0.035, 0.02, 0.28, mat(0xffffff, 0.4)); stripe.position.set(0, 0.325, 0.0); head.add(stripe);
  } else {
    var hairTop = sph(0.126, hairM, 16); hairTop.position.y = 0.215; hairTop.scale.set(1, 0.86, 1.02); head.add(hairTop);
    var hairBack = box(0.2, 0.14, 0.06, hairM); hairBack.position.set(0, 0.19, -0.085); head.add(hairBack);
    if (cfg.headband) {
      var band = cyl(0.127, 0.127, 0.05, mat(0xffe14d, 0.6), 18);
      band.position.y = 0.235; head.add(band);
    }
  }

  root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  root.userData = {
    phase: Math.random() * TAU,
    body: body, torso: torso, head: head, hips: hips,
    legL: legL, legR: legR, armL: armL, armR: armR,
    cfg: cfg
  };
  return root;
}

function poseRun(h, speed, dt) {
  var u = h.userData;
  var amp = clamp(speed * 0.30, 0.06, 0.95);
  u.phase += dt * (5.0 + speed * 1.5);
  var p = u.phase;
  var s = Math.sin(p), s2 = Math.sin(p + Math.PI);
  u.legL.hip.rotation.x = s * amp;
  u.legR.hip.rotation.x = s2 * amp;
  u.legL.knee.rotation.x = -Math.max(0, Math.sin(p - 0.9)) * amp * 1.7;
  u.legR.knee.rotation.x = -Math.max(0, Math.sin(p - 0.9 + Math.PI)) * amp * 1.7;
  if (!u.armLock) {
    u.armL.sh.rotation.x = s2 * amp * 0.95;
    u.armR.sh.rotation.x = s * amp * 0.95;
    u.armL.sh.rotation.z = 0.10;
    u.armR.sh.rotation.z = -0.10;
    u.armL.el.rotation.x = -0.5 - Math.max(0, s2) * 0.6 * amp;
    u.armR.el.rotation.x = -0.5 - Math.max(0, s) * 0.6 * amp;
  }
  u.torso.position.y = 0.92 + Math.abs(Math.sin(p)) * 0.04 * amp;
  u.torso.rotation.x = clamp(speed * 0.045, 0, 0.22);
  u.head.rotation.x = -u.torso.rotation.x * 0.7;
}
function poseIdle(h, dt) {
  var u = h.userData;
  u.phase += dt * 2.0;
  var s = Math.sin(u.phase);
  u.legL.hip.rotation.x = lerp(u.legL.hip.rotation.x, 0.05, 0.15);
  u.legR.hip.rotation.x = lerp(u.legR.hip.rotation.x, -0.05, 0.15);
  u.legL.knee.rotation.x = lerp(u.legL.knee.rotation.x, -0.12, 0.15);
  u.legR.knee.rotation.x = lerp(u.legR.knee.rotation.x, -0.12, 0.15);
  if (!u.armLock) {
    u.armL.sh.rotation.x = lerp(u.armL.sh.rotation.x, 0.05 + s * 0.05, 0.15);
    u.armR.sh.rotation.x = lerp(u.armR.sh.rotation.x, 0.05 - s * 0.05, 0.15);
    u.armL.sh.rotation.z = lerp(u.armL.sh.rotation.z, 0.16, 0.15);
    u.armR.sh.rotation.z = lerp(u.armR.sh.rotation.z, -0.16, 0.15);
    u.armL.el.rotation.x = lerp(u.armL.el.rotation.x, -0.35, 0.15);
    u.armR.el.rotation.x = lerp(u.armR.el.rotation.x, -0.35, 0.15);
  }
  u.torso.position.y = lerp(u.torso.position.y, 0.92 + s * 0.012, 0.15);
  u.torso.rotation.x = lerp(u.torso.rotation.x, 0.02, 0.15);
  u.head.rotation.x = lerp(u.head.rotation.x, 0, 0.15);
}

// ---------------------------------------------------------------- ball
function makeBall() {
  var g = new THREE.Group();
  var m = mat(0x7a3b18, 0.6);
  var b = sph(1, m, 20);
  b.scale.set(0.115, 0.115, 0.185);
  g.add(b);
  var lace = box(0.02, 0.03, 0.13, mat(0xf5f5f5, 0.5));
  lace.position.set(0, 0.11, 0); g.add(lace);
  [-1, 1].forEach(function (s) {
    var r = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.011, 6, 20), mat(0xf5f5f5, 0.5));
    r.position.z = s * 0.088; g.add(r);
  });
  g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeSoccerBall() {
  var g = new THREE.Group();
  var b = sph(0.16, mat(0xf6f6f6, 0.5), 20); g.add(b);
  for (var i = 0; i < 10; i++) {
    var p = sph(0.045, mat(0x1a1a22, 0.5), 6);
    var a = Math.random() * TAU, e = Math.acos(rand(-1, 1));
    p.position.set(0.145 * Math.sin(e) * Math.cos(a), 0.145 * Math.cos(e), 0.145 * Math.sin(e) * Math.sin(a));
    g.add(p);
  }
  g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- crowd
function makeCrowd(scene, seats, boss) {
  var count = seats.length;
  if (!count) return null;
  var geo = new THREE.BoxGeometry(0.42, 0.62, 0.36);
  var m = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  var im = new THREE.InstancedMesh(geo, m, count);
  var dummy = new THREE.Object3D(), col = new THREE.Color();
  for (var i = 0; i < count; i++) {
    var p = seats[i];
    dummy.position.set(p.x + rand(-0.15, 0.15), p.y + rand(-0.05, 0.05), p.z + rand(-0.15, 0.15));
    dummy.rotation.set(0, (p.ry || 0) + rand(-0.3, 0.3), 0);
    dummy.scale.set(rand(0.85, 1.15), rand(0.85, 1.25), rand(0.85, 1.15));
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
    if (boss) col.setHSL(rand(0.03, 0.12), rand(0.55, 0.95), rand(0.18, 0.42));
    else col.setHSL(Math.random(), rand(0.3, 0.85), rand(0.32, 0.7));
    im.setColorAt(i, col);
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false; im.receiveShadow = false;
  scene.add(im);
  return im;
}

// Straight tiered stand. Returns the seat positions sitting on each step.
function buildStand(scene, o) {
  var seats = [];
  var m = mat(0x3b4552, 0.95);
  var trim = mat(0x2a323c, 0.95);
  for (var r = 0; r < o.rows; r++) {
    var dist = o.innerDist + r * o.stepD;
    var top = o.y0 + (r + 1) * o.stepH;
    var step;
    if (o.axis === 'x') {
      step = box(o.stepD, top, o.length, r % 2 ? m : trim);
      step.position.set(o.side * (dist + o.stepD / 2), top / 2, 0);
    } else {
      step = box(o.length, top, o.stepD, r % 2 ? m : trim);
      step.position.set(0, top / 2, o.side * (dist + o.stepD / 2));
    }
    step.receiveShadow = true;
    scene.add(step);
    var n = Math.floor(o.length / o.seatGap);
    for (var i = 0; i < n; i++) {
      var t = ((i + 0.5) / n - 0.5) * o.length;
      if (o.axis === 'x') {
        seats.push({ x: o.side * (dist + o.stepD * 0.55), y: top + 0.32, z: t, ry: o.side < 0 ? Math.PI / 2 : -Math.PI / 2 });
      } else {
        seats.push({ x: t, y: top + 0.32, z: o.side * (dist + o.stepD * 0.55), ry: o.side < 0 ? 0 : Math.PI });
      }
    }
  }
  return seats;
}

// Round tiered bowl around a ring. Open riser walls + annular step floors,
// so nothing ever covers the middle of the arena.
function buildBowl(scene, o) {
  var seats = [];
  var wallM = new THREE.MeshStandardMaterial({ color: 0x2b323c, roughness: 0.95, side: THREE.DoubleSide });
  var stepM = new THREE.MeshStandardMaterial({ color: 0x39424f, roughness: 0.95, side: THREE.DoubleSide });
  var prevTop = o.y0;
  for (var r = 0; r < o.rows; r++) {
    var rIn = o.innerR + r * o.stepD;
    var rOut = rIn + o.stepD;
    var top = o.y0 + (r + 1) * o.stepH;
    var wall = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, top - prevTop, 48, 1, true), wallM);
    wall.position.y = (prevTop + top) / 2;
    scene.add(wall);
    var deck = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 48), stepM);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = top;
    deck.receiveShadow = true;
    scene.add(deck);
    prevTop = top;
    var n = Math.floor(TAU * rIn / o.seatGap);
    for (var i = 0; i < n; i++) {
      var a = (i / n) * TAU;
      var rr = rIn + o.stepD * 0.5;
      seats.push({ x: Math.cos(a) * rr, y: top + 0.32, z: Math.sin(a) * rr, ry: -a + Math.PI / 2 });
    }
  }
  return seats;
}

// ---------------------------------------------------------------- field texture
var FIELD_LEN = 120, FIELD_W = 50, EZ = 10; // z: -60 (score) .. +60 (own)
function makeFieldTexture() {
  var W = 1024, H = 2048;
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var g = c.getContext('2d');
  g.fillStyle = '#2d7a33'; g.fillRect(0, 0, W, H);
  var bands = 24;
  for (var i = 0; i < bands; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    g.fillRect(0, i * H / bands, W, H / bands);
  }
  var ezPx = H * (EZ / FIELD_LEN);
  var play0 = ezPx, play1 = H - ezPx, playH = play1 - play0;
  // end zones
  g.fillStyle = '#17418f'; g.fillRect(0, 0, W, ezPx);          // top = scoring end
  g.fillStyle = '#8f1720'; g.fillRect(0, play1, W, ezPx);      // bottom = own end
  g.save();
  g.translate(W / 2, ezPx / 2); g.rotate(-Math.PI / 2);
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '900 92px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('END ZONE', 0, 0);
  g.restore();
  g.save();
  g.translate(W / 2, play1 + ezPx / 2); g.rotate(Math.PI / 2);
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '900 92px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('HOME', 0, 0);
  g.restore();
  // yard lines every 5
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  for (var y = 0; y <= 20; y++) {
    var py = play0 + playH * (y / 20);
    g.lineWidth = (y === 0 || y === 20) ? 12 : 6;
    g.beginPath(); g.moveTo(28, py); g.lineTo(W - 28, py); g.stroke();
  }
  // hash marks
  g.lineWidth = 4;
  for (var k = 0; k <= 100; k++) {
    var py2 = play0 + playH * (k / 100);
    [W * 0.36, W * 0.64].forEach(function (hx) {
      g.beginPath(); g.moveTo(hx - 10, py2); g.lineTo(hx + 10, py2); g.stroke();
    });
  }
  // numbers
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '900 74px "Trebuchet MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  var labels = [10, 20, 30, 40, 50, 40, 30, 20, 10];
  for (var n = 0; n < labels.length; n++) {
    var py3 = play0 + playH * ((n + 1) * 10 / 100);
    [W * 0.16, W * 0.84].forEach(function (nx) {
      g.save(); g.translate(nx, py3); g.rotate(nx < W / 2 ? -Math.PI / 2 : Math.PI / 2);
      g.fillText(String(labels[n]), 0, 0); g.restore();
    });
  }
  // sidelines
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 14;
  g.beginPath(); g.moveTo(24, 0); g.lineTo(24, H); g.moveTo(W - 24, 0); g.lineTo(W - 24, H); g.stroke();

  var t = srgbTex(c);
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- confetti
function makeConfetti(scene) {
  var N = 260;
  var im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.28, 0.03),
    new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide }), N);
  var col = new THREE.Color(), d = new THREE.Object3D();
  var parts = [];
  for (var i = 0; i < N; i++) {
    parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Vector3(), life: 0 });
    col.setHSL(Math.random(), 0.85, 0.6); im.setColorAt(i, col);
  }
  im.visible = false; scene.add(im);
  return {
    mesh: im, parts: parts,
    burst: function (x, y, z) {
      im.visible = true;
      for (var i = 0; i < N; i++) {
        var p = parts[i];
        p.p.set(x + rand(-2, 2), y + rand(0, 1.5), z + rand(-2, 2));
        p.v.set(rand(-7, 7), rand(7, 17), rand(-7, 7));
        p.r.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
        p.life = rand(2.0, 3.4);
      }
    },
    update: function (dt) {
      if (!im.visible) return;
      var alive = 0;
      for (var i = 0; i < N; i++) {
        var p = parts[i];
        if (p.life <= 0) { d.scale.setScalar(0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); continue; }
        alive++;
        p.life -= dt;
        p.v.y -= 22 * dt;
        p.v.multiplyScalar(1 - 1.4 * dt);
        p.p.addScaledVector(p.v, dt);
        if (p.p.y < 0.05) { p.p.y = 0.05; p.v.set(0, 0, 0); }
        d.position.copy(p.p);
        d.rotation.set(p.p.x + p.r.x * p.life, p.p.z + p.r.y * p.life, p.r.z * p.life);
        d.scale.setScalar(1);
        d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
      if (!alive) im.visible = false;
    }
  };
}

// ---------------------------------------------------------------- input
// Presses stay usable for a short window, so a tap still counts if the game
// was busy (cooldown, not near the ball yet). Without this it feels impossible.
var keys = {}, buf = {};
var PRESS_BUFFER = 0.24;
window.addEventListener('keydown', function (e) {
  if (!keys[e.code]) buf[e.code] = PRESS_BUFFER;
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) e.preventDefault();
  ac();
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { keys = {}; buf = {}; if (typeof resetTouch === 'function') resetTouch(); });
function hit(code) { if (buf[code] > 0) { buf[code] = 0; return true; } return false; }
function decayEdges(dt) { for (var k in buf) { if (buf[k] > 0) { buf[k] -= dt; if (buf[k] <= 0) delete buf[k]; } } }
function clearEdges() { buf = {}; }

function axisP1() {
  var x = 0, z = 0;
  if (keys.ArrowLeft || keys.KeyA) x -= 1;
  if (keys.ArrowRight || keys.KeyD) x += 1;
  if (keys.ArrowUp || keys.KeyW) z -= 1;
  if (keys.ArrowDown || keys.KeyS) z += 1;
  if (x === 0 && z === 0 && stick[1].len) return stick[1];
  return norm(x, z);
}
function axisP2() {
  var x = 0, z = 0;
  if (keys.KeyJ) x -= 1;
  if (keys.KeyL) x += 1;
  if (keys.KeyI) z -= 1;
  if (keys.KeyK) z += 1;
  if (x === 0 && z === 0 && stick[2].len) return stick[2];
  return norm(x, z);
}
function norm(x, z) {
  var l = Math.hypot(x, z);
  if (l > 0.0001) { x /= l; z /= l; }
  return { x: x, z: z, len: l > 0.0001 ? 1 : 0 };
}
var P1 = { act: function () { return hit('Space'); }, spec: function () { return hit('KeyE'); }, sprint: function () { return keys.ShiftLeft || keys.ShiftRight || held.ShiftLeft; } };
var P2 = { act: function () { return hit('KeyG'); }, spec: function () { return hit('KeyH'); }, sprint: function () { return keys.KeyU || held.KeyU; } };

// ---------------------------------------------------------------- touch input
// Phones have no keyboard, so a thumbstick and big round buttons feed the same
// key codes into the buffer above. Nothing else in the game needs to know.
var IS_TOUCH = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
               ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
var stick = { 1: { x: 0, z: 0, len: 0 }, 2: { x: 0, z: 0, len: 0 } };
var held = {};

function resetTouch() {
  stick[1] = { x: 0, z: 0, len: 0 };
  stick[2] = { x: 0, z: 0, len: 0 };
  held = {};
  if (!IS_TOUCH) return;
  [1, 2].forEach(function (n) {
    $('tb' + n).classList.remove('on');
    $('tk' + n).style.transform = '';
    $('tr' + n).classList.remove('held', 'press');
  });
}

function initTouch() {
  window.addEventListener('pointerdown', function () { ac(); }, { passive: true });
  if (!IS_TOUCH) return;
  document.body.classList.add('touch');
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  [1, 2].forEach(function (n) {
    var zone = $('tz' + n), base = $('tb' + n), knob = $('tk' + n);
    var id = null, ox = 0, oy = 0;
    function reach() { return base.offsetWidth * 0.42 || 54; }
    function down(e) {
      if (id !== null) return;
      id = e.pointerId;
      try { zone.setPointerCapture(id); } catch (err) { /* ignore */ }
      var r = zone.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      base.style.left = ox + 'px'; base.style.top = oy + 'px';
      base.classList.add('on');
      e.preventDefault();
      move(e);
    }
    function move(e) {
      if (e.pointerId !== id) return;
      e.preventDefault();
      var r = zone.getBoundingClientRect();
      var dx = (e.clientX - r.left) - ox, dy = (e.clientY - r.top) - oy;
      var d = Math.hypot(dx, dy);
      var nx = d > 0.001 ? dx / d : 0, ny = d > 0.001 ? dy / d : 0;
      var lim = Math.min(d, reach());
      knob.style.transform = 'translate(' + (nx * lim).toFixed(1) + 'px,' + (ny * lim).toFixed(1) + 'px)';
      // small dead zone so a resting thumb does not drift the player
      stick[n] = d < 9 ? { x: 0, z: 0, len: 0 } : { x: nx, z: ny, len: 1 };
    }
    function up(e) {
      if (e.pointerId !== id) return;
      id = null;
      base.classList.remove('on');
      knob.style.transform = '';
      stick[n] = { x: 0, z: 0, len: 0 };
    }
    zone.addEventListener('pointerdown', down);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tbtn'), function (b) {
    var code = b.getAttribute('data-code');
    var hold = b.getAttribute('data-hold') === '1';
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      b.classList.add('press');
      if (hold) { held[code] = !held[code]; b.classList.toggle('held', !!held[code]); }
      else buf[code] = PRESS_BUFFER;
    });
    function off() { b.classList.remove('press'); }
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
  });
}

// button words change with the game so a 5 year old knows what they do
var TOUCH_LABELS = {
  football: { p1: ['SPIN', 'THROW'], p2: ['TACKLE', ''] },
  wrestle: { p1: ['PUNCH', 'SLAM'], p2: ['PUNCH', 'SLAM'] },
  soccer: { p1: ['SHOOT', 'BIG KICK'], p2: ['SHOOT', 'BIG KICK'] }
};
function setTouchLabels() {
  if (!IS_TOUCH) return;
  var L = TOUCH_LABELS[mode] || TOUCH_LABELS.football;
  [1, 2].forEach(function (n) {
    var w = n === 1 ? L.p1 : L.p2;
    $('ta' + n).textContent = w[0];
    $('ts' + n).textContent = w[1];
    $('ts' + n).style.display = w[1] ? 'flex' : 'none';
  });
  $('touch').classList.toggle('two', nPlayers === 2);
}

// ---------------------------------------------------------------- renderer / loop
var renderer, clock, W = 1, H = 1;
var current = null;  // active game module

function initGL() {
  renderer = new THREE.WebGLRenderer({ antialias: !IS_TOUCH, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  $('app').appendChild(renderer.domElement);
  clock = new THREE.Clock();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
  requestAnimationFrame(loop);
}
function resize() {
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  document.body.classList.toggle('portrait', H > W);
  renderer.setSize(W, H);
  if (current && current.camera) { current.camera.aspect = W / H; current.camera.updateProjectionMatrix(); }
  if (previewCam) { previewCam.aspect = 1; previewCam.updateProjectionMatrix(); }
}
function loop() {
  requestAnimationFrame(loop);
  var dt = Math.min(clock.getDelta(), 0.05);
  if (previewOn) updatePreviews(dt);
  if (current) { current.update(dt); renderer.render(current.scene, current.camera); }
  decayEdges(dt);
}

// ---------------------------------------------------------------- UI plumbing
var screens = ['s-title', 's-how', 's-mode', 's-players', 's-char', 's-wmode', 's-rival', 's-result'];
var CHAR_IDS = CHAR_LIST.map(function (k) { return 'c:' + k; });
var RIVAL_IDS = RIVAL_LIST.map(function (k) { return 'r:' + k; });
function show(id) {
  screens.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  $('hud').classList.toggle('on', id === null);
  previewOn = (id === 's-char' || id === 's-rival');
  previewKeys = id === 's-char' ? CHAR_IDS : id === 's-rival' ? RIVAL_IDS : [];
}
function bigMsg(text, ms) {
  var el = $('bigmsg');
  el.textContent = text; el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, ms || 1300);
}
function setTip(t) { $('tip').textContent = t || ''; $('tip').style.display = t ? 'block' : 'none'; }
// timers owned by the running match, so a disposed game can't write to the HUD later
var gameTimers = [];
function gameTimer(fn, ms) { var id = setTimeout(fn, ms); gameTimers.push(id); return id; }
function clearGameTimers() { gameTimers.forEach(clearTimeout); gameTimers = []; }
function setKeys(list) {
  $('keys').innerHTML = list.map(function (k) { return '<div class="keycap"><b>' + k[0] + '</b> ' + k[1] + '</div>'; }).join('');
}
function setScorebar(cells) {
  $('scorebar').innerHTML = cells.map(function (c) {
    return '<div class="cell"><div class="lbl">' + c[0] + '</div><div class="val' + (c[2] ? ' gold' : '') + '">' + c[1] + '</div></div>';
  }).join('');
}

// ---------------------------------------------------------------- character preview
var previewOn = false, previewRenderer = null, previewScene = null, previewCam = null, previewModels = {}, previewCanvases = {};
var previewKeys = [];   // ids of the cards that are on screen right now
function buildPreviews() {
  previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  previewRenderer.setSize(380, 380);
  previewRenderer.setPixelRatio(1);
  previewRenderer.outputEncoding = THREE.sRGBEncoding;
  previewScene = new THREE.Scene();
  previewCam = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  previewCam.position.set(0, 1.02, 3.55);
  previewCam.lookAt(0, 0.92, 0);
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 0.7));
  var dl = new THREE.DirectionalLight(0xffffff, 0.85); dl.position.set(3, 6, 5); previewScene.add(dl);
  var dl2 = new THREE.DirectionalLight(0x88bbff, 0.4); dl2.position.set(-4, 2, -3); previewScene.add(dl2);

  buildCardRow('charrow', CHAR_LIST, CHARS, null, 'c:', function (k) { pickChar(k); });
  buildCardRow('rivalrow', RIVAL_LIST, RIVALS, 'wwe', 'r:', function (k) { pickRival(k); });
}
function buildCardRow(rowId, list, table, style, prefix, onPick) {
  var row = $(rowId); row.innerHTML = '';
  var made = [];
  list.forEach(function (k) {
    var cfg = table[k];
    var id = prefix + k;
    var card = document.createElement('div');
    card.className = 'card' + (cfg.boss ? ' boss' : '');
    card.id = 'card-' + id;
    var cv = document.createElement('canvas'); cv.width = 380; cv.height = 380;
    card.appendChild(cv);
    var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = cfg.name; card.appendChild(nm);
    var ds = document.createElement('div'); ds.className = 'desc'; ds.textContent = cfg.desc; card.appendChild(ds);
    card.addEventListener('click', function () { onPick(k); });
    row.appendChild(card);
    previewCanvases[id] = cv.getContext('2d');
    var m = makeHuman(cfg, undefined, style);
    m.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
    previewModels[id] = m;
    made.push({ m: m, bb: new THREE.Box3().setFromObject(m) });
  });
  // one scale for the whole row, set by the biggest guy, so a small guy still looks small
  var s = 99, tall = made[0];
  made.forEach(function (e) {
    var mh = Math.max(0.5, e.bb.max.y - e.bb.min.y);
    var mw = Math.max(0.3, Math.max(e.bb.max.x - e.bb.min.x, e.bb.max.z - e.bb.min.z));
    var fit = Math.min(1.36 / mh, 1.35 / mw);
    if (fit < s) { s = fit; tall = e; }
  });
  var yOff = 0.92 - (tall.bb.min.y + tall.bb.max.y) * 0.5 * s;
  made.forEach(function (e) {
    e.m.scale.setScalar(s);
    e.m.position.y = yOff + (tall.bb.min.y - e.bb.min.y) * s;   // every pair of feet on the same line
  });
}
var pvT = 0;
function updatePreviews(dt) {
  pvT += dt;
  previewKeys.forEach(function (id, i) {
    var m = previewModels[id];
    previewScene.add(m);
    m.rotation.y = Math.sin(pvT * 0.65 + i * 0.7) * 1.05;
    poseIdle(m, dt);
    previewRenderer.render(previewScene, previewCam);
    previewScene.remove(m);
    var ctx = previewCanvases[id];
    ctx.clearRect(0, 0, 380, 380);
    ctx.drawImage(previewRenderer.domElement, 0, 0);
  });
}

// ---------------------------------------------------------------- flow state
var mode = 'football', nPlayers = 1, pick1 = 'football', pick2 = 'wrestler', pickingFor = 1;

// wrestling, 1 player only
var wSub = 'belt';         // 'belt' = beat them all in a row, 'pick' = fight one you choose
var beltIdx = 0;           // which fight of the belt run we are on
var rivalKey = 'rookie';   // the rival for a single fight
var beltBest = loadBelt(); // how many belt-run fights have ever been won
var onAgain = null;        // what the big button on the result screen does

function loadBelt() {
  try { return clamp(parseInt(localStorage.getItem('gs_belt') || '0', 10) || 0, 0, RIVAL_LIST.length); }
  catch (e) { return 0; }
}
function saveBelt(n) {
  beltBest = Math.max(beltBest, n);
  try { localStorage.setItem('gs_belt', String(beltBest)); } catch (e) { }
}
function rivalOf(i) { return RIVALS[RIVAL_LIST[clamp(i, 0, RIVAL_LIST.length - 1)]]; }
function showWMode() {
  var n = RIVAL_LIST.length;
  $('beltnote').innerHTML = beltBest >= n
    ? 'BELT RUN: fight all ' + n + ' wrestlers. The BOSS is last. <b>You beat them all before!</b>'
    : 'BELT RUN: fight all ' + n + ' wrestlers. The BOSS is last. Best so far: <b>' + beltBest + ' of ' + n + '</b>.';
  show('s-wmode');
}
function showRivals() {
  RIVAL_LIST.forEach(function (k, i) {
    var card = $('card-r:' + k);
    var old = card.querySelector('.tick');
    if (old) card.removeChild(old);
    if (i < beltBest) {
      var t = document.createElement('div'); t.className = 'tick'; t.textContent = '\u2713';
      card.appendChild(t);
    }
  });
  show('s-rival');
}
function pickRival(k) { rivalKey = k; startGame(); }

function pickChar(k) {
  if (pickingFor === 1) {
    pick1 = k;
    if (nPlayers === 2) { pickingFor = 2; $('chartitle').textContent = 'PLAYER 2: PICK YOUR GUY'; return; }
    if (mode === 'wrestle' && wSub === 'pick') { pickingFor = 1; showRivals(); return; }
  } else { pick2 = k; }
  pickingFor = 1;
  startGame();
}

function startGame() {
  show(null);
  clearGameTimers();
  clearEdges();
  resetTouch();
  setTouchLabels();
  if (current && current.dispose) current.dispose();
  current = (mode === 'football') ? Football(pick1, pick2, nPlayers)
    : (mode === 'soccer') ? Soccer(pick1, pick2, nPlayers)
      : Wrestle(pick1, pick2, nPlayers);
  window.__g = current;
  resize();
  ac();
}
function toMenu() {
  clearGameTimers();
  if (current && current.dispose) current.dispose();
  current = null;
  renderer.clear();
  setTip('');
  bigMsg('', 1);
  resetTouch();
  onAgain = null;
  show('s-title');
}
function finish(title, body, again) {
  clearGameTimers();
  if (current && current.dispose) current.dispose();
  current = null;
  setTip('');
  resetTouch();
  onAgain = again || null;
  $('b-again').textContent = (again && again.label) || 'PLAY AGAIN';
  $('r-title').textContent = title;
  $('r-body').innerHTML = body;
  show('s-result');
}

// =================================================================
//                          FOOTBALL
// =================================================================
function Football(charKey, char2Key, np) {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc4ea);
  scene.fog = new THREE.Fog(0x8fc4ea, 90, 240);

  var camera = new THREE.PerspectiveCamera(52, W / H, 0.5, 400);
  camera.position.set(0, 12, 30);

  // lights
  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x2c5c30, 0.62));
  var sun = new THREE.DirectionalLight(0xfff3d8, 1.1);
  sun.position.set(40, 70, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var d = 70;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.far = 220;
  scene.add(sun);
  scene.add(sun.target);

  // field
  var fieldMat = new THREE.MeshStandardMaterial({ map: makeFieldTexture(), roughness: 0.95 });
  var field = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_LEN), fieldMat);
  field.rotation.x = -Math.PI / 2;
  field.receiveShadow = true;
  scene.add(field);

  // surrounding grass
  var outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x1f5c26, 1));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);

  // stands + crowd
  var seats = [];
  [-1, 1].forEach(function (s) {
    seats = seats.concat(buildStand(scene, { axis: 'x', side: s, rows: 11, stepD: 1.7, stepH: 0.85, innerDist: FIELD_W / 2 + 3, y0: 0.4, length: FIELD_LEN + 22, seatGap: 2.1 }));
  });
  [-1, 1].forEach(function (s) {
    seats = seats.concat(buildStand(scene, { axis: 'z', side: s, rows: 9, stepD: 1.7, stepH: 0.85, innerDist: FIELD_LEN / 2 + 4, y0: 0.4, length: FIELD_W + 46, seatGap: 2.2 }));
  });
  makeCrowd(scene, seats);

  // goal posts
  function goalPost(z, dir) {
    var g = new THREE.Group();
    var m = mat(0xf5c518, 0.35);
    var base = cyl(0.22, 0.22, 6, m, 10); base.position.y = 3; g.add(base);
    var cross = cyl(0.2, 0.2, 7.4, m, 10); cross.rotation.z = Math.PI / 2; cross.position.y = 6; g.add(cross);
    [-1, 1].forEach(function (s) {
      var up = cyl(0.18, 0.18, 9, m, 10); up.position.set(s * 3.7, 10.5, 0); g.add(up);
    });
    g.position.set(0, 0, z);
    g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    scene.add(g);
    return g;
  }
  goalPost(-FIELD_LEN / 2 + 0.3, -1);
  goalPost(FIELD_LEN / 2 - 0.3, 1);

  var confetti = makeConfetti(scene);

  // ---- entities
  var PSCALE = 1.32;
  var cfg = CHARS[charKey];
  var me = makeHuman(cfg);
  me.scale.setScalar(PSCALE);
  scene.add(me);
  var mePos = new THREE.Vector3(0, 0, 40);
  var meVel = new THREE.Vector3();
  var meFace = Math.PI;
  var meSpeedShown = 0;

  var ball = makeBall(); scene.add(ball);

  // receiver teammate
  var mateCfg = CHARS[charKey === 'soccer' ? 'football' : 'soccer'];
  var mate = makeHuman(mateCfg, 0xf0c419);
  mate.scale.setScalar(PSCALE);
  scene.add(mate);
  var matePos = new THREE.Vector3(9, 0, 36);
  var mateVel = new THREE.Vector3();

  // defenders
  var DEF_COLOR = 0x7a1fd0;
  var defs = [];
  var NDEF = 5;
  for (var i = 0; i < NDEF; i++) {
    var dc = CHARS[CHAR_LIST[i % 3]];
    var h = makeHuman(dc, DEF_COLOR);
    h.scale.setScalar(PSCALE);
    scene.add(h);
    defs.push({ o: h, p: new THREE.Vector3(), v: new THREE.Vector3(), down: 0, spd: rand(9.2, 11.6), face: 0, human: true });
  }
  // player 2 marker
  var marker = null;
  if (np === 2) {
    var mk = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), new THREE.MeshBasicMaterial({ color: 0xff3b2f }));
    mk.rotation.x = Math.PI;
    scene.add(mk);
    marker = mk;
    defs[0].isP2 = true;
    defs[0].spd = 11.5;
  }

  // ---- state
  var S = {
    phase: 'ready',      // ready | live | dead | td | kick | over
    t: 0,
    clock: 100,
    score: 0,
    tds: 0,
    tackles: 0,
    best: parseInt(localStorage.getItem('gs_best') || '0', 10),
    startZ: 40,
    carrier: 'me',       // 'me' | 'mate'
    inv: 0,
    thrown: false,
    ballFly: null,
    kickPhase: 0,
    kickPower: 0,
    kickDir: 0,
    kickBall: null,
    shake: 0,
    smashCd: 0
  };

  function yardLine(z) { return Math.round(clamp((FIELD_LEN / 2 - EZ - z) / ((FIELD_LEN - 2 * EZ) / 100), 0, 100)); }

  function resetPlay(z) {
    S.startZ = clamp(z, -FIELD_LEN / 2 + EZ + 2, FIELD_LEN / 2 - EZ - 2);
    mePos.set(0, 0, S.startZ);
    meVel.set(0, 0, 0);
    meFace = Math.PI;
    matePos.set(rand(-12, 12) > 0 ? 10 : -10, 0, S.startZ + 2);
    mateVel.set(0, 0, 0);
    S.carrier = 'me'; S.thrown = false; S.ballFly = null; S.inv = 0;
    for (var i = 0; i < defs.length; i++) {
      var dd = defs[i];
      dd.p.set(-16 + i * 8 + rand(-2, 2), 0,
        clamp(S.startZ - rand(14, 32), -FIELD_LEN / 2 + 3, FIELD_LEN / 2 - 3));
      dd.v.set(0, 0, 0); dd.down = 0;
    }
    S.phase = 'ready'; S.t = 0;
    setTip('Run to the blue END ZONE!');
  }

  function hud() {
    var cells = [
      ['SCORE', S.score, true],
      ['TIME', Math.max(0, Math.ceil(S.clock))],
      ['YARD', yardLine(carrierPos().z)],
      ['BEST', S.best]
    ];
    if (np === 2) cells.splice(1, 0, ['TACKLES', S.tackles]);
    setScorebar(cells);
  }
  function carrierPos() { return S.carrier === 'me' ? mePos : matePos; }

  setKeys(np === 2
    ? [['ARROWS', 'P1 run'], ['SPACE', 'P1 smash'], ['E', 'P1 throw'], ['SHIFT', 'P1 sprint'], ['I J K L', 'P2 chase'], ['G', 'P2 tackle']]
    : [['ARROWS / WASD', 'run'], ['SPACE', 'smash + spin'], ['E', 'throw'], ['SHIFT', 'sprint']]);
  resetPlay(40);
  hud();
  bigMsg('GO!', 900);
  SFX.whistle();

  // ---- kick minigame
  var GOAL_Z = -FIELD_LEN / 2 + 0.3;   // plane of the goal posts
  var BAR_Y = 6;                       // crossbar height
  var UPRIGHT_X = 3.7;                 // half gap between uprights
  function startKick() {
    S.phase = 'kick'; S.t = 0;
    S.kickJudged = false; S.kickGood = false; S.kickAnim = 0;
    $('kick').classList.add('on');
    $('kickcap').textContent = IS_TOUCH ? 'TAP THE GREEN BUTTON!' : 'PRESS SPACE!';
    if (IS_TOUCH) $('ta1').textContent = 'KICK!';
    setTip('Stop the bar in the GREEN, then it kicks!');
    if (!S.kickBall) { S.kickBall = makeBall(); scene.add(S.kickBall); }
    S.kickBall.visible = true;
    S.kickBall.scale.setScalar(1.5);
    S.kickBall.position.set(0, 0.35, GOAL_Z + 16);
    S.kickBall.rotation.set(Math.PI / 2, 0, 0);
    S.kickVel = null;
    mePos.set(0, 0, GOAL_Z + 19);
    meVel.set(0, 0, 0);
    meFaceRef.a = Math.PI;
    me.position.set(0, 0, mePos.z);
    me.rotation.y = Math.PI;
    matePos.set(6, 0, GOAL_Z + 20);
    mate.position.set(matePos.x, 0, matePos.z);
    mate.rotation.y = Math.PI;
    ball.visible = false;
  }

  function updateKick(dt) {
    me.position.set(mePos.x, 0, mePos.z);
    me.rotation.y = Math.PI;
    poseIdle(mate, dt);

    if (S.kickAnim > 0) {          // wind-up + leg swing, then launch
      S.kickAnim -= dt;
      var k = 1 - S.kickAnim / 0.45;
      var u = me.userData;
      u.armLock = true;
      u.legR.hip.rotation.x = -Math.sin(clamp(k, 0, 1) * Math.PI) * 1.8;
      u.legR.knee.rotation.x = -0.2;
      u.torso.rotation.x = -0.25 * Math.sin(clamp(k, 0, 1) * Math.PI);
      u.armL.sh.rotation.x = -1.2; u.armR.sh.rotation.x = 0.6;
      if (S.kickAnim <= 0) launchKick();
      return;
    }
    poseIdle(me, dt);
    S.kickPower = (Math.sin(S.t * 3.2) + 1) / 2;
    $('needle').style.left = (S.kickPower * 100) + '%';
    if (hit('Space')) {
      S.kickGood = S.kickPower > 0.5 && S.kickPower < 0.78;
      S.kickMiss = S.kickPower <= 0.5 ? 'short' : 'wide';
      S.kickAnim = 0.45;
      $('kick').classList.remove('on');
      setTouchLabels();
      setTip('');
    }
  }

  function launchKick() {
    SFX.kick();
    me.userData.armLock = false;
    S.phase = 'kickfly'; S.t = 0;
    if (S.kickGood) {
      S.kickVel = new THREE.Vector3(rand(-1.4, 1.4), 22, -26);
    } else if (S.kickMiss === 'short') {
      S.kickVel = new THREE.Vector3(rand(-2, 2), 10.5, -22);     // clangs off / under the bar
    } else {
      S.kickVel = new THREE.Vector3(rand(0, 1) > 0.5 ? 11 : -11, 21, -26); // sails wide
    }
  }

  function updateKickFly(dt) {
    poseIdle(me, dt); me.position.set(mePos.x, 0, mePos.z); me.rotation.y = Math.PI;
    poseIdle(mate, dt);
    var b = S.kickBall;
    if (!b || !S.kickVel) return;
    var prevZ = b.position.z;
    S.kickVel.y -= 20 * dt;
    b.position.addScaledVector(S.kickVel, dt);
    b.rotation.x += dt * 14;

    // judge the kick the moment the ball reaches the goal plane
    if (!S.kickJudged && prevZ > GOAL_Z && b.position.z <= GOAL_Z) {
      S.kickJudged = true;
      var over = b.position.y > BAR_Y && Math.abs(b.position.x) < UPRIGHT_X;
      if (over) {
        S.score += 1; SFX.score(); SFX.cheer();
        bigMsg('IT IS GOOD!', 1600);
        confetti.burst(0, BAR_Y + 2, GOAL_Z + 2);
        if (S.score > S.best) { S.best = S.score; localStorage.setItem('gs_best', String(S.best)); }
      } else {
        SFX.boo();
        bigMsg(Math.abs(b.position.x) >= UPRIGHT_X ? 'WIDE! NO GOOD!' : 'TOO LOW! NO GOOD!', 1600);
      }
      endKick();
    }
    if (b.position.y < 0.25) {          // bounce, then settle
      b.position.y = 0.25;
      S.kickVel.y = Math.abs(S.kickVel.y) * 0.42;
      S.kickVel.x *= 0.7; S.kickVel.z *= 0.7;
      if (!S.kickJudged) { S.kickJudged = true; SFX.boo(); bigMsg('TOO LOW! NO GOOD!', 1600); endKick(); }
    }
  }

  function endKick() {
    gameTimer(function () {
      if (S.phase === 'over') return;
      ball.visible = true;
      if (S.kickBall) S.kickBall.visible = false;
      resetPlay(40);
    }, 1900);
  }

  function touchdown() {
    S.phase = 'td'; S.t = 0;
    S.score += 6; S.tds += 1;
    SFX.score(); SFX.cheer();
    var p = carrierPos();
    confetti.burst(p.x, 2, p.z);
    bigMsg('TOUCHDOWN!', 2000);
    setTip('');
    if (S.score > S.best) { S.best = S.score; localStorage.setItem('gs_best', String(S.best)); }
  }

  function tackled(byP2) {
    if (S.phase !== 'live') return;
    S.phase = 'dead'; S.t = 0;
    SFX.thud(); SFX.whistle();
    S.shake = 0.5;
    if (byP2) { S.tackles += 1; bigMsg('TACKLED!', 1100); }
    else bigMsg('TACKLED!', 1000);
    var h = S.carrier === 'me' ? me : mate;
    h.userData.knock = 1.2;
  }

  // ---- update
  function update(dt) {
    S.t += dt;
    if (S.phase === 'live') {
      S.clock -= dt;
      if (S.clock <= 0) { S.clock = 0; gameOver(); return; }
    }
    if (S.phase === 'ready') {
      if (S.t > 0.5) { S.phase = 'live'; setTip(np === 2 ? 'P1 run! P2 chase and tackle!' : (IS_TOUCH ? 'Tap SPIN to smash tacklers!' : 'Press SPACE to smash tacklers!')); }
    }
    if (S.phase === 'dead' && S.t > 1.0) {
      var z = carrierPos().z;
      resetPlay(z);
    }
    if (S.phase === 'td' && S.t > 2.2) startKick();

    if (S.phase === 'kick') updateKick(dt);
    else if (S.phase === 'kickfly') updateKickFly(dt);
    else updatePlay(dt);

    confetti.update(dt);
    updateCamera(dt);
    hud();
  }

  function moveHuman(obj, pos, vel, dir, speed, dt, faceRef) {
    var ax = 46 * dt;
    vel.x = lerp(vel.x, dir.x * speed, clamp(ax, 0, 1));
    vel.z = lerp(vel.z, dir.z * speed, clamp(ax, 0, 1));
    pos.x = clamp(pos.x + vel.x * dt, -FIELD_W / 2 + 1.2, FIELD_W / 2 - 1.2);
    pos.z = clamp(pos.z + vel.z * dt, -FIELD_LEN / 2 + 1.2, FIELD_LEN / 2 - 1.2);
    var sp = Math.hypot(vel.x, vel.z);
    if (sp > 0.6) faceRef.a = Math.atan2(vel.x, vel.z);
    obj.position.set(pos.x, 0, pos.z);
    obj.rotation.y = angleLerp(obj.rotation.y, faceRef.a, 1 - Math.pow(0.0005, dt));
    return sp;
  }
  function angleLerp(a, b, t) {
    var diff = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + diff * t;
  }

  var meFaceRef = { a: Math.PI }, mateFaceRef = { a: Math.PI };

  function updatePlay(dt) {
    var live = S.phase === 'live';
    S.inv = Math.max(0, S.inv - dt);
    S.smashCd = Math.max(0, S.smashCd - dt);

    // ---- ball carrier control
    var dir = live ? axisP1() : { x: 0, z: 0, len: 0 };
    var base = 12.5 * (S.carrier === 'me' ? cfg.speed : mateCfg.speed);
    var spd = base * (P1.sprint() ? 1.34 : 1) * (S.inv > 0 ? 1.15 : 1);

    if (S.carrier === 'me') {
      var s1 = moveHuman(me, mePos, meVel, dir, dir.len ? spd : 0, dt, meFaceRef);
      meSpeedShown = s1;
      // teammate runs a route
      var mdir = norm(clamp((matePos.x > 0 ? 18 : -18) - matePos.x, -1, 1), -1);
      matePos.x = clamp(matePos.x + mdir.x * 6 * dt, -FIELD_W / 2 + 2, FIELD_W / 2 - 2);
      matePos.z = clamp(matePos.z - 9.5 * dt * (live ? 1 : 0), -FIELD_LEN / 2 + 2, FIELD_LEN / 2 - 2);
      mate.position.set(matePos.x, 0, matePos.z);
      mate.rotation.y = angleLerp(mate.rotation.y, Math.PI, 1 - Math.pow(0.002, dt));
      poseRun(mate, live ? 9.5 : 0, dt);
      poseRun(me, s1, dt);
    } else {
      var s2 = moveHuman(mate, matePos, mateVel, dir, dir.len ? spd : 0, dt, mateFaceRef);
      poseRun(mate, s2, dt);
      // the thrower jogs after the play
      var bdir = norm(matePos.x - mePos.x, matePos.z - mePos.z);
      var bs = moveHuman(me, mePos, meVel, bdir, live ? 7 : 0, dt, meFaceRef);
      poseRun(me, bs, dt);
    }

    // knock-down tilt
    [me, mate].forEach(function (h) {
      var u = h.userData;
      if (u.knock > 0) {
        u.knock -= dt;
        u.body.rotation.x = lerp(u.body.rotation.x, -1.5, 1 - Math.pow(0.001, dt));
        u.body.position.y = lerp(u.body.position.y, 0, 1 - Math.pow(0.001, dt));
      } else {
        u.body.rotation.x = lerp(u.body.rotation.x, 0, 1 - Math.pow(0.001, dt));
        u.body.position.y = lerp(u.body.position.y, 0, 1 - Math.pow(0.001, dt));
      }
    });

    // ---- actions
    if (live && S.smashCd <= 0 && P1.act()) {
      S.smashCd = 0.5; S.inv = 0.55;
      SFX.spin();
      var cp = carrierPos(), knocked = 0;
      for (var i = 0; i < defs.length; i++) {
        var dd = defs[i];
        if (dd.down > 0) continue;
        if (dd.p.distanceTo(cp) < 5.4) {
          dd.down = 2.6; knocked++;
          dd.v.set((dd.p.x - cp.x) * 2.2, 0, (dd.p.z - cp.z) * 2.2);
        }
      }
      if (knocked) { SFX.smash(); S.shake = 0.35; bigMsg('SMASH!', 700); }
    }
    if (live && !S.thrown && S.carrier === 'me' && P1.spec()) {
      S.thrown = true;
      S.ballFly = { t: 0, from: mePos.clone().setY(1.6), to: matePos.clone() };
      SFX.kick();
      bigMsg('THROW!', 800);
    }

    // ---- ball in flight
    if (S.ballFly) {
      S.ballFly.t += dt / 0.75;
      var f = S.ballFly;
      f.to.copy(matePos);
      var t = clamp(f.t, 0, 1);
      ball.position.set(
        lerp(f.from.x, f.to.x, t),
        lerp(f.from.y, 1.4, t) + Math.sin(t * Math.PI) * 7,
        lerp(f.from.z, f.to.z, t)
      );
      ball.rotation.z += dt * 22;
      if (t >= 1) {
        S.ballFly = null; S.carrier = 'mate';
        S.inv = 1.1;                       // a moment to get going after the catch
        mateVel.set(0, 0, 0);
        meVel.set(0, 0, 0);
        mateFaceRef.a = Math.PI;
        SFX.catchit(); bigMsg('CAUGHT IT!', 900);
      }
    } else {
      var cp2 = carrierPos();
      var holder = S.carrier === 'me' ? me : mate;
      ball.position.set(cp2.x + Math.sin(holder.rotation.y + 1.5) * 0.45, 1.38, cp2.z + Math.cos(holder.rotation.y + 1.5) * 0.45);
      ball.rotation.set(0.2, holder.rotation.y, 0.5);
      ball.scale.setScalar(1.3);
    }

    // ---- touchdown / sideline check runs BEFORE tacklers, so a catch in the
    //      end zone always scores instead of being whistled dead first
    var target = carrierPos();
    if (live && target.z <= -FIELD_LEN / 2 + EZ) { touchdown(); return; }
    if (live && Math.abs(target.x) >= FIELD_W / 2 - 1.3) {
      S.phase = 'dead'; S.t = 0; SFX.whistle(); bigMsg('OUT!', 900);
      return;
    }

    // ---- defenders
    for (var j = 0; j < defs.length; j++) {
      var dd2 = defs[j];
      var ddir;
      if (dd2.down > 0) {
        dd2.down -= dt;
        dd2.v.multiplyScalar(1 - 3 * dt);
        dd2.p.x += dd2.v.x * dt; dd2.p.z += dd2.v.z * dt;
        dd2.o.position.set(dd2.p.x, 0, dd2.p.z);
        dd2.o.userData.body.rotation.x = lerp(dd2.o.userData.body.rotation.x, -1.5, 1 - Math.pow(0.002, dt));
        dd2.o.userData.body.position.y = lerp(dd2.o.userData.body.position.y, 0, 1 - Math.pow(0.002, dt));
        continue;
      }
      dd2.o.userData.body.rotation.x = lerp(dd2.o.userData.body.rotation.x, 0, 1 - Math.pow(0.002, dt));
      dd2.o.userData.body.position.y = lerp(dd2.o.userData.body.position.y, 0, 1 - Math.pow(0.002, dt));

      if (dd2.isP2 && np === 2) {
        ddir = live ? axisP2() : { x: 0, z: 0, len: 0 };
      } else {
        // chase with a bit of lead
        var lead = 0.35;
        var tx = target.x + (S.carrier === 'me' ? meVel.x : 0) * lead;
        var tz = target.z - 1.2;
        ddir = norm(tx - dd2.p.x, tz - dd2.p.z);
        // spread out so they do not stack
        for (var k = 0; k < defs.length; k++) {
          if (k === j || defs[k].down > 0) continue;
          var ox = dd2.p.x - defs[k].p.x, oz = dd2.p.z - defs[k].p.z;
          var dist = Math.hypot(ox, oz);
          if (dist < 3.4 && dist > 0.01) { ddir.x += (ox / dist) * 0.6; ddir.z += (oz / dist) * 0.6; }
        }
        var nn = norm(ddir.x, ddir.z); ddir = nn;
      }
      if (!dd2.faceRef) dd2.faceRef = { a: 0 };
      var dspeed = live ? dd2.spd * (dd2.isP2 ? (P2.sprint() ? 1.3 : 1) : 1) : 0;
      var ds = moveHuman(dd2.o, dd2.p, dd2.v, ddir, ddir.len ? dspeed : 0, dt, dd2.faceRef);
      poseRun(dd2.o, ds, dt);

      // tackle check
      if (live && S.inv <= 0) {
        var dist2 = dd2.p.distanceTo(target);
        var canTackle = dist2 < 2.3;
        if (dd2.isP2 && np === 2) canTackle = (dist2 < 3.8 && P2.act()) || dist2 < 2.2;
        if (canTackle) tackled(!!dd2.isP2);
      }
    }
    if (marker && defs[0]) {
      marker.position.set(defs[0].p.x, 4.4 + Math.sin(S.t * 5) * 0.15, defs[0].p.z);
      marker.visible = defs[0].down <= 0;
    }
  }

  function gameOver() {
    S.phase = 'over';
    SFX.whistle();
    if (S.score > S.best) { S.best = S.score; localStorage.setItem('gs_best', String(S.best)); }
    var msg = 'You scored <b>' + S.score + '</b> points and got <b>' + S.tds + '</b> touchdown' + (S.tds === 1 ? '' : 's') + '.';
    if (np === 2) msg += '<br>Player 2 made <b>' + S.tackles + '</b> tackles.';
    msg += '<br><br>Best ever: <b>' + S.best + '</b>';
    gameTimer(function () { finish(S.tds > 0 ? 'GREAT GAME!' : 'TIME UP!', msg); }, 900);
  }

  function updateCamera(dt) {
    var t = carrierPos();
    var want = new THREE.Vector3(t.x * 0.4, 9.3, t.z + 15.2);
    var look = new THREE.Vector3(t.x * 0.4, 2.2, t.z - 5.0);
    if (S.phase === 'td') { want.set(t.x * 0.4, 7.2, t.z + 11.5); look.set(t.x * 0.4, 2.2, t.z - 5.0); }
    if (S.phase === 'kick') { want.set(0, 6.5, mePos.z + 11); look.set(0, 5.0, GOAL_Z); }
    if (S.phase === 'kickfly') {
      var b = S.kickBall;
      want.set(0, 7.5, mePos.z + 11);
      look.set(b ? b.position.x * 0.6 : 0, b ? clamp(b.position.y * 0.8 + 2, 3, 12) : 5, GOAL_Z + 2);
    }
    camera.position.lerp(want, 1 - Math.pow(0.0025, dt));
    if (S.shake > 0) {
      S.shake -= dt;
      camera.position.x += rand(-1, 1) * S.shake * 0.9;
      camera.position.y += rand(-1, 1) * S.shake * 0.6;
    }
    camera.lookAt(look);
    sun.target.position.set(t.x, 0, t.z);
    sun.position.set(t.x + 40, 70, t.z + 40);
  }

  return {
    scene: scene, camera: camera, update: update,
    dbg: { td: touchdown, kick: startKick, state: S, me: mePos },
    dispose: function () {
      $('kick').classList.remove('on');
      setTip('');
      disposeScene(scene);
    }
  };
}

// =================================================================
//                          WRESTLING
// =================================================================
function Wrestle(charKey, char2Key, np) {
  // who you fight
  var c1 = CHARS[charKey];
  var belt = (np === 1 && wSub === 'belt');
  var rival = (np === 1) ? (belt ? rivalOf(beltIdx) : (RIVALS[rivalKey] || RIVALS.rookie)) : null;
  var c2 = (np === 2) ? CHARS[char2Key] : rival;
  var BOSS = !!(rival && rival.boss);
  var AGG = rival ? rival.agg : 1;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BOSS ? 0x140a06 : 0x0b0f18);
  scene.fog = new THREE.Fog(BOSS ? 0x140a06 : 0x0b0f18, 40, 130);

  var camera = new THREE.PerspectiveCamera(52, W / H, 0.5, 300);
  camera.position.set(0, 8, 13);

  scene.add(new THREE.HemisphereLight(BOSS ? 0xe8a45c : 0x8fb0e8, 0x2a2030, 0.45));
  var key1 = new THREE.SpotLight(0xffffff, 1.25, 90, 0.8, 0.45, 1);
  key1.position.set(6, 20, 8); key1.castShadow = true;
  key1.shadow.mapSize.set(2048, 2048);
  scene.add(key1); scene.add(key1.target);
  var key2 = new THREE.SpotLight(BOSS ? 0xffc23a : 0xffd7a0, BOSS ? 1.15 : 0.75, 90, 0.9, 0.6, 1);
  key2.position.set(-8, 18, -6); scene.add(key2);
  var rim = new THREE.DirectionalLight(BOSS ? 0xff7a3a : 0x88aaff, 0.35); rim.position.set(-6, 8, -14); scene.add(rim);
  var fill = new THREE.DirectionalLight(0xffffff, 0.28); fill.position.set(0, 6, 18); scene.add(fill);

  // arena floor
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0x14181f, 1));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // ring
  var RING = 4.6;              // half-size of the mat
  var ringH = 1.25;
  var apron = box(RING * 2 + 2.2, ringH, RING * 2 + 2.2, mat(0x1c2333, 0.9));
  apron.position.y = ringH / 2; apron.receiveShadow = true; scene.add(apron);

  // apron skirt with the show name on all four sides
  var skirtTex = (function () {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, 128);
    if (BOSS) { grd.addColorStop(0, '#d9a326'); grd.addColorStop(1, '#5a3c05'); }
    else { grd.addColorStop(0, '#c0182f'); grd.addColorStop(1, '#6d0b1a'); }
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 128);
    g.fillStyle = BOSS ? '#1a1206' : '#ffd34d';
    g.font = '900 74px "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(BOSS ? 'T I T L E   M A T C H' : 'S M A S H   A R E N A', 512, 68);
    return srgbTex(c);
  })();
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (n) {
    var w = RING * 2 + 2.2;
    var sk = new THREE.Mesh(new THREE.PlaneGeometry(w, ringH * 0.92),
      new THREE.MeshStandardMaterial({ map: skirtTex, roughness: 0.85 }));
    sk.position.set(n[0] * (w / 2 + 0.01), ringH * 0.5, n[1] * (w / 2 + 0.01));
    sk.rotation.y = Math.atan2(n[0], n[1]);
    scene.add(sk);
  });

  var matTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = BOSS ? '#2a0d0d' : '#1b4a80'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = BOSS ? '#ffd34d' : '#ffffff'; g.lineWidth = 16;
    g.strokeRect(26, 26, 460, 460);
    g.strokeStyle = BOSS ? '#8a1520' : '#c0182f'; g.lineWidth = 8;
    g.strokeRect(52, 52, 408, 408);
    g.fillStyle = '#ffd34d';
    g.save(); g.translate(256, 256); g.rotate(-0.0);
    g.font = '900 62px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(BOSS ? 'TITLE' : 'SMASH', 0, -20);
    g.fillStyle = BOSS ? '#ffd34d' : '#ffffff';
    g.fillText(BOSS ? 'MATCH' : 'ARENA', 0, 46);
    g.restore();
    var t = srgbTex(c); return t;
  })();
  var matTop = new THREE.Mesh(new THREE.PlaneGeometry(RING * 2, RING * 2), new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.9 }));
  matTop.rotation.x = -Math.PI / 2; matTop.position.y = ringH + 0.01; matTop.receiveShadow = true; scene.add(matTop);

  // posts + ropes
  var postM = mat(BOSS ? 0x8a1520 : 0xc0182f, 0.5);
  var ropeCols = BOSS ? [0xffd34d, 0xf5c518, 0xffd34d] : [0xffffff, 0x1f7fd0, 0xc0182f];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (c) {
    var p = cyl(0.22, 0.22, 3.6, postM, 12);
    p.position.set(c[0] * RING, ringH + 1.8, c[1] * RING);
    p.castShadow = true; scene.add(p);
    var cap = sph(0.28, mat(0xf5c518, 0.4), 12);
    cap.position.set(c[0] * RING, ringH + 3.6, c[1] * RING); scene.add(cap);
    // turnbuckle pads
    var padM2 = mat(0x1f7fd0, 0.6);
    for (var t = 0; t < 3; t++) {
      var tb = box(0.5, 0.42, 0.5, t === 1 ? mat(0xffd34d, 0.6) : padM2);
      tb.position.set(c[0] * (RING - 0.02), ringH + 0.72 + t * 0.72, c[1] * (RING - 0.02));
      tb.rotation.y = Math.PI / 4;
      tb.castShadow = true; scene.add(tb);
    }
  });
  for (var r = 0; r < 3; r++) {
    var y = ringH + 0.72 + r * 0.72;
    var col = ropeCols[r];
    [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (n) {
      var len = RING * 2;
      var rope = cyl(0.07, 0.07, len, mat(col, 0.5), 8);
      if (n[0] === 0) { rope.rotation.z = Math.PI / 2; rope.position.set(0, y, n[1] * RING); }
      else { rope.rotation.x = Math.PI / 2; rope.position.set(n[0] * RING, y, 0); }
      rope.castShadow = true;
      scene.add(rope);
    });
  }

  // tiered crowd bowl around the ring
  makeCrowd(scene, buildBowl(scene, { rows: 9, innerR: 8.5, stepD: 1.8, stepH: 0.62, y0: 0.2, seatGap: 1.5 }), BOSS);

  var confetti = makeConfetti(scene);

  // fighters
  function fighter(cf, jersey, x, facing) {
    var o = makeHuman(cf, jersey, 'wwe');
    o.scale.setScalar(cf.boss ? 1.3 : 1.15);
    scene.add(o);
    return {
      o: o, cfg: cf,
      p: new THREE.Vector3(x, ringH, 0),
      v: new THREE.Vector3(),
      face: { a: facing }, hp: 100, hpMax: 100, atkCd: 0, specCd: 0,
      stun: 0, anim: 0, animType: '', down: 0, blockT: 0, dmgMul: 1,
      air: 0, airV: 0, spin: 0
    };
  }
  var A = fighter(c1, 0x1f7fd0, -2.6, Math.PI / 2);
  var B = fighter(c2, np === 2 ? 0xc0182f : c2.jersey, 2.6, -Math.PI / 2);
  if (np === 1) {
    B.dmgMul = rival.dmg;          // the computer hits softer, so a kid can win
    B.hpMax = rival.hp; B.hp = rival.hp;
  }

  // a gold spotlight ring on the mat under the boss
  var bossRing = null;
  if (BOSS) {
    bossRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    bossRing.rotation.x = -Math.PI / 2;
    bossRing.position.y = ringH + 0.03;
    scene.add(bossRing);
  }

  $('bars').classList.add('on');
  $('scorebar').style.display = 'none';
  $('f1name').textContent = 'P1 ' + c1.name;
  $('f2name').textContent = (np === 2 ? 'P2 ' : '') + c2.name +
    (belt ? '  ' + (beltIdx + 1) + '/' + RIVAL_LIST.length : '');

  var S = { over: false, t: 0, shake: 0, aiT: 0, aiMode: 'approach', ended: 0, rage: false };

  setKeys(np === 2
    ? [['ARROWS', 'P1 move'], ['SPACE', 'P1 punch'], ['E', 'P1 SLAM'], ['I J K L', 'P2 move'], ['G', 'P2 punch'], ['H', 'P2 SLAM']]
    : [['ARROWS / WASD', 'move'], ['SPACE', 'punch'], ['E', 'BIG SLAM']]);
  if (np === 1 && rival.tip) setTip(rival.tip);
  else setTip(IS_TOUCH ? 'Get close, then tap PUNCH and SLAM!' : 'Get close, then press SPACE to punch and E to SLAM!');
  if (BOSS) {
    SFX.gong();
    bigMsg('BOSS FIGHT!', 1600);
    gameTimer(function () { SFX.bell(); bigMsg('FIGHT!', 1200); }, 1650);
  } else {
    SFX.bell();
    bigMsg(belt ? 'FIGHT ' + (beltIdx + 1) + ' OF ' + RIVAL_LIST.length + '!' : 'FIGHT!', 1400);
  }

  var SLAM_NAMES = ['BODY SLAM!', 'SUPLEX!', 'CLOTHESLINE!', 'POWERBOMB!', 'DDT!', 'CHOKESLAM!'];
  var PUNCH_NAMES = ['CHOP!', 'ELBOW!', 'RIGHT HAND!'];

  function attack(me, foe, big) {
    var dist = me.p.distanceTo(foe.p);
    var reach = big ? 2.7 : 2.2;
    me.anim = big ? 0.55 : 0.28;
    me.animType = big ? 'slam' : 'punch';
    if (dist < reach && foe.down <= 0) {
      var dmg = (big ? 20 : 8) * me.cfg.power * me.dmgMul;
      if (foe.blockT > 0) dmg *= 0.35;
      if (!big && foe.cfg.tough) dmg *= foe.cfg.tough;   // the boss shrugs off punches
      foe.hp = Math.max(0, foe.hp - dmg);
      foe.stun = big ? 0.75 : 0.28;
      var away = new THREE.Vector3().subVectors(foe.p, me.p).setY(0).normalize();
      if (away.lengthSq() < 0.01) away.set(0, 0, 1);
      foe.v.addScaledVector(away, big ? 11 : 5);
      if (big) {
        SFX.slam(); S.shake = 0.6;
        bigMsg(SLAM_NAMES[(Math.random() * SLAM_NAMES.length) | 0], 900);
        foe.down = 1.5 * (foe.cfg.getUp || 1);
        foe.air = 0.05; foe.airV = 7.5; foe.spin = 1;   // launched, then crashes down
      } else {
        SFX.punch(); S.shake = 0.18;
        if (Math.random() < 0.35) bigMsg(PUNCH_NAMES[(Math.random() * PUNCH_NAMES.length) | 0], 450);
      }
      // the boss gets angry when he is hurt
      if (BOSS && foe === B && !S.rage && foe.hp > 0 && foe.hp < foe.hpMax * 0.4) {
        S.rage = true;
        B.dmgMul *= 1.25;
        SFX.gong();
        bigMsg('KING SMASH IS ANGRY!', 1500);
      }
      if (foe.hp <= 0) finishMatch(me === A);
    } else {
      SFX.spin();
    }
  }

  function finishMatch(p1won) {
    if (S.over) return;
    S.over = true; S.ended = 0;
    SFX.bell(); SFX.cheer();
    var w = p1won ? A : B, l = p1won ? B : A;
    l.down = 999;
    confetti.burst(w.p.x, ringH + 2, w.p.z);
    var last = belt && beltIdx >= RIVAL_LIST.length - 1;
    if (belt && p1won) saveBelt(beltIdx + 1);

    bigMsg(!p1won ? (np === 2 ? 'P2 WINS!' : 'YOU LOSE!')
      : (last ? 'YOU ARE CHAMPION!' : 'YOU WIN!'), 2500);

    gameTimer(function () {
      var hpLeft = Math.round(w.hp / w.hpMax * 100);
      if (np === 2) {
        finish(p1won ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!',
          'The ' + w.cfg.name + ' won with <b>' + hpLeft + '%</b> health left.');
        return;
      }
      if (!p1won) {
        finish('SO CLOSE!',
          '<b>' + B.cfg.name + '</b> won this time. Get close, punch, then use the BIG SLAM!',
          { label: 'TRY AGAIN', fn: startGame });
        return;
      }
      if (!belt) {
        finish('YOU WIN!',
          'You beat <b>' + B.cfg.name + '</b>! You had <b>' + hpLeft + '%</b> health left.',
          { label: 'FIGHT AGAIN', fn: startGame });
        return;
      }
      if (last) {
        finish('CHAMPION!',
          'You beat all ' + RIVAL_LIST.length + ' wrestlers AND the BOSS. You are the champion!');
        return;
      }
      beltIdx++;
      finish('WINNER!',
        'Fight ' + beltIdx + ' of ' + RIVAL_LIST.length + ' done! Next up: <b>' + rivalOf(beltIdx).name + '</b>.',
        { label: 'NEXT FIGHT', fn: startGame });
    }, 2600);
  }

  function ctrl(f, foe, dir, doAtk, doSpec, dt) {
    if (f.down > 0) { f.down -= dt; dir = { x: 0, z: 0, len: 0 }; }
    if (f.stun > 0) { f.stun -= dt; dir = { x: 0, z: 0, len: 0 }; }
    f.atkCd = Math.max(0, f.atkCd - dt);
    f.specCd = Math.max(0, f.specCd - dt);
    f.anim = Math.max(0, f.anim - dt);

    var spd = 7.4 * f.cfg.speed;
    var ax = 30 * dt;
    f.v.x = lerp(f.v.x, dir.x * spd, clamp(ax, 0, 1));
    f.v.z = lerp(f.v.z, dir.z * spd, clamp(ax, 0, 1));
    f.p.x = clamp(f.p.x + f.v.x * dt, -RING + 0.9, RING - 0.9);
    f.p.z = clamp(f.p.z + f.v.z * dt, -RING + 0.9, RING - 0.9);
    f.v.multiplyScalar(1 - 2.2 * dt);

    // push apart
    var sep = new THREE.Vector3().subVectors(f.p, foe.p).setY(0);
    var dd = sep.length();
    if (dd < 1.5 && dd > 0.001) { sep.normalize(); f.p.addScaledVector(sep, (1.5 - dd) * 0.5); }

    // always face the opponent
    f.face.a = Math.atan2(foe.p.x - f.p.x, foe.p.z - f.p.z);

    // ready checks come first, so a press is only used up when the move can fire
    var canAct = f.stun <= 0 && f.down <= 0;
    if (canAct && f.atkCd <= 0 && doAtk()) { f.atkCd = 0.34; attack(f, foe, false); }
    if (canAct && f.specCd <= 0 && doSpec()) { f.specCd = 1.7; attack(f, foe, true); }

    // render
    if (f.air > 0 || f.airV !== 0) {
      f.airV -= 26 * dt;
      f.air += f.airV * dt;
      if (f.air <= 0) {
        f.air = 0; f.airV = 0;
        if (f.spin > 0) { f.spin = 0; SFX.thud(); S.shake = Math.max(S.shake, 0.35); }
      }
    }
    f.o.position.set(f.p.x, ringH + f.air, f.p.z);
    f.o.rotation.y = angleLerpW(f.o.rotation.y, f.face.a, 1 - Math.pow(0.0004, dt));
    var sp = Math.hypot(f.v.x, f.v.z);

    var u = f.o.userData;
    u.armLock = f.anim > 0;
    if (f.down > 0) {
      var flat = f.air > 0.05 ? -2.4 : -1.5;   // tumble in the air, flat on the mat
      u.body.rotation.x = lerp(u.body.rotation.x, flat, 1 - Math.pow(0.002, dt));
      u.body.position.y = lerp(u.body.position.y, 0, 1 - Math.pow(0.002, dt));
      u.armL.sh.rotation.x = lerp(u.armL.sh.rotation.x, 1.4, 0.2);
      u.armR.sh.rotation.x = lerp(u.armR.sh.rotation.x, 1.4, 0.2);
      u.legL.hip.rotation.x = lerp(u.legL.hip.rotation.x, 0.25, 0.2);
      u.legR.hip.rotation.x = lerp(u.legR.hip.rotation.x, -0.25, 0.2);
      u.legL.knee.rotation.x = lerp(u.legL.knee.rotation.x, -0.1, 0.2);
      u.legR.knee.rotation.x = lerp(u.legR.knee.rotation.x, -0.1, 0.2);
    } else {
      u.body.rotation.x = lerp(u.body.rotation.x, 0, 1 - Math.pow(0.002, dt));
      u.body.position.y = lerp(u.body.position.y, 0, 1 - Math.pow(0.002, dt));
      if (f.anim > 0) {
        var k = f.animType === 'slam' ? f.anim / 0.55 : f.anim / 0.28;
        var punch = Math.sin((1 - k) * Math.PI);
        if (f.animType === 'slam') {
          u.armL.sh.rotation.x = -2.3 * punch; u.armR.sh.rotation.x = -2.3 * punch;
          u.armL.sh.rotation.z = 0.5; u.armR.sh.rotation.z = -0.5;
          u.armL.el.rotation.x = -0.2; u.armR.el.rotation.x = -0.2;
          u.torso.rotation.x = 0.35 * punch;
        } else {
          u.armR.sh.rotation.x = -1.7 * punch; u.armR.sh.rotation.z = -0.12;
          u.armR.el.rotation.x = -0.1;
          u.armL.sh.rotation.x = 0.5 * punch; u.armL.el.rotation.x = -1.2;
          u.torso.rotation.y = -0.35 * punch;
        }
      } else {
        u.torso.rotation.y = lerp(u.torso.rotation.y, 0, 0.2);
        if (sp > 0.8) poseRun(f.o, sp, dt); else poseFightIdle(f.o, dt);
      }
    }
    if (f.blockT > 0) f.blockT -= dt;
  }
  function poseFightIdle(h, dt) {
    var u = h.userData;
    u.phase += dt * 3.4;
    var s = Math.sin(u.phase);
    u.legL.hip.rotation.x = lerp(u.legL.hip.rotation.x, 0.3, 0.2);
    u.legR.hip.rotation.x = lerp(u.legR.hip.rotation.x, -0.3, 0.2);
    u.legL.knee.rotation.x = lerp(u.legL.knee.rotation.x, -0.4, 0.2);
    u.legR.knee.rotation.x = lerp(u.legR.knee.rotation.x, -0.4, 0.2);
    u.armL.sh.rotation.x = lerp(u.armL.sh.rotation.x, -0.9 + s * 0.08, 0.2);
    u.armR.sh.rotation.x = lerp(u.armR.sh.rotation.x, -0.9 - s * 0.08, 0.2);
    u.armL.sh.rotation.z = lerp(u.armL.sh.rotation.z, 0.35, 0.2);
    u.armR.sh.rotation.z = lerp(u.armR.sh.rotation.z, -0.35, 0.2);
    u.armL.el.rotation.x = lerp(u.armL.el.rotation.x, -1.5, 0.2);
    u.armR.el.rotation.x = lerp(u.armR.el.rotation.x, -1.5, 0.2);
    u.torso.position.y = lerp(u.torso.position.y, 0.86 + s * 0.02, 0.2);
    u.torso.rotation.x = lerp(u.torso.rotation.x, 0.12, 0.2);
  }
  function angleLerpW(a, b, t) {
    var diff = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + diff * t;
  }

  function ai(dt) {
    S.aiT -= dt;
    S.aiRest = Math.max(0, (S.aiRest || 0) - dt);
    var dist = A.p.distanceTo(B.p);
    if (S.aiT <= 0) {
      var ag = AGG * (S.rage ? 1.3 : 1);
      S.aiT = rand(0.35, 0.9) / ag;
      var roll = Math.random();
      var pAtk = 0.34 * ag, pSlam = pAtk + 0.12 * ag;
      if (dist > 4) S.aiMode = 'approach';
      else if (roll < pAtk) S.aiMode = 'attack';
      else if (roll < pSlam) S.aiMode = 'slam';
      else if (roll < pSlam + 0.30) S.aiMode = 'circle';
      else S.aiMode = 'back';
    }
    var to = new THREE.Vector3().subVectors(A.p, B.p).setY(0);
    var d = to.length() || 1; to.divideScalar(d);
    var dir = { x: 0, z: 0, len: 0 };
    var atk = false, spec = false;
    if (S.aiMode === 'approach') { dir = norm(to.x, to.z); }
    else if (S.aiMode === 'back') { dir = norm(-to.x, -to.z); }
    else if (S.aiMode === 'circle') { dir = norm(-to.z, to.x); }
    else if (S.aiMode === 'attack') {
      if (dist > 2.1) dir = norm(to.x, to.z);
      else if (S.aiRest <= 0) { atk = B.atkCd <= 0; if (atk) S.aiRest = rand(0.5, 1.0) / (AGG * (S.rage ? 1.3 : 1)); }
    } else if (S.aiMode === 'slam') {
      if (dist > 2.5) dir = norm(to.x, to.z);
      else if (S.aiRest <= 0) { spec = B.specCd <= 0; if (spec) S.aiRest = rand(1.0, 1.8) / (AGG * (S.rage ? 1.3 : 1)); }
    }
    B.blockT = (S.aiMode === 'back' || S.aiMode === 'circle') ? 0.2 : 0;
    return { dir: dir, atk: atk, spec: spec };
  }

  function update(dt) {
    S.t += dt;
    var live = !S.over;
    var d1 = live ? axisP1() : { x: 0, z: 0, len: 0 };
    var a1 = function () { return live && P1.act(); };
    var s1 = function () { return live && P1.spec(); };
    var d2, a2, s2;
    if (np === 2) {
      d2 = live ? axisP2() : { x: 0, z: 0, len: 0 };
      a2 = function () { return live && P2.act(); };
      s2 = function () { return live && P2.spec(); };
    } else {
      var r = live ? ai(dt) : { dir: { x: 0, z: 0, len: 0 }, atk: false, spec: false };
      d2 = r.dir;
      a2 = function () { return r.atk; };
      s2 = function () { return r.spec; };
    }
    ctrl(A, B, d1, a1, s1, dt);
    ctrl(B, A, d2, a2, s2, dt);

    $('hp1').style.width = (A.hp / A.hpMax * 100) + '%';
    $('hp2').style.width = (B.hp / B.hpMax * 100) + '%';

    if (bossRing) {
      bossRing.position.x = B.p.x; bossRing.position.z = B.p.z;
      bossRing.material.color.setHex(S.rage ? 0xff3a1e : 0xffc23a);
      bossRing.material.opacity = 0.45 + Math.sin(S.t * (S.rage ? 11 : 4)) * 0.25;
      bossRing.visible = B.air < 0.4;
    }

    confetti.update(dt);

    // camera: TV hard-cam. Stays between the two near posts so they never block the view.
    var mid = new THREE.Vector3().addVectors(A.p, B.p).multiplyScalar(0.5);
    var sepD = A.p.distanceTo(B.p);
    var want = new THREE.Vector3(
      clamp(mid.x * 0.45, -2.0, 2.0),
      ringH + 5.6 + sepD * 0.14,
      9.6 + sepD * 0.4 + clamp(mid.z * 0.3, -1.5, 1.5)
    );
    camera.position.lerp(want, 1 - Math.pow(0.003, dt));
    if (S.shake > 0) {
      S.shake -= dt;
      camera.position.x += rand(-1, 1) * S.shake * 0.8;
      camera.position.y += rand(-1, 1) * S.shake * 0.6;
    }
    camera.lookAt(mid.x * 0.85, ringH + 1.1, mid.z * 0.75);
    key1.target.position.copy(mid);
  }

  return {
    scene: scene, camera: camera, update: update,
    dbg: function () {
      return {
        cam: camera.position.toArray().map(function (v) { return +v.toFixed(2); }),
        A: A.p.toArray().map(function (v) { return +v.toFixed(2); }),
        B: B.p.toArray().map(function (v) { return +v.toFixed(2); }),
        Avis: A.o.visible, Bvis: B.o.visible, RING: RING, ringH: ringH,
        hp1: +A.hp.toFixed(1), hp2: +B.hp.toFixed(1), hpMax2: B.hpMax,
        foe: c2.name, boss: BOSS, belt: belt, beltIdx: beltIdx, over: S.over
      };
    },
    dispose: function () {
      $('bars').classList.remove('on');
      $('scorebar').style.display = '';
      setTip('');
      disposeScene(scene);
    }
  };
}

// =================================================================
//                            SOCCER
// =================================================================
function makePitchTexture(PW, PL) {
  var SC = 1024 / PW;                 // pixels per metre, same on both axes
  var W = Math.round(PW * SC), H = Math.round(PL * SC);
  var c = document.createElement('canvas'); c.width = W; c.height = H;
  var g = c.getContext('2d');
  g.fillStyle = '#2d7a33'; g.fillRect(0, 0, W, H);
  var bands = 14;
  for (var i = 0; i < bands; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.065)';
    g.fillRect(0, i * H / bands, W, H / bands);
  }
  function X(m) { return (m + PW / 2) * SC; }
  function Z(m) { return (m + PL / 2) * SC; }
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 0.28 * SC;
  var in_ = 0.5;
  g.strokeRect(X(-PW / 2 + in_), Z(-PL / 2 + in_), (PW - in_ * 2) * SC, (PL - in_ * 2) * SC);
  g.beginPath(); g.moveTo(X(-PW / 2 + in_), Z(0)); g.lineTo(X(PW / 2 - in_), Z(0)); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 8.2 * SC, 0, TAU); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath(); g.arc(X(0), Z(0), 0.35 * SC, 0, TAU); g.fill();
  [-1, 1].forEach(function (e) {
    var edge = e * (PL / 2 - in_);
    g.strokeRect(X(-11), Z(edge), 22 * SC, -e * 12 * SC);      // penalty area
    g.strokeRect(X(-5), Z(edge), 10 * SC, -e * 5 * SC);        // 6 yard box
    g.beginPath(); g.arc(X(0), Z(edge - e * 8), 0.35 * SC, 0, TAU); g.fill();
  });
  var t = srgbTex(c);
  t.anisotropy = 8;
  return t;
}
function netTexture() {
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
  for (var i = 0; i <= 8; i++) {
    var p = i * 16;
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 128); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(128, p); g.stroke();
  }
  var t = srgbTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function Soccer(charKey, char2Key, np) {
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc4ea);
  scene.fog = new THREE.Fog(0x8fc4ea, 100, 280);

  var camera = new THREE.PerspectiveCamera(52, W / H, 0.5, 400);
  camera.position.set(0, 16, 40);

  scene.add(new THREE.HemisphereLight(0xcfe9ff, 0x2c5c30, 0.62));
  var sun = new THREE.DirectionalLight(0xfff3d8, 1.1);
  sun.position.set(40, 70, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sd = 70;
  sun.shadow.camera.left = -sd; sun.shadow.camera.right = sd;
  sun.shadow.camera.top = sd; sun.shadow.camera.bottom = -sd;
  sun.shadow.camera.far = 220;
  scene.add(sun); scene.add(sun.target);

  var PW = 52, PL = 84, HW = PW / 2, HL = PL / 2;
  var GW = 7.0;            // half width of the goal mouth
  var GH = 4.2;            // crossbar height
  var BR = 0.16;           // ball radius

  var pitch = new THREE.Mesh(new THREE.PlaneGeometry(PW, PL),
    new THREE.MeshStandardMaterial({ map: makePitchTexture(PW, PL), roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  var outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x1f5c26, 1));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true; scene.add(outer);

  var seats = [];
  [-1, 1].forEach(function (s) {
    seats = seats.concat(buildStand(scene, { axis: 'x', side: s, rows: 10, stepD: 1.7, stepH: 0.85, innerDist: HW + 4, y0: 0.4, length: PL + 20, seatGap: 2.1 }));
  });
  [-1, 1].forEach(function (s) {
    seats = seats.concat(buildStand(scene, { axis: 'z', side: s, rows: 8, stepD: 1.7, stepH: 0.85, innerDist: HL + 6, y0: 0.4, length: PW + 44, seatGap: 2.2 }));
  });
  makeCrowd(scene, seats);

  // ---- goals
  var nTex = netTexture();
  function buildGoal(side) {          // side -1 => goal at -z
    var g = new THREE.Group();
    var pm = mat(0xf2f4f8, 0.4);
    var frame = [];
    [-1, 1].forEach(function (s) {
      var post = cyl(0.18, 0.18, GH, pm, 12);
      post.position.set(s * GW, GH / 2, 0); g.add(post); frame.push(post);
    });
    var barMesh = cyl(0.18, 0.18, GW * 2, pm, 12);
    barMesh.rotation.z = Math.PI / 2; barMesh.position.y = GH; g.add(barMesh); frame.push(barMesh);
    var depth = 3.0;
    function net(w, h, px, py, pz, ry, rx) {
      var m = new THREE.MeshBasicMaterial({
        map: nTex.clone(), transparent: true, opacity: 0.7,
        side: THREE.DoubleSide, depthWrite: false
      });
      m.map.repeat.set(w / 1.6, h / 1.6); m.map.needsUpdate = true;
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.set(px, py, pz);
      mesh.rotation.y = ry || 0; mesh.rotation.x = rx || 0;
      g.add(mesh);
    }
    var back = side * depth;
    net(GW * 2, GH, 0, GH / 2, back);                        // back panel
    net(depth, GH, -GW, GH / 2, back / 2, Math.PI / 2);      // left side
    net(depth, GH, GW, GH / 2, back / 2, Math.PI / 2);       // right side
    net(GW * 2, depth, 0, GH, back / 2, 0, Math.PI / 2);     // roof
    g.position.set(0, 0, side * HL);
    frame.forEach(function (o) { o.castShadow = true; });
    scene.add(g);
    return g;
  }
  buildGoal(-1); buildGoal(1);

  var confetti = makeConfetti(scene);

  // bright ring under whoever has the ball, so it is easy to see
  var ownRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.62, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
  );
  ownRing.rotation.x = -Math.PI / 2;
  ownRing.position.y = 0.06;
  ownRing.visible = false;
  scene.add(ownRing);

  // ---- ball
  var ball = makeSoccerBall(); scene.add(ball);
  var bp = new THREE.Vector3(0, BR, 0);
  var bv = new THREE.Vector3();

  // ---- players
  var PS = 1.32;
  function mkPlayer(cfg, jersey, x, z, face) {
    var o = makeHuman(cfg, jersey);
    o.scale.setScalar(PS);
    scene.add(o);
    return {
      o: o, cfg: cfg, p: new THREE.Vector3(x, 0, z), v: new THREE.Vector3(),
      face: { a: face }, kickAnim: 0, cd: 0, noGrab: 0, trackX: 0,
      team: 0, human: false, keeper: false, role: 'chase',
      home: new THREE.Vector3(x, 0, z)
    };
  }
  var c1 = CHARS[charKey];
  var c2 = CHARS[np === 2 ? char2Key : CHAR_LIST[(CHAR_LIST.indexOf(charKey) + 1) % 3]];

  var p1 = mkPlayer(c1, 0x1f7fd0, 0, 8, Math.PI);          // attacks -z
  p1.team = 1; p1.human = true;
  var p2 = null;
  if (np === 2) { p2 = mkPlayer(c2, 0xc0182f, 0, -8, 0); p2.team = 2; p2.human = true; }

  var kA = mkPlayer(CHARS.soccer, 0xffd34d, 0, -HL + 1.2, 0);   // keeper for the -z goal
  kA.team = 2; kA.keeper = true;
  var kB = mkPlayer(CHARS.soccer, 0x2ae07d, 0, HL - 1.2, Math.PI); // keeper for the +z goal
  kB.team = 1; kB.keeper = true;
  var bots = [];
  if (np === 1) {
    var b1 = mkPlayer(c2, 0xc0182f, -8, -14, 0); b1.team = 2; b1.role = 'chase'; bots.push(b1);
    var b2 = mkPlayer(CHARS.wrestler, 0xc0182f, 8, -22, 0); b2.team = 2; b2.role = 'block'; bots.push(b2);
  }
  function everyone() {
    var a = [p1, kA, kB];
    if (p2) a.push(p2);
    return a.concat(bots);
  }

  var S = {
    phase: 'ready', t: 0, clock: 90,
    g1: 0, g2: 0, shake: 0,
    best: parseInt(localStorage.getItem('gs_soccer_best') || '0', 10),
    owner: null, loose: 0
  };

  setKeys(np === 2
    ? [['ARROWS', 'P1 run'], ['SPACE', 'P1 SHOOT'], ['E', 'P1 big kick'], ['I J K L', 'P2 run'], ['G', 'P2 SHOOT'], ['H', 'P2 big kick']]
    : [['ARROWS / WASD', 'run'], ['SPACE', 'SHOOT'], ['E', 'big kick'], ['SHIFT', 'sprint']]);

  function hud() {
    var cells = np === 2
      ? [['BLUE', S.g1, true], ['TIME', Math.max(0, Math.ceil(S.clock))], ['RED', S.g2, true]]
      : [['GOALS', S.g1, true], ['TIME', Math.max(0, Math.ceil(S.clock))], ['SAVED', S.g2], ['BEST', S.best]];
    setScorebar(cells);
  }
  hud();
  bigMsg('KICK OFF!', 1100);
  SFX.whistle();
  setTip(np === 2 ? 'The yellow ring shows who has the ball. Run to the far goal!'
    : (IS_TOUCH ? 'Get the ball. The ring means you have it. Tap SHOOT!'
      : 'Get the ball. The ring means you have it. Press SPACE to SHOOT!'));

  function kickoff(towards) {
    bp.set(0, BR, 0); bv.set(0, 0, 0);
    p1.p.set(0, 0, 8); p1.v.set(0, 0, 0);
    if (p2) { p2.p.set(0, 0, -8); p2.v.set(0, 0, 0); }
    kA.p.set(0, 0, -HL + 1.2); kB.p.set(0, 0, HL - 1.2);
    bots.forEach(function (b, i) { b.p.copy(b.home); b.v.set(0, 0, 0); });
    everyone().forEach(function (pl) { pl.noGrab = 0; pl.cd = 0; });
    bots.forEach(function (b) { b.noGrab = 1.4; });   // the kid gets first touch
    S.phase = 'ready'; S.t = 0;
    S.owner = null; S.loose = 0;
  }

  function goal(forP1) {
    if (S.phase !== 'live') return;
    S.phase = 'goal'; S.t = 0;
    if (forP1) S.g1 += 1; else S.g2 += 1;
    SFX.score(); SFX.cheer();
    S.shake = 0.5;
    confetti.burst(bp.x, 3, bp.z);
    bigMsg('G O A L !', 2000);
    if (np === 1 && S.g1 > S.best) { S.best = S.g1; localStorage.setItem('gs_soccer_best', String(S.best)); }
    hud();
  }

  function mv(pl, dir, speed, dt) {
    var ax = 42 * dt;
    pl.v.x = lerp(pl.v.x, dir.x * speed, clamp(ax, 0, 1));
    pl.v.z = lerp(pl.v.z, dir.z * speed, clamp(ax, 0, 1));
    pl.p.x = clamp(pl.p.x + pl.v.x * dt, -HW + 1, HW - 1);
    pl.p.z = clamp(pl.p.z + pl.v.z * dt, -HL - 2.4, HL + 2.4);
    var sp = Math.hypot(pl.v.x, pl.v.z);
    if (sp > 0.6) pl.face.a = Math.atan2(pl.v.x, pl.v.z);
    pl.o.position.set(pl.p.x, 0, pl.p.z);
    pl.o.rotation.y = angLerp(pl.o.rotation.y, pl.face.a, 1 - Math.pow(0.0006, dt));
    var u = pl.o.userData;
    if (pl.kickAnim > 0) {
      pl.kickAnim -= dt;
      var k = clamp(1 - pl.kickAnim / 0.3, 0, 1);
      u.armLock = true;
      u.legR.hip.rotation.x = -Math.sin(k * Math.PI) * 1.7;
      u.legR.knee.rotation.x = -0.15;
      u.legL.hip.rotation.x = 0.15;
      u.armL.sh.rotation.x = -1.0; u.armR.sh.rotation.x = 0.7;
      u.armL.sh.rotation.z = 0.5; u.armR.sh.rotation.z = -0.5;
      u.torso.rotation.x = -0.2 * Math.sin(k * Math.PI);
    } else {
      u.armLock = false;
      if (sp > 0.7) poseRun(pl.o, sp, dt); else poseIdle(pl.o, dt);
    }
    return sp;
  }
  function angLerp(a, b, t) {
    var diff = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return a + diff * t;
  }

  // kick the ball. A human shot aims into the open side of the goal, so a kid
  // can actually score. Facing still steers it a bit.
  function doKick(pl, towardZ, big) {
    pl.kickAnim = 0.3;
    var gk = towardZ < 0 ? kA : kB;
    var targetX = 0;
    if (pl.human) {
      var side = gk.p.x >= 0 ? -1 : 1;
      targetX = side * (GW - 1.5);
    }
    var aim = new THREE.Vector3(targetX - bp.x, 0, towardZ * (HL + 0.6) - bp.z).normalize();
    var facing = new THREE.Vector3(Math.sin(pl.face.a), 0, Math.cos(pl.face.a));
    aim.lerp(facing, pl.human ? 0.16 : 0.4).normalize();
    var power = big ? 24 : 34;
    bv.set(aim.x * power, big ? 9 : 2.6, aim.z * power);
    release(pl, 0.45);
    SFX.kick();
    bigMsg(big ? 'BIG KICK!' : 'SHOOT!', 550);
  }
  function clearBall(pl, towardZ) {
    pl.kickAnim = 0.3;
    var aim = new THREE.Vector3(rand(-0.6, 0.6), 0, towardZ).normalize();
    bv.set(aim.x * 12, 6, aim.z * 12);   // gentle, so the chase back is short
    release(pl, 0.6);
    SFX.kick();
  }
  // let go of the ball and stop the same player grabbing it straight back
  function release(pl, lock) {
    S.owner = null;
    S.loose = 0.12;
    pl.noGrab = lock;
  }

  function ballStep(dt) {
    if (S.owner) {                       // the ball sticks to whoever has it
      var o = S.owner;
      var f = new THREE.Vector3(Math.sin(o.face.a), 0, Math.cos(o.face.a));
      var tx = o.p.x + f.x * 0.85, tz = o.p.z + f.z * 0.85;
      var k = 1 - Math.pow(0.00002, dt);
      bp.x = lerp(bp.x, tx, k);
      bp.z = lerp(bp.z, tz, k);
      bp.y = BR;
      bv.set(0, 0, 0);
      ball.position.copy(bp);
      ball.rotation.x -= (o.v.z * dt) * 5;
      ball.rotation.z += (o.v.x * dt) * 5;
      return;
    }

    bv.y -= 24 * dt;
    bp.addScaledVector(bv, dt);
    if (bp.y < BR) {
      bp.y = BR;
      if (bv.y < -0.6) { bv.y = -bv.y * 0.5; SFX.thud(); } else bv.y = 0;
      var fr = 1 - 1.15 * dt;
      bv.x *= fr; bv.z *= fr;
    }
    if (Math.abs(bp.x) > HW - BR) { bp.x = (bp.x < 0 ? -1 : 1) * (HW - BR); bv.x *= -0.65; }
    var inMouth = Math.abs(bp.x) < GW - 0.25 && bp.y < GH - 0.25;
    if (bp.z < -HL + BR && !inMouth) { bp.z = -HL + BR; bv.z *= -0.65; }
    if (bp.z > HL - BR && !inMouth) { bp.z = HL - BR; bv.z *= -0.65; }
    if (bp.z < -HL - 3) { bp.z = -HL - 3; bv.z *= -0.4; }
    if (bp.z > HL + 3) { bp.z = HL + 3; bv.z *= -0.4; }

    ball.position.copy(bp);
    ball.rotation.x += bv.z * dt * 3.2;
    ball.rotation.z -= bv.x * dt * 3.2;

    if (S.phase === 'live') {
      if (bp.z < -HL - 0.5 && Math.abs(bp.x) < GW && bp.y < GH) goal(true);
      else if (bp.z > HL + 0.5 && Math.abs(bp.x) < GW && bp.y < GH) goal(false);
    }
  }

  // work out who is holding the ball. Human players get a much bigger reach so
  // the ball comes to them. A 5 year old must not have to line up perfectly.
  function possession(dt) {
    if (S.loose > 0) S.loose = Math.max(0, S.loose - dt);
    everyone().forEach(function (pl) { if (pl.noGrab > 0) pl.noGrab = Math.max(0, pl.noGrab - dt); });

    if (S.owner) {
      // an opponent standing on top of the owner steals it
      var thief = null;
      everyone().forEach(function (pl) {
        if (pl === S.owner || pl.team === S.owner.team || pl.noGrab > 0 || pl.keeper) return;
        var near = S.owner.human ? 1.0 : 1.3;     // bots must get right on top of the kid
        if (pl.p.distanceTo(S.owner.p) < near) thief = pl;
      });
      if (thief) {
        S.owner.noGrab = 0.5;
        S.owner = thief;
        SFX.catchit();
        bigMsg(thief.human ? 'BALL!' : 'TACKLE!', 650);
      }
      return;
    }
    if (S.loose > 0) return;

    var fast = Math.hypot(bv.x, bv.z);
    var best = null, bestScore = 1e9;
    everyone().forEach(function (pl) {
      if (pl.noGrab > 0) return;
      var reach = pl.human ? 2.3 : (pl.keeper ? (pl === kA && np === 1 ? 1.5 : 2.4) : 1.35);
      // only a keeper can pluck a hard shot out of the air
      if (fast > 17 && !pl.keeper) return;
      var d = Math.hypot(bp.x - pl.p.x, bp.z - pl.p.z);
      if (d > reach || bp.y > 2.4) return;
      var score = pl.human ? d - 1.2 : d;         // the human wins a tie
      if (score < bestScore) { best = pl; bestScore = score; }
    });
    if (best) {
      S.owner = best;
      if (best.keeper) {
        SFX.catchit();
        bigMsg('SAVE!', 800);
        if (np === 1 && best === kA) { S.g2 += 1; hud(); }
        best.cd = 0.7;                    // holds it, then boots it upfield
      } else if (best.human) {
        SFX.catchit();
      } else {
        best.cd = 0.6;                    // bots hold it a beat, so you can chase
      }
    }
  }

  // Keeper: stays on the line and slides across to block. Comes out only when
  // the ball is right on top of the goal.
  // Keeper: stays on the line and slides across to block. Comes out only when
  // the ball is right on top of the goal. The keeper the kid shoots at is a bit
  // slower and does not cover the whole mouth, so goals are possible.
  function keeper(k, defendZ, dt) {
    var easy = (np === 1 && k === kA);
    var lineZ = defendZ * (HL - 1.2);
    var dz = Math.abs(bp.z - lineZ);
    // the easy keeper reacts slowly, so a good shot beats it
    k.trackX = lerp(k.trackX, bp.x, 1 - Math.pow(easy ? 0.12 : 0.0005, dt));
    var wantX = clamp(k.trackX * (easy ? 0.75 : 1), -GW + 0.6, GW - 0.6);
    var wantZ = lineZ;
    if (dz < 6 && bp.z * defendZ > 0) wantZ = lineZ - defendZ * clamp(6 - dz, 0, 3);
    var ddx = wantX - k.p.x, ddz = wantZ - k.p.z;
    var dist = Math.hypot(ddx, ddz);
    var spd = easy ? 9 : 15;
    mv(k, dist > 0.3 ? norm(ddx, ddz) : { x: 0, z: 0, len: 0 }, dist > 0.3 ? spd : 0, dt);
    k.face.a = Math.atan2(bp.x - k.p.x, bp.z - k.p.z);
    if (k.cd > 0) {
      k.cd -= dt;
      if (S.owner === k && k.cd <= 0) clearBall(k, -defendZ);
    }
  }

  function botStep(b, dt) {
    if (b.cd > 0) b.cd -= dt;
    var tx, tz, spd;
    if (S.owner === b) {                       // got the ball: hold a beat, then hoof it
      if (b.cd <= 0) clearBall(b, 1);
      tx = b.p.x; tz = b.p.z; spd = 0;
    } else if (b.role === 'chase') {           // go at the ball, but not too fast
      tx = bp.x; tz = bp.z; spd = 9.0;
    } else {                                   // block: sit between the ball and the goal
      tx = bp.x * 0.6; tz = bp.z - 7; spd = 8.4;
      if (tz < -HL + 6) tz = -HL + 6;
    }
    var ddx = tx - b.p.x, ddz = tz - b.p.z;
    var dist = Math.hypot(ddx, ddz);
    var dir = dist > 0.8 ? norm(ddx, ddz) : { x: 0, z: 0, len: 0 };
    mv(b, dir, dist > 0.8 ? spd : 0, dt);
  }

  // keep the chasers from stacking into one blob
  function spread(dt) {
    var list = bots.concat(p2 ? [p2] : []);
    for (var i = 0; i < list.length; i++) {
      for (var j = i + 1; j < list.length; j++) {
        var a = list[i], b = list[j];
        var dx = a.p.x - b.p.x, dz = a.p.z - b.p.z;
        var d = Math.hypot(dx, dz);
        if (d < 2.6 && d > 0.0001) {
          var push = (2.6 - d) * 0.5;
          a.p.x += (dx / d) * push; a.p.z += (dz / d) * push;
          b.p.x -= (dx / d) * push; b.p.z -= (dz / d) * push;
        }
      }
    }
    list.forEach(function (pl) {
      pl.p.x = clamp(pl.p.x, -HW + 1, HW - 1);
      pl.p.z = clamp(pl.p.z, -HL - 2.4, HL + 2.4);
      pl.o.position.set(pl.p.x, 0, pl.p.z);
    });
  }

  function update(dt) {
    S.t += dt;
    if (S.phase === 'live') {
      S.clock -= dt;
      if (S.clock <= 0) { S.clock = 0; over(); return; }
    }
    if (S.phase === 'ready' && S.t > 0.7) { S.phase = 'live'; S.t = 0; }
    if (S.phase === 'goal' && S.t > 2.4) { kickoff(); }

    var live = S.phase === 'live';
    var d1 = live ? axisP1() : { x: 0, z: 0, len: 0 };
    var sp1 = 12.4 * c1.speed * (P1.sprint() ? 1.3 : 1);
    mv(p1, d1, d1.len ? sp1 : 0, dt);
    // read the buttons first so a press is never thrown away
    var shoot1 = live && P1.act(), big1 = live && P1.spec();
    if (S.owner === p1) {
      if (shoot1) doKick(p1, -1, false);
      else if (big1) doKick(p1, -1, true);
    }

    if (p2) {
      var d2 = live ? axisP2() : { x: 0, z: 0, len: 0 };
      var sp2 = 12.4 * c2.speed * (P2.sprint() ? 1.3 : 1);
      mv(p2, d2, d2.len ? sp2 : 0, dt);
      var shoot2 = live && P2.act(), big2 = live && P2.spec();
      if (S.owner === p2) {
        if (shoot2) doKick(p2, 1, false);
        else if (big2) doKick(p2, 1, true);
      }
    }

    keeper(kA, -1, dt);
    keeper(kB, 1, dt);
    if (live) bots.forEach(function (b) { botStep(b, dt); });
    else bots.forEach(function (b) { mv(b, { x: 0, z: 0, len: 0 }, 0, dt); });
    spread(dt);

    if (live) possession(dt);
    ballStep(dt);

    if (S.owner) {
      ownRing.visible = true;
      ownRing.position.set(S.owner.p.x, 0.06, S.owner.p.z);
      ownRing.material.color.setHex(S.owner.team === 1 ? 0xffe14d : 0xff5a5a);
    } else ownRing.visible = false;
    confetti.update(dt);

    // camera behind the action
    var fx = bp.x * 0.55, fz = bp.z;
    var want = new THREE.Vector3(fx, 13.5, fz + 22);
    if (S.phase === 'goal') want.set(bp.x * 0.5, 8, bp.z + 14);
    camera.position.lerp(want, 1 - Math.pow(0.004, dt));
    if (S.shake > 0) {
      S.shake -= dt;
      camera.position.x += rand(-1, 1) * S.shake * 0.8;
      camera.position.y += rand(-1, 1) * S.shake * 0.5;
    }
    camera.lookAt(bp.x * 0.5, 1.6, bp.z - 6);
    sun.target.position.set(bp.x, 0, bp.z);
    sun.position.set(bp.x + 40, 70, bp.z + 40);
    hud();
  }

  function over() {
    S.phase = 'over';
    SFX.whistle();
    var title, body;
    if (np === 2) {
      title = S.g1 === S.g2 ? 'A DRAW!' : (S.g1 > S.g2 ? 'BLUE WINS!' : 'RED WINS!');
      body = 'Blue <b>' + S.g1 + '</b> - <b>' + S.g2 + '</b> Red';
    } else {
      title = S.g1 > 0 ? 'GREAT GAME!' : 'TIME UP!';
      body = 'You scored <b>' + S.g1 + '</b> goal' + (S.g1 === 1 ? '' : 's') +
        '.<br>The keeper saved <b>' + S.g2 + '</b>.<br><br>Best ever: <b>' + S.best + '</b>';
    }
    gameTimer(function () { finish(title, body); }, 900);
  }

  return {
    scene: scene, camera: camera, update: update,
    dbg: { state: S, p1: p1, p2: p2, kA: kA, kB: kB, bots: bots, bp: bp, bv: bv },
    dispose: function () { setTip(''); disposeScene(scene); }
  };
}

// ---------------------------------------------------------------- dispose
function disposeScene(s) {
  s.traverse(function (o) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      var ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(function (m) {
        for (var k in m) { if (m[k] && m[k].isTexture && !numCacheHas(m[k])) m[k].dispose(); }
        m.dispose();
      });
    }
  });
}
function numCacheHas(t) { for (var k in numCache) if (numCache[k] === t) return true; return false; }

// ---------------------------------------------------------------- wire up UI
function wire() {
  $('b-play').onclick = function () { ac(); show('s-mode'); };
  $('b-how').onclick = function () { show('s-how'); };
  $('b-how-back').onclick = function () { show('s-title'); };
  $('b-mode-back').onclick = function () { show('s-title'); };
  $('b-football').onclick = function () { mode = 'football'; $('p2note').textContent = '2 players: Player 1 runs with the ball. Player 2 is the tackler with the red arrow.'; show('s-players'); };
  $('b-wrestle').onclick = function () { mode = 'wrestle'; $('p2note').textContent = '2 players: fight each other in the ring!'; show('s-players'); };
  $('b-soccer').onclick = function () { mode = 'soccer'; $('p2note').textContent = '2 players: Blue shoots one way, Red shoots the other way. Most goals wins!'; show('s-players'); };
  $('b-1p').onclick = function () {
    nPlayers = 1; pickingFor = 1;
    $('chartitle').textContent = 'PICK YOUR GUY';
    if (mode === 'wrestle') { showWMode(); return; }
    show('s-char');
  };
  $('b-2p').onclick = function () { nPlayers = 2; pickingFor = 1; $('chartitle').textContent = 'PLAYER 1: PICK YOUR GUY'; show('s-char'); };
  $('b-players-back').onclick = function () { show('s-mode'); };
  $('b-belt').onclick = function () { wSub = 'belt'; beltIdx = 0; show('s-char'); };
  $('b-pickrival').onclick = function () { wSub = 'pick'; show('s-char'); };
  $('b-wmode-back').onclick = function () { show('s-players'); };
  $('b-rival-back').onclick = function () { show('s-char'); };
  $('b-char-back').onclick = function () {
    pickingFor = 1;
    if (mode === 'wrestle' && nPlayers === 1) { showWMode(); return; }
    show('s-players');
  };
  $('b-again').onclick = function () {
    if (onAgain && onAgain.fn) { var f = onAgain.fn; onAgain = null; f(); return; }
    pickingFor = 1;
    $('chartitle').textContent = nPlayers === 2 ? 'PLAYER 1: PICK YOUR GUY' : 'PICK YOUR GUY';
    if (mode === 'wrestle' && nPlayers === 1) { showWMode(); return; }
    show('s-char');
  };
  $('b-menu').onclick = function () { toMenu(); };
  $('pause').onclick = function () { toMenu(); };
  window.addEventListener('keydown', function (e) { if (e.code === 'Escape' && current) toMenu(); });
}

// ---------------------------------------------------------------- boot
function boot() {
  if (typeof THREE === 'undefined') {
    document.getElementById('loading').textContent = 'COULD NOT LOAD 3D. Check three.min.js is next to index.html';
    return;
  }
  initGL();
  buildPreviews();
  wire();
  initTouch();
  show('s-title');
  $('loading').classList.add('hidden');
}
boot();

})();
