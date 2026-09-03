# Site da Vexon

Site institucional da Vexon — sites, lojas virtuais e sistemas web sob medida.
HTML, CSS e JavaScript puros, sem build e sem dependência: é só abrir o
`index.html` no navegador.

## Estrutura

```
index.html                     página única (todas as seções)
assets/
  style.css                    tokens de cor/tipografia + todos os componentes
  app.js                       comportamento (ver blocos numerados no arquivo)
  preview-*.png                miniaturas dos projetos
projetos/
  fibra/                       landing page de demonstração
  grao-vivo/                   página de venda de demonstração
  traco-arquitetura/           site institucional de demonstração (4 páginas)
  loja/                        loja Vitrine (gerada — ver abaixo)
```

## O que tem de interativo

Tudo em `assets/app.js`, em blocos numerados e independentes:

1. Ano automático no rodapé
2. Barra de progresso de rolagem + cabeçalho que muda ao rolar
3. Título do hero entrando palavra a palavra
4. Revelação dos blocos conforme entram na tela (`IntersectionObserver`)
5. Marquee de capacidades
6. Diagrama de arquitetura com pulsos percorrendo os fios (`getPointAtLength`)
7. Brilho dos cards de serviço seguindo o cursor
8. **Painel de demonstração**: troca de período com transição do gráfico,
   contadores animados, tooltip no gráfico e tabela ordenável
9. Destaque da etapa visível no processo
10. Paleta de comandos com `Ctrl/Cmd + K`

Tudo respeita `prefers-reduced-motion`.

## Publicar no GitHub Pages

O repositório `AdrianoCardozo.github.io` publica a raiz direto no domínio.
Suba o conteúdo desta pasta (não a pasta em si) para a raiz do repositório.

## Gerar a loja em `projetos/loja/`

A loja Vitrine é um projeto Next.js separado (pasta `drop/projeto`). Para
publicá-la dentro deste site:

```bash
cd caminho/para/drop/projeto
npm install
npm run build:site        # gera ./out com basePath /projetos/loja
```

Depois copie **o conteúdo de `out/`** para `projetos/loja/` aqui dentro.
Enquanto isso não for feito, o card "Vitrine" na seção de projetos aponta para
uma pasta que ainda não existe.

## Contato usado no site

- WhatsApp: (61) 99997-4323
- E-mail: `contato@vexon.dev` — **endereço fictício**, trocar quando o domínio
  for registrado. Aparece em `index.html` (seção de contato e rodapé) e em
  `assets/app.js` (paleta de comandos).
