# Visualizer stop-motion — quarto-estúdio

Visualizer em loop no estilo stop-motion com bonecos de ação (referência: o
clipe "90210", de Travis Scott). Dois bonecos num estúdio montado no quarto,
como uma maquete, filmados por 4 câmeras nas quinas do teto, com cortes no
ritmo da batida. O A fica meio deitado no sofá, fumando, olhando pro teto e
balançando a cabeça e o pé. O B fica no computador produzindo. Os monitores de áudio, o LED do teto, as telas (DAW e
analisador), a TV de tubo e o neon reagem à música.

Visual: 1920×1080 a 60 qps. A animação é "em uns" (24 poses/s, como nos longas
da Laika), com o leve desvio de cada pose feita à mão ("boil" determinístico nas
juntas, no cabelo e na corrente). Tem foco raso de miniatura, sombra da lâmpada
do teto, luzes de rosto motivadas, grão de película e oscilação de exposição
entre poses.

Atuação: o A balança a cabeça em meio-tempo (o groove do trap), quase para
quando leva o cigarro à boca e solta a fumaça nos closes; o B balança em todo
tempo, faz "cara de grave", ajeita os óculos, aperta teclas com dedos
diferentes e gira na cadeira pro A com a mão no ar. Braços e pernas usam IK de
dois ossos com polo interpolado (sem cotovelo virando), as curvas usam easing
senoidal e a fluidez é conferida pose a pose (velocidade/aceleração de cabeça,
mãos, cotovelos e pés) além de um teste de colisão entre bonecos e cenário.

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
