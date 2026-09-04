/* =========================================================================
   Vexon — comportamento do site
   Sem dependências externas. Cada bloco é independente e falha em silêncio
   se o elemento correspondente não existir na página.
   ========================================================================= */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------------------------------------------------------------------
     1. Ano no rodapé
     --------------------------------------------------------------------- */
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------------------
     2. Barra de progresso + cabeçalho fixo
     --------------------------------------------------------------------- */
  const progress = $("#progress");
  const header = $("#header");
  let ticking = false;

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (header) header.classList.toggle("is-stuck", window.scrollY > 12);
    ticking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    },
    { passive: true }
  );
  onScroll();

  /* ---------------------------------------------------------------------
     3. Título do hero: entrada palavra a palavra
     --------------------------------------------------------------------- */
  const heroTitle = $("#heroTitle");
  if (heroTitle && !reduceMotion) {
    let index = 0;

    const wrapWords = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part.trim()) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            const span = document.createElement("span");
            span.className = "word";
            span.textContent = part;
            span.style.animationDelay = `${index * 55}ms`;
            index += 1;
            frag.appendChild(span);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          wrapWords(child);
        }
      });
    };

    wrapWords(heroTitle);
  }

  /* ---------------------------------------------------------------------
     4. Revelação ao rolar
     --------------------------------------------------------------------- */
  const revealables = $$(".reveal");
  if (revealables.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealables.forEach((el) => el.classList.add("is-in"));
    } else {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry, i) => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            window.setTimeout(() => el.classList.add("is-in"), i * 70);
            io.unobserve(el);
          });
        },
        { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
      );
      revealables.forEach((el) => io.observe(el));
    }
  }

  /* ---------------------------------------------------------------------
     5. Marquee
     --------------------------------------------------------------------- */
  const marqueeTrack = $("#marqueeTrack");
  if (marqueeTrack) {
    const items = [
      "sistemas sob medida",
      "lojas virtuais",
      "landing pages",
      "painéis de gestão",
      "integrações de API",
      "automação de rotina",
      "relatórios automáticos",
      "sites institucionais",
    ];
    const line = items.map((t) => `<span>${t}</span>`).join("");
    marqueeTrack.innerHTML = line + line;
  }

  /* ---------------------------------------------------------------------
     6. Diagrama: pulsos percorrendo os fios
     --------------------------------------------------------------------- */
  const archSvg = $("#archSvg");
  const pulseLayer = $("#pulses");

  if (archSvg && pulseLayer && !reduceMotion) {
    const NS = "http://www.w3.org/2000/svg";
    const wires = ["w1", "w2", "w3", "w4", "w5", "w6"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const travellers = wires.map((wire, i) => {
      const dot = document.createElementNS(NS, "circle");
      dot.setAttribute("r", i > 2 ? "3" : "3.4");
      dot.setAttribute("class", i > 2 ? "pulse blue" : "pulse");
      pulseLayer.appendChild(dot);
      return {
        wire,
        dot,
        length: wire.getTotalLength(),
        offset: Math.random(),
        speed: 0.00022 + Math.random() * 0.00016,
      };
    });

    let running = true;
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(now - last, 60);
      last = now;
      if (running) {
        travellers.forEach((t) => {
          t.offset = (t.offset + t.speed * dt) % 1;
          const point = t.wire.getPointAtLength(t.offset * t.length);
          t.dot.setAttribute("cx", point.x.toFixed(2));
          t.dot.setAttribute("cy", point.y.toFixed(2));
          // some no início e no fim do trajeto
          const fade =
            Math.min(t.offset, 1 - t.offset, 0.14) / 0.14;
          t.dot.setAttribute("opacity", fade.toFixed(2));
        });
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);

    // pausa quando o diagrama sai da tela
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        running = entries[0].isIntersecting;
      }).observe(archSvg);
    }
  }

  /* ---------------------------------------------------------------------
     7. Cards de serviço: brilho seguindo o cursor
     --------------------------------------------------------------------- */
  $$(".service").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      card.style.setProperty("--my", `${event.clientY - rect.top}px`);
    });
  });

  /* ---------------------------------------------------------------------
     8. Painel de demonstração
     --------------------------------------------------------------------- */
  const DATA = {
    7: {
      kpis: [
        { label: "Pedidos", value: 38, kind: "int", delta: 6.2 },
        { label: "Faturamento", value: 12480, kind: "brl", delta: 9.4 },
        { label: "Ticket médio", value: 328, kind: "brl", delta: 3.1 },
        { label: "Em atraso", value: 2, kind: "int", delta: -33.3, invert: true },
      ],
      series: [1180, 1490, 1310, 2040, 1760, 2380, 2320],
      labels: ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"],
    },
    30: {
      kpis: [
        { label: "Pedidos", value: 164, kind: "int", delta: 11.8 },
        { label: "Faturamento", value: 54210, kind: "brl", delta: 14.2 },
        { label: "Ticket médio", value: 331, kind: "brl", delta: 2.2 },
        { label: "Em atraso", value: 6, kind: "int", delta: -12.5, invert: true },
      ],
      series: [3200, 3980, 3540, 4620, 4180, 5240, 4860, 5610, 5180, 6020, 5740, 6040],
      labels: ["1", "3", "6", "9", "12", "15", "18", "21", "24", "27", "29", "30"],
    },
    90: {
      kpis: [
        { label: "Pedidos", value: 471, kind: "int", delta: 22.4 },
        { label: "Faturamento", value: 158900, kind: "brl", delta: 26.9 },
        { label: "Ticket médio", value: 337, kind: "brl", delta: 3.7 },
        { label: "Em atraso", value: 11, kind: "int", delta: 8.1, invert: true },
      ],
      series: [9800, 11200, 10400, 13600, 12800, 15400, 14200, 17800, 16400, 19200, 18100, 20000],
      labels: ["jun", "", "jul", "", "", "ago", "", "", "set", "", "", "hoje"],
    },
  };

  const ORDERS = [
    { id: "#4192", cliente: "Marcenaria Cedro", valor: 2480.0, status: "pago", dias: 1 },
    { id: "#4191", cliente: "Clínica Vega", valor: 890.5, status: "processando", dias: 2 },
    { id: "#4188", cliente: "Padaria Trigo Bom", valor: 1340.0, status: "pago", dias: 3 },
    { id: "#4184", cliente: "Studio Cambará", valor: 4210.9, status: "atrasado", dias: 9 },
    { id: "#4180", cliente: "Auto Peças Norte", valor: 620.0, status: "pago", dias: 4 },
    { id: "#4177", cliente: "Vento Sul Imóveis", valor: 3150.0, status: "processando", dias: 6 },
    { id: "#4173", cliente: "Petshop Alecrim", valor: 275.4, status: "atrasado", dias: 12 },
    { id: "#4170", cliente: "Escola Lumière", valor: 1980.0, status: "pago", dias: 7 },
  ];

  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const brlCents = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const int = new Intl.NumberFormat("pt-BR");

  const kpisEl = $("#kpis");
  const chartLine = $("#chartLine");
  const chartArea = $("#chartArea");
  const chartX = $("#chartX");
  const chartWrap = $("#chartWrap");
  const chartMarker = $("#chartMarker");
  const chartGuide = $("#chartGuide");
  const chartTip = $("#chartTip");
  const ordersBody = $("#ordersBody");
  const panelStamp = $("#panelStamp");

  const CHART_W = 720;
  const CHART_H = 210;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 22;

  let currentPeriod = "30";
  let currentSeries = DATA[currentPeriod].series.slice();

  function pointsFor(series) {
    const max = Math.max(...series) * 1.08;
    const min = 0;
    const stepX = CHART_W / (series.length - 1);
    return series.map((value, i) => {
      const ratio = (value - min) / (max - min || 1);
      return {
        x: i * stepX,
        y: CHART_H - PAD_BOTTOM - ratio * (CHART_H - PAD_TOP - PAD_BOTTOM),
        value,
      };
    });
  }

  function pathFrom(points) {
    // curva suave (Catmull-Rom convertida em cúbica)
    if (points.length < 2) return "";
    let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function drawChart(series) {
    if (!chartLine || !chartArea) return;
    const points = pointsFor(series);
    const line = pathFrom(points);
    chartLine.setAttribute("d", line);
    chartArea.setAttribute(
      "d",
      `${line} L${CHART_W},${CHART_H - PAD_BOTTOM + 6} L0,${CHART_H - PAD_BOTTOM + 6} Z`
    );
  }

  function animateSeries(from, to, duration = 620) {
    if (reduceMotion) {
      currentSeries = to.slice();
      drawChart(currentSeries);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      currentSeries = to.map((target, i) => {
        const origin = from[i] ?? target;
        return origin + (target - origin) * eased;
      });
      drawChart(currentSeries);
      if (t < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  function animateNumber(el, to, kind, duration = 750) {
    const format = (v) =>
      kind === "brl" ? brl.format(Math.round(v)) : int.format(Math.round(v));
    if (reduceMotion) {
      el.textContent = format(to);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(to * eased);
      if (t < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  }

  function renderKpis(period) {
    if (!kpisEl) return;
    const { kpis } = DATA[period];
    kpisEl.innerHTML = kpis
      .map((k) => {
        const rising = k.delta >= 0;
        // em "Em atraso" subir é ruim: a cor segue o efeito, não o sinal
        const good = k.invert ? !rising : rising;
        const dir = good ? "up" : "down";
        const sign = rising ? "\u25b2" : "\u25bc";
        return `<div class="kpi">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value" data-value="${k.value}" data-kind="${k.kind}">0</div>
            <div class="kpi-delta ${dir}">${sign} ${Math.abs(k.delta).toFixed(1)}%</div>
          </div>`;
      })
      .join("");

    $$(".kpi-value", kpisEl).forEach((el) => {
      animateNumber(el, Number(el.dataset.value), el.dataset.kind);
    });
  }

  function renderLabels(period) {
    if (!chartX) return;
    const { labels } = DATA[period];
    chartX.innerHTML = labels.map((l) => `<span>${l}</span>`).join("");
  }

  /* -- tabela ordenável -- */
  let sortKey = "valor";
  let sortDir = "desc";

  function statusPill(status) {
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="pill ${status}">${label}</span>`;
  }

  function renderOrders() {
    if (!ordersBody) return;
    const rows = ORDERS.slice().sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const cmp =
        typeof va === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return sortDir === "asc" ? cmp : -cmp;
    });

    ordersBody.innerHTML = rows
      .map(
        (o) => `<tr>
          <td class="id">${o.id}</td>
          <td>${o.cliente}</td>
          <td class="num">${brlCents.format(o.valor)}</td>
          <td>${statusPill(o.status)}</td>
          <td class="num">${o.dias} ${o.dias === 1 ? "dia" : "dias"}</td>
        </tr>`
      )
      .join("");
  }

  $$("table.orders th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
      } else {
        sortKey = key;
        sortDir = key === "cliente" || key === "id" || key === "status" ? "asc" : "desc";
      }
      $$("table.orders th[data-sort]").forEach((other) => {
        other.setAttribute("aria-sort", "none");
      });
      th.setAttribute("aria-sort", sortDir === "asc" ? "ascending" : "descending");
      renderOrders();
    });
  });

  /* -- troca de período -- */
  $$(".seg button[data-period]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = btn.dataset.period;
      if (period === currentPeriod) return;
      $$(".seg button[data-period]").forEach((b) =>
        b.setAttribute("aria-pressed", String(b === btn))
      );
      const from = currentSeries.slice();
      const to = DATA[period].series;
      currentPeriod = period;
      // séries de tamanhos diferentes: reamostra a origem para o novo tamanho
      const resampled = to.map((_, i) => {
        const ratio = i / (to.length - 1);
        const idx = ratio * (from.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, from.length - 1);
        return from[lo] + (from[hi] - from[lo]) * (idx - lo);
      });
      animateSeries(resampled, to);
      renderKpis(period);
      renderLabels(period);
      stamp();
    });
  });

  /* -- tooltip do gráfico -- */
  if (chartWrap && chartMarker && chartGuide && chartTip) {
    chartWrap.addEventListener("pointermove", (event) => {
      const svg = $("#chart");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const rel = (event.clientX - rect.left) / rect.width;
      const series = DATA[currentPeriod].series;
      const idx = Math.max(0, Math.min(series.length - 1, Math.round(rel * (series.length - 1))));
      const points = pointsFor(series);
      const p = points[idx];

      chartMarker.setAttribute("cx", p.x);
      chartMarker.setAttribute("cy", p.y);
      chartGuide.setAttribute("x1", p.x);
      chartGuide.setAttribute("x2", p.x);
      chartGuide.setAttribute("y1", p.y);

      const wrapRect = chartWrap.getBoundingClientRect();
      const label = DATA[currentPeriod].labels[idx] || "";
      chartTip.innerHTML = `${label ? label + " \u00b7 " : ""}<b>${brl.format(p.value)}</b>`;
      chartTip.style.left = `${rect.left - wrapRect.left + (p.x / CHART_W) * rect.width}px`;
      chartTip.style.top = `${rect.top - wrapRect.top + (p.y / CHART_H) * rect.height}px`;
    });
  }

  function stamp() {
    if (!panelStamp) return;
    const now = new Date();
    panelStamp.textContent = `atualizado ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })} · período de ${currentPeriod} dias`;
  }

  if (kpisEl) {
    renderKpis(currentPeriod);
    renderLabels(currentPeriod);
    drawChart(currentSeries);
    renderOrders();
    stamp();

    // primeira animação do gráfico quando entra na tela
    if (!reduceMotion && "IntersectionObserver" in window) {
      const zero = DATA[currentPeriod].series.map(() => 0);
      drawChart(zero);
      const once = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          animateSeries(zero, DATA[currentPeriod].series, 900);
          once.disconnect();
        },
        { threshold: 0.25 }
      );
      once.observe(kpisEl);
    }
  }

  /* ---------------------------------------------------------------------
     9. Processo: destaque da etapa visível
     --------------------------------------------------------------------- */
  const steps = $$("#steps .step");
  if (steps.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-active", entry.isIntersecting);
        });
      },
      { rootMargin: "-25% 0px -25% 0px", threshold: 0.2 }
    );
    steps.forEach((step) => io.observe(step));
  }

  /* ---------------------------------------------------------------------
     10. Paleta de comandos (Ctrl/Cmd + K)
     --------------------------------------------------------------------- */
  const palette = $("#palette");
  const paletteInput = $("#paletteInput");
  const paletteList = $("#paletteList");
  const paletteOpenBtn = $("#paletteOpen");

  const COMMANDS = [
    { name: "Serviços", kind: "seção", href: "#servicos" },
    { name: "Demonstração ao vivo", kind: "seção", href: "#painel" },
    { name: "Projetos", kind: "seção", href: "#projetos" },
    { name: "Processo de trabalho", kind: "seção", href: "#processo" },
    { name: "Dúvidas frequentes", kind: "seção", href: "#duvidas" },
    { name: "Site pronto — preços a partir de R$ 1.200", kind: "página", href: "site-pronto/index.html" },
    { name: "Mecânica Rota Sul — oficina", kind: "projeto", href: "projetos/oficina/index.html" },
    { name: "Vitrine — loja virtual", kind: "projeto", href: "projetos/loja/index.html" },
    { name: "Traço Arquitetura — institucional", kind: "projeto", href: "projetos/traco-arquitetura/index.html" },
    { name: "Fibra Treinamento — landing page", kind: "projeto", href: "projetos/fibra/index.html" },
    { name: "Grão Vivo — página de venda", kind: "projeto", href: "projetos/grao-vivo/index.html" },
    { name: "Falar no WhatsApp", kind: "contato", href: "https://wa.me/5561999974323" },
    { name: "Enviar e-mail", kind: "contato", href: "mailto:contato@vexonsystem.com" },
  ];

  let paletteIndex = 0;
  let paletteMatches = COMMANDS.slice();

  const normalize = (text) =>
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function renderPalette() {
    if (!paletteList) return;
    if (!paletteMatches.length) {
      paletteList.innerHTML = `<li class="palette-empty" role="presentation">Nada encontrado</li>`;
      return;
    }
    paletteList.innerHTML = paletteMatches
      .map(
        (cmd, i) => `<li role="option" aria-selected="${i === paletteIndex}" data-href="${cmd.href}">
          <svg class="p-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="p-name">${cmd.name}</span>
          <span class="p-kind">${cmd.kind}</span>
        </li>`
      )
      .join("");
  }

  function filterPalette(query) {
    const q = normalize(query.trim());
    paletteMatches = q
      ? COMMANDS.filter((c) => normalize(`${c.name} ${c.kind}`).includes(q))
      : COMMANDS.slice();
    paletteIndex = 0;
    renderPalette();
  }

  function openPalette() {
    if (!palette) return;
    palette.classList.add("is-open");
    filterPalette("");
    if (paletteInput) {
      paletteInput.value = "";
      paletteInput.focus();
    }
  }

  function closePalette() {
    if (!palette) return;
    palette.classList.remove("is-open");
  }

  function runPalette() {
    const cmd = paletteMatches[paletteIndex];
    if (!cmd) return;
    closePalette();
    if (cmd.href.startsWith("#")) {
      const target = document.querySelector(cmd.href);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    } else if (cmd.href.startsWith("http") || cmd.href.startsWith("mailto")) {
      window.open(cmd.href, "_blank", "noopener");
    } else {
      window.location.href = cmd.href;
    }
  }

  if (palette) {
    paletteOpenBtn?.addEventListener("click", openPalette);
    paletteInput?.addEventListener("input", (e) => filterPalette(e.target.value));

    palette.addEventListener("click", (e) => {
      if (e.target === palette) closePalette();
    });

    paletteList?.addEventListener("click", (e) => {
      const li = e.target.closest("li[data-href]");
      if (!li) return;
      paletteIndex = Array.from(paletteList.children).indexOf(li);
      runPalette();
    });

    document.addEventListener("keydown", (e) => {
      const isOpen = palette.classList.contains("is-open");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        isOpen ? closePalette() : openPalette();
        return;
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        paletteIndex = Math.min(paletteIndex + 1, paletteMatches.length - 1);
        renderPalette();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        paletteIndex = Math.max(paletteIndex - 1, 0);
        renderPalette();
      } else if (e.key === "Enter") {
        e.preventDefault();
        runPalette();
      }
    });
  }
})();
