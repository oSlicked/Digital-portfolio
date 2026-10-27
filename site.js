/* Jordan Ioannoni — shared site behaviour */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const clamp = x => Math.min(1, Math.max(0, x));
  const root = document.documentElement;

  /* theme: remembered across all three tabs */
  try { const t = localStorage.getItem("ji-theme"); if (t) root.dataset.theme = t; } catch (e) {}
  const tg = $("#th");
  if (tg) tg.onclick = () => {
    const dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("ji-theme", root.dataset.theme); } catch (e) {}
    document.dispatchEvent(new Event("themechange"));
  };

  /* reveal on scroll + count ups */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in"); io.unobserve(e.target);
    e.target.querySelectorAll("[data-n]").forEach(c => {
      const to = +c.dataset.n, f = +(c.dataset.f || 0), t0 = performance.now();
      const st = t => { const u = clamp((t - t0) / 1700); c.textContent = Math.round(f + (to - f) * (1 - Math.pow(1 - u, 4))); if (u < 1) requestAnimationFrame(st); };
      requestAnimationFrame(st);
    });
  }), { threshold: .18 });
  $$(".rv,.wipe,.plate").forEach(e => io.observe(e));

  /* word by word statement */
  const wp = $("#wp"); let spans = [];
  if (wp) {
    const words = wp.textContent.trim().split(/\s+/);
    wp.replaceChildren(...words.map(w => { const s = document.createElement("span"); s.textContent = w + " "; return s; }));
    spans = [...wp.children];
    const q = wp.dataset.q; if (q) { const l = document.createElement("span"); l.className = "q"; l.textContent = q; wp.prepend(l); }
  }
  const prog = el => { const r = el.getBoundingClientRect(); return clamp(-r.top / (r.height - innerHeight)); };
  let tk = false;
  const tick = () => {
    tk = false;
    const sp = $("#sp"); if (sp) sp.style.transform = "scaleX(" + clamp(scrollY / (root.scrollHeight - innerHeight)) + ")";
    if (wp) { const n = Math.round(prog(wp.closest(".words")) * 1.3 * spans.length); spans.forEach((s, i) => s.classList.toggle("on", i < n)); }
  };
  addEventListener("scroll", () => { if (!tk) { tk = true; requestAnimationFrame(tick); } }, { passive: true });
  addEventListener("resize", tick); tick();

  /* smooth in page links */
  $$("a[href^='#']").forEach(a => a.addEventListener("click", ev => {
    const id = a.getAttribute("href").slice(1), t = id ? document.getElementById(id) : null;
    if (t) { ev.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
  }));

  /* gallery filters */
  const fl = $(".filters");
  if (fl) fl.addEventListener("click", e => {
    const k = e.target.dataset.k; if (!k) return;
    $$(".filters button").forEach(b => b.classList.toggle("on", b === e.target));
    $$(".it-g").forEach(t => t.classList.toggle("hide", k !== "all" && t.dataset.c !== k));
  });

  /* lightbox */
  const lb = $("#lb");
  if (lb) {
    let L = [], ix = 0;
    const show = () => { const t = L[ix]; $("#li").src = t.querySelector("img").src; $("#li").alt = t.querySelector("img").alt; $("#lc").textContent = t.dataset.t || ""; };
    const close = () => { lb.hidden = true; document.body.style.overflow = ""; };
    const step = d => { ix = (ix + d + L.length) % L.length; show(); };
    const open = t => { const g = t.dataset.g; L = $$(`[data-g="${g}"]:not(.hide)`); ix = L.indexOf(t); show(); lb.hidden = false; document.body.style.overflow = "hidden"; $("#lx").focus(); };
    document.addEventListener("click", e => { const t = e.target.closest("[data-g]"); if (t && !e.target.closest("#lb")) open(t); });
    document.addEventListener("keydown", e => {
      if (lb.hidden) { if (e.key === "Enter" && e.target.dataset && e.target.dataset.g) open(e.target); return; }
      if (e.key === "Escape") close(); if (e.key === "ArrowLeft") step(-1); if (e.key === "ArrowRight") step(1);
    });
    $("#lx").onclick = close; $("#lp").onclick = () => step(-1); $("#ln").onclick = () => step(1);
    lb.onclick = e => { if (e.target === lb) close(); };
    let sx = 0; lb.addEventListener("touchstart", e => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", e => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) step(d < 0 ? 1 : -1); });
  }

  /* contact buttons (page sets window.JI_CONTACT) */
  const C = window.JI_CONTACT; let topic = "";
  const note = t => { const n = $("#cn"); if (n) n.textContent = t; };
  if (C) {
    $$("[data-topic]").forEach(a => a.addEventListener("click", () => { topic = a.dataset.topic; note("Topic: " + topic + ". Tap Email me when you are ready."); }));
    const em = $("#em"); if (em) em.onclick = () => { location.href = "mailto:" + C.email + (topic ? "?subject=" + encodeURIComponent(topic) : ""); note("Opening your mail app. If nothing opens, tap Copy email."); };
    const cp = $("#cp"); if (cp) cp.onclick = async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(C.email); ok = true; } catch (e) { try { const a = document.createElement("textarea"); a.value = C.email; a.style.cssText = "position:fixed;opacity:0"; document.body.append(a); a.select(); ok = document.execCommand("copy"); a.remove(); } catch (e2) {} }
      cp.textContent = ok ? "Copied" : "Copy email"; note(ok ? C.email + " is on your clipboard." : "My email is " + C.email + ".");
    };
    const vc = $("#vc"); if (vc) vc.onclick = () => {
      const lines = ["BEGIN:VCARD", "VERSION:3.0", "FN:Jordan Ioannoni", "N:Ioannoni;Jordan;;;", "EMAIL:" + C.email].concat(C.tel ? ["TEL;TYPE=CELL:" + C.tel] : [], (C.urls || []).map(u => "URL:" + u), ["END:VCARD"]);
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/vcard" })); a.download = "Jordan-Ioannoni.vcf"; a.click();
      note("Contact card saved.");
    };
  }

  /* hand lettered signature, written on screen */
  const w = $("#sigw");
  if (w) {
    const cv = w.querySelector("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true });
    const img = new Image(); img.src = w.dataset.map || "sigmap.png";
    img.onload = () => {
      const W = img.width, H = img.height; cv.width = W; cv.height = H;
      ctx.drawImage(img, 0, 0); const src = ctx.getImageData(0, 0, W, H).data; ctx.clearRect(0, 0, W, H);
      const ink = [], tm = [], reg = [];
      for (let i = 0, n = W * H; i < n; i++) if (src[i * 4 + 3]) { ink.push(i); tm.push(((src[i * 4] << 8) | src[i * 4 + 1]) / 65535); reg.push(src[i * 4 + 2] > 127); }
      const ord = ink.map((_, k) => k).sort((a, b) => tm[a] - tm[b]);
      const out = ctx.createImageData(W, H), od = out.data, F = .025;
      const rgb = v => { const d = document.createElement("i"); d.style.color = v; document.body.append(d); const m = getComputedStyle(d).color.match(/\d+/g).map(Number); d.remove(); return m; };
      const paint = () => {
        const cs = getComputedStyle(root), a = rgb(cs.getPropertyValue("--ink")), b = rgb(cs.getPropertyValue("--accent"));
        for (let k = 0; k < ink.length; k++) { const i = ink[k], c = reg[k] ? b : a; od[i * 4] = c[0]; od[i * 4 + 1] = c[1]; od[i * 4 + 2] = c[2]; }
        ctx.putImageData(out, 0, 0);
      };
      paint();
      document.addEventListener("themechange", () => setTimeout(paint, 0));
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => setTimeout(paint, 0));
      let done = 0;
      const reveal = t => {
        while (done < ord.length && tm[ord[done]] <= t - F) { const i = ink[ord[done++]]; od[i * 4 + 3] = src[i * 4 + 3]; }
        for (let k = done; k < ord.length && tm[ord[k]] <= t; k++) { const j = ord[k], i = ink[j]; od[i * 4 + 3] = src[i * 4 + 3] * (t - tm[j]) / F; }
        ctx.putImageData(out, 0, 0);
      };
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { reveal(1 + F); return; }
      const D = 6000, ease = u => .5 - Math.cos(Math.PI * u) / 2; let t0 = 0;
      const frame = now => { if (!t0) t0 = now; const u = Math.min(1, (now - t0) / D); reveal(ease(u) * (1 + F)); if (u < 1) requestAnimationFrame(frame); };
      setTimeout(() => requestAnimationFrame(frame), 500);
    };
  }
})();
