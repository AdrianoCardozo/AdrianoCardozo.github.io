# Visualizer PS1 — quarto-estúdio

Visualizer em loop no estilo PlayStation 1: dois personagens num estúdio montado
no quarto, filmados por 4 câmeras de segurança nas quinas do teto, com cortes no
ritmo da batida. Os monitores de áudio, o LED do teto, as telas (DAW e
analisador), a TV de tubo e o neon reagem à música.

Efeitos de época: resolução 320×180, vértices tremendo, textura afim, cor de
15 bits com dithering, transparência pontilhada, animação travada.

## Prévia no navegador

Sirva a pasta (`npx serve .`), abra `index.html`, escolha o áudio e clique em
**tocar**. Os campos *Início*, *BPM* e *Compassos* definem o trecho que entra no loop.

## Exportar MP4

```bash
npm install
npx playwright install chromium
node render.mjs --audio hennessy.mp3 --inicio 2.084 --bpm 116 --compassos 8
```

| opção | padrão | |
|---|---|---|
| `--inicio` | 2.084 | segundo onde começa o trecho (cair num tempo 1) |
| `--bpm` | 116 | |
| `--compassos` | 8 | use múltiplos de 4 para o loop fechar a frase |
| `--vertical` | — | 1080×1920 para Reels/TikTok/Shorts |
| `--titulo` | — | texto no canto do HUD |
| `--repeticoes` | 1 | repete o loop N vezes no arquivo |
| `--saida` | visualizer-16x9.mp4 | |

O loop tem `compassos × 4 × 60 / bpm` segundos. A animação inteira é função do
tempo dentro do loop, e o último corte de câmera cai no tempo 1, então a emenda
não aparece.
