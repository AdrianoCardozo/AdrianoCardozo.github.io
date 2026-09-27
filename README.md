# Site da Vexon

Site da Vexon: sites, lojas virtuais e sistemas web sob medida, de Brasília.
HTML, CSS e JavaScript puros, sem build. Publicado no GitHub Pages em https://vexonsystem.com
(repositório `AdrianoCardozo/AdrianoCardozo.github.io`), pelo script `..\publicar.ps1`.

## Estrutura

```
index.html                 home (hero, oferta, serviços, painel demo, projetos, processo, FAQ)
404.html                   página de erro com botão de WhatsApp
site-pronto/               página de preços para lead de plataforma (GetNinjas, Instagram)
projetos/                  lista das demonstrações
  fibra/                   landing page (demo)
  grao-vivo/               página de venda (demo)
  traco-arquitetura/       institucional de 4 páginas (demo)
  loja/                    loja Vitrine, export estático do Next.js (pasta Desktop\drop\projeto)
  sistema-os/              painel de ordens de serviço com seletor de segmento (demo)
  sistema-oficina/         redirecionamento antigo para sistema-os
pre/                       propostas individuais (noindex, fora do sitemap)
metricas/                  painel de métricas, protegido por senha (noindex)
assets/
  style.css, app.js        estilo e comportamento da home
  m.js                     métricas próprias (Supabase, projeto vexon-metricas)
  demo.js                  faixa "isto é uma demonstração" e captura dos botões falsos das demos
```

## Métricas

`assets/m.js` grava visita, clique em WhatsApp/telefone/e-mail e abertura de proposta (`/pre/<slug>/`)
na tabela `eventos` do projeto Supabase `vexon-metricas`. Sem cookie e sem IP.
Abrir qualquer página com `?eu=1` deixa de contar as visitas daquele aparelho (`?eu=0` volta).
Toda página nova precisa da linha `<script src="/assets/m.js" defer></script>` antes de `</body>`.
Aviso no celular quando alguém abre uma proposta ou clica no WhatsApp: app ntfy, tópico guardado na memória do negócio.

## Contato usado no site

- WhatsApp: (61) 99997-4323
- E-mail: contato@vexonsystem.com
- Instagram: @vexonsystem
