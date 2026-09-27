/* Vexon, métricas próprias (Supabase). Sem cookie, sem IP guardado.
   Abra qualquer página com ?eu=1 uma vez em cada aparelho seu para não contar as suas visitas.
   ?eu=0 volta a contar. */
(function () {
  "use strict";
  var ENDPOINT = "https://zowggcihzaeeczxczttt.supabase.co/rest/v1/eventos";
  var KEY = "sb_publishable_ryuSsjlhYEhIBvyCBgRQuw_-sYVlWQy";

  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }

  var q = new URLSearchParams(location.search);
  if (q.get("eu") === "1") gravar("vx_eu", "1");
  if (q.get("eu") === "0") gravar("vx_eu", null);
  if (ler("vx_eu") === "1") return;
  if (navigator.webdriver || /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|lighthouse/i.test(navigator.userAgent)) return;

  var vis = ler("vx_id");
  if (!vis) { vis = Math.random().toString(36).slice(2) + Date.now().toString(36); gravar("vx_id", vis); }

  var w = window.innerWidth || 0;
  var movel = /Mobi|Android|iPhone/i.test(navigator.userAgent);
  var disp = movel ? "celular" : (w && w < 1100 && /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : "computador");

  var ref = "";
  try { if (document.referrer) { var r = new URL(document.referrer); if (r.host !== location.host) ref = r.host.replace(/^www\./, ""); } } catch (e) {}

  var base = {
    pagina: location.pathname.slice(0, 200),
    ref: ref.slice(0, 300) || null,
    utm_source: (q.get("utm_source") || q.get("origem") || "").slice(0, 80) || null,
    utm_campaign: (q.get("utm_campaign") || "").slice(0, 80) || null,
    visitante: vis.slice(0, 40),
    dispositivo: disp,
    largura: Math.min(w, 10000)
  };

  function enviar(tipo, alvo) {
    var dados = {};
    for (var k in base) dados[k] = base[k];
    dados.tipo = tipo;
    dados.alvo = alvo ? String(alvo).slice(0, 120) : null;
    try {
      fetch(ENDPOINT, {
        method: "POST",
        keepalive: true,
        headers: { "apikey": KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify(dados)
      }).catch(function () {});
    } catch (e) {}
  }

  enviar("view", null);
  var m = location.pathname.match(/^\/pre\/([^\/]+)\/?/);
  if (m) enviar("proposta", m[1]);

  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    var h = a.getAttribute("href") || "";
    var tipo = /wa\.me|whatsapp/i.test(h) ? "whatsapp" : /^tel:/i.test(h) ? "telefone" : /^mailto:/i.test(h) ? "email" : null;
    if (!tipo) return;
    var rotulo = a.getAttribute("data-track") || (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    enviar("clique", tipo + ": " + rotulo);
  }, true);
})();
