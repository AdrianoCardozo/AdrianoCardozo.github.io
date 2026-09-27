/* Vexon, faixa das demonstrações: transforma os botões de contato falsos da demo em conversa real. */
(function () {
  "use strict";
  var me = document.currentScript;
  var nome = (me && me.getAttribute("data-nome")) || "esta demonstração";
  var tipo = (me && me.getAttribute("data-tipo")) || "site";
  var msg = "Olá, vi a demonstração " + nome + " no site da Vexon e quero um " + tipo + " assim pro meu negócio.";
  var link = "https://wa.me/5561999974323?text=" + encodeURIComponent(msg);

  var css = document.createElement("style");
  css.textContent =
    ".vx-faixa{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#0b0b0a;color:#ecebe3;border-top:2px solid #c7e356;" +
    "display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;padding:10px 14px;font:500 14px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".vx-faixa b{color:#c7e356}.vx-faixa a{background:#c7e356;color:#0d0f08;text-decoration:none;font-weight:700;padding:9px 14px;border-radius:6px;white-space:nowrap}" +
    ".vx-faixa a.vx-sec{background:transparent;color:#ecebe3;border:1px solid #36362e}" +
    "body{padding-bottom:64px}" +
    ".vx-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".vx-caixa{background:#161613;color:#ecebe3;border:1px solid #36362e;border-radius:12px;max-width:380px;padding:22px;font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".vx-caixa h3{margin:0 0 8px;font:700 1.15rem/1.25 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-transform:none;letter-spacing:0;color:#ecebe3}.vx-caixa p{margin:0 0 16px;color:#9b9a8f}" +
    ".vx-caixa a{display:inline-block;background:#c7e356;color:#0d0f08;font-weight:700;text-decoration:none;padding:11px 16px;border-radius:6px}" +
    ".vx-caixa button{background:none;border:0;color:#9b9a8f;margin-left:12px;cursor:pointer;font:inherit}";
  document.head.appendChild(css);

  var f = document.createElement("div");
  f.className = "vx-faixa";
  f.innerHTML = "<span>Isto é uma <b>demonstração</b> feita pela Vexon.</span>" +
    "<a href='" + link + "' target='_blank' rel='noopener' data-track='demo: quero um assim'>Quero um " + tipo + " assim</a>" +
    "<a class='vx-sec' href='/'>Ver a Vexon</a>";
  document.body.appendChild(f);

  function modal() {
    var m = document.createElement("div");
    m.className = "vx-modal";
    m.innerHTML = "<div class='vx-caixa' role='dialog' aria-modal='true'><h3>Esse botão é de demonstração</h3>" +
      "<p>No site de verdade ele abre o WhatsApp do seu negócio. Quer um " + tipo + " assim? A primeira tela sai em 2 dias e você só paga se gostar.</p>" +
      "<a href='" + link + "' target='_blank' rel='noopener' data-track='demo: modal'>Falar com a Vexon</a><button type='button'>Continuar vendo</button></div>";
    m.addEventListener("click", function (e) { if (e.target === m || e.target.tagName === "BUTTON") m.remove(); });
    document.body.appendChild(m);
  }

  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/5500000000000|5561999990000|exemplo\.com/.test(h)) { e.preventDefault(); modal(); }
  });
})();
