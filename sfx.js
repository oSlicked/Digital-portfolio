/* Sound effects and the "tap to enter" sound screen, shared by every page. */
(() => {
  if (window.SFX) return;
  let AC = null, on = true, ready = false;
  const waiting = [];
  try { on = localStorage.getItem("ji-snd") !== "0"; } catch (e) {}

  /* recorded sounds: Canon 1DX Mark II shutter and a pen signing paper */
  const RAW = {}, BUF = {};
  const decode = () => { if (!AC) return; for (const n in RAW) { const b = RAW[n]; if (!b) continue; RAW[n] = null; try { AC.decodeAudioData(b, d => { BUF[n] = d; }, () => {}); } catch (e) {} } };
  ["shutter", "pen"].forEach(n => { fetch("sfx/" + n + ".mp3").then(r => r.ok ? r.arrayBuffer() : null).then(b => { if (b) { RAW[n] = b; decode(); } }).catch(() => {}); });
  const play = (n, t, vol = 1, rate = 1) => {
    const s = AC.createBufferSource(), g = AC.createGain();
    s.buffer = BUF[n]; s.playbackRate.value = rate; g.gain.value = vol;
    s.connect(g).connect(AC.destination); s.start(t); return { s, g };
  };

  const ctx = () => {
    try {
      if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); decode(); }
      if (AC.state === "suspended") AC.resume();
    } catch (e) {}
    return AC;
  };
  const live = () => on && AC && AC.state === "running";
  const noise = (sec, curve) => {
    const n = Math.max(1, Math.floor(AC.sampleRate * sec)), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (curve ? Math.pow(1 - i / n, curve) : 1);
    return b;
  };
  const burst = (t, { len = .025, curve = 6, freq = 2500, q = .9, hp = 500, vol = .5 } = {}) => {
    const s = AC.createBufferSource(), f = AC.createBiquadFilter(), h = AC.createBiquadFilter(), g = AC.createGain();
    s.buffer = noise(len, curve); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    h.type = "highpass"; h.frequency.value = hp; g.gain.value = vol;
    s.connect(h).connect(f).connect(g).connect(AC.destination); s.start(t);
  };
  const thump = (t, vol = .22) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(55, t + .07);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + .08);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .1);
  };

  const SFX = {
    get on() { return on; },
    set on(v) { on = !!v; try { localStorage.setItem("ji-snd", on ? "1" : "0"); } catch (e) {} syncBtn(); if (on) ctx(); },
    unlock: ctx,
    /* runs fn(soundOn) once the visitor is through the sound screen */
    ready(fn) { if (ready) fn(on); else waiting.push(fn); },
    /* soft key or switch tick */
    tick(vol = .16) { if (!live()) return; burst(AC.currentTime, { len: .012, curve: 4, freq: 4800, q: 1.4, hp: 1500, vol }); },
    /* typewriter key */
    key(vol = .32) { if (!live()) return; burst(AC.currentTime, { len: .028, curve: 5, freq: 1700 + Math.random() * 1600, q: 1.1, hp: 300, vol }); },
    /* Canon 1DX style shutter: mirror up, curtain, mirror down. frames > 1 fires a 12 fps burst */
    shutter(frames = 1) {
      if (!live()) return;
      if (BUF.shutter) { for (let i = 0; i < frames; i++) play("shutter", AC.currentTime + .01 + i * (1 / 12), .9, .97 + Math.random() * .06); return; }
      for (let i = 0; i < frames; i++) {
        const t = AC.currentTime + .01 + i * (1 / 12);
        burst(t, { len: .02, curve: 7, freq: 2200, q: .8, hp: 400, vol: .55 });
        thump(t, .2);
        burst(t + .026, { len: .018, curve: 8, freq: 3600, q: 1, hp: 900, vol: .4 });
        burst(t + .05, { len: .03, curve: 6, freq: 1500, q: .7, hp: 250, vol: .35 });
      }
    },
    /* pen that follows the signature: call set(level 0 to 1) every frame with how fast ink is appearing, then stop() */
    penLive() {
      if (!live() || !BUF.pen) return null;
      const s = AC.createBufferSource(), g = AC.createGain(); let off = false;
      s.buffer = BUF.pen; s.loop = true; g.gain.value = 0;
      s.connect(g).connect(AC.destination); s.start();
      return {
        set(v) { if (!off) g.gain.setTargetAtTime(Math.min(1, Math.max(0, v)) * .55, AC.currentTime, .05); },
        stop() { if (off) return; off = true; g.gain.setTargetAtTime(0, AC.currentTime, .12); s.stop(AC.currentTime + .8); }
      };
    },
    /* pen on paper for ms milliseconds, louder in the middle of the stroke like the drawing speed */
    pen(ms) {
      if (!live()) return;
      const t0 = AC.currentTime, len = ms / 1000;
      const s = AC.createBufferSource(), h = AC.createBiquadFilter(), f = AC.createBiquadFilter(), g = AC.createGain();
      s.buffer = noise(2); s.loop = true;
      h.type = "highpass"; h.frequency.value = 1600; f.type = "bandpass"; f.Q.value = .8; f.frequency.value = 3800;
      g.gain.setValueAtTime(0, t0);
      for (let x = 0; x < len; x += .05) {
        const u = x / len, speed = Math.sin(Math.PI * u), lift = Math.random() < .07 ? 0 : 1;
        g.gain.linearRampToValueAtTime(speed * (.3 + .7 * Math.random()) * .2 * lift, t0 + x);
        f.frequency.setValueAtTime(3000 + Math.random() * 2400, t0 + x);
      }
      g.gain.linearRampToValueAtTime(0, t0 + len + .06);
      s.connect(h).connect(f).connect(g).connect(AC.destination); s.start(t0); s.stop(t0 + len + .15);
    }
  };
  window.SFX = SFX;

  /* styles for the sound screen and the speaker button */
  const css = document.createElement("style");
  css.textContent = `
#sgate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:rgba(6,10,21,.72);-webkit-backdrop-filter:blur(26px) saturate(140%);backdrop-filter:blur(26px) saturate(140%);color:#eef3ff;text-align:center;font-family:-apple-system,"SF Pro Display","Helvetica Neue",Helvetica,Arial,sans-serif;transition:opacity .7s,visibility .7s}
#sgate.out{opacity:0;visibility:hidden}
#sgate .in{max-width:520px;animation:sgi .9s cubic-bezier(.16,1,.3,1)}
@keyframes sgi{from{opacity:0;transform:translateY(30px) scale(.97)}}
#sgate .ic{width:84px;height:84px;margin:0 auto 22px;border-radius:26px;display:grid;place-items:center;background:linear-gradient(150deg,#5ee7ff,#3d7bff 55%,#9b6bff);box-shadow:0 20px 50px -15px rgba(94,231,255,.6)}
#sgate .ic svg{width:40px;height:40px}
#sgate .ic .w{animation:sgw 1.6s ease-in-out infinite}#sgate .ic .w2{animation-delay:.25s}
@keyframes sgw{50%{opacity:.25}}
#sgate .ey{margin:0 0 8px;color:#5ee7ff;font-weight:600;font-size:14px;letter-spacing:.06em;text-transform:uppercase}
#sgate h2{margin:0;font-size:clamp(34px,7vw,56px);line-height:1.05;letter-spacing:-.035em;font-weight:700}
#sgate p.s{margin:14px auto 28px;color:#9aa8c4;font-size:18px;max-width:400px}
#sgate button{font:inherit;cursor:pointer;border:0;border-radius:99px}
#sgate .go{font-size:18px;font-weight:600;padding:14px 30px;color:#05101f;background:linear-gradient(135deg,#5ee7ff,#3d7bff);box-shadow:0 12px 32px -10px rgba(94,231,255,.8),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .3s}
#sgate .go:hover{transform:scale(1.05)}
#sgate .no{display:block;margin:16px auto 0;padding:8px 14px;background:none;color:#9aa8c4;font-size:15px;text-decoration:underline;text-underline-offset:3px}
#snd{padding:3px 9px;line-height:0}#snd svg{width:14px;height:14px}
#snd[aria-pressed="false"] .wv{display:none}#snd[aria-pressed="true"] .x{display:none}
.vf{cursor:pointer}
.vf .flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:3}
.vf .flash.on{animation:fl .5s ease-out}
@keyframes fl{0%{opacity:.85}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){#sgate .in,#sgate .ic .w{animation:none}.vf .flash.on{animation:none}}`;
  document.head.append(css);

  const btn = () => document.getElementById("snd");
  function syncBtn() { const b = btn(); if (b) b.setAttribute("aria-pressed", on); }

  function finish(withSound) {
    on = withSound; try { localStorage.setItem("ji-snd", on ? "1" : "0"); sessionStorage.setItem("ji-gate", "1"); } catch (e) {}
    if (on) ctx();
    syncBtn(); ready = true;
    waiting.splice(0).forEach(fn => { try { fn(on); } catch (e) {} });
  }

  function gate() {
    let seen = false; try { seen = sessionStorage.getItem("ji-gate") === "1"; } catch (e) {}
    if (seen) {
      /* already chose this visit: start right away, sound unlocks on the first tap */
      ready = true;
      addEventListener("pointerdown", () => { if (on) ctx(); }, { once: true, capture: true });
      addEventListener("keydown", () => { if (on) ctx(); }, { once: true, capture: true });
      return;
    }
    const g = document.createElement("div");
    g.id = "sgate"; g.setAttribute("role", "dialog"); g.setAttribute("aria-modal", "true"); g.setAttribute("aria-labelledby", "sgt");
    g.innerHTML = '<div class="in"><div class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="#fff"/><path class="w" d="M15.5 8.5a5 5 0 0 1 0 7"/><path class="w w2" d="M19 5a10 10 0 0 1 0 14"/></svg></div>'
      + '<p class="ey">Jordan Ioannoni</p><h2 id="sgt">Turn your sound on.</h2>'
      + '<p class="s">This site is built to be heard. Pen strokes, shutter clicks and a few surprises.</p>'
      + '<button class="go" type="button">Enter with sound</button><button class="no" type="button">Enter without sound</button></div>';
    const close = withSound => {
      finish(withSound);
      g.classList.add("out"); document.documentElement.style.overflow = "";
      if (withSound) SFX.tick(.25);
      setTimeout(() => g.remove(), 800);
    };
    g.querySelector(".go").onclick = () => close(true);
    g.querySelector(".no").onclick = () => close(false);
    g.addEventListener("keydown", e => { if (e.key === "Escape") close(false); });
    document.documentElement.style.overflow = "hidden";
    document.body.prepend(g);
    setTimeout(() => g.querySelector(".go").focus({ preventScroll: true }), 50);
  }

  const wire = () => {
    gate();
    const b = btn();
    if (b && !b.hasAttribute("data-own")) {
      syncBtn();
      b.addEventListener("click", () => { SFX.on = !on; if (on) SFX.tick(.25); });
    }
    /* viewfinder in the hero: tap to fire a burst */
    const vf = document.getElementById("vf");
    if (vf) {
      const fl = document.createElement("i"); fl.className = "flash"; fl.style.cssText = "border:0;width:auto;height:auto"; vf.append(fl);
      vf.setAttribute("title", "Tap to shoot");
      vf.addEventListener("click", () => { ctx(); SFX.shutter(4); fl.classList.remove("on"); void fl.offsetWidth; fl.classList.add("on"); });
    }
    /* clicks around the page */
    document.addEventListener("click", e => {
      const t = e.target;
      if (t.closest("#lp,#ln")) SFX.shutter(1);
      else if (t.closest(".tile,.pf,.map")) SFX.shutter(1);
      else if (t.closest("#chips button,#th,#mb,#lx,.btn,#cp,#em,#vc")) SFX.tick();
    });
    document.addEventListener("keydown", e => {
      const lb = document.getElementById("lb");
      if (lb && !lb.hidden && (e.key === "ArrowLeft" || e.key === "ArrowRight")) SFX.shutter(1);
    });
  };
  if (document.body) wire(); else document.addEventListener("DOMContentLoaded", wire);
})();
