# Visualizer PS2 — quarto-estúdio

Visualizer em loop no estilo PlayStation 2: dois personagens num estúdio montado
no quarto, filmados por 4 câmeras nas quinas do teto, com cortes no ritmo da
batida. Os monitores de áudio, o LED do teto, as telas (DAW e
analisador), a TV de tubo e o neon reagem à música.

Visual: 1920×1080 a 60 qps, antisserrilhado, iluminação por pixel com 8 luzes
coloridas, brilho (bloom) nas luzes, texturas filtradas e personagens low-poly
com membros arredondados.

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
| `--fps` | 60 | |
| `--repeticoes` | 1 | repete o loop N vezes no arquivo |
| `--saida` | visualizer-16x9.mp4 | |

O loop tem `compassos × 4 × 60 / bpm` segundos. A animação inteira é função do
tempo dentro do loop, e o último corte de câmera cai no tempo 1, então a emenda
não aparece.
