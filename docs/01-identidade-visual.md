# Identidade visual — tokens extraídos de wiki.usecigadesign.com.br

Fonte: `https://wiki.usecigadesign.com.br/style.css` (lido em 2026-09-16). Reutilizar como `:root` do dashboard.

```css
:root {
  --bg:            #050505;
  --bg-alt:        #0a0a0a;
  --bg-card:       #0f0f0f;
  --bg-card-hover: #161616;

  --text:          #ffffff;
  --text-muted:    #a0a0a0;
  --text-subtle:   #555555;

  --gold:          #C9A962;   /* acento principal */
  --gold-light:    #E5D4A1;
  --gold-dim:      rgba(201, 169, 98, 0.10);
  --border-gold:   rgba(201, 169, 98, 0.25);

  --accent:        #2E7BC4;   /* azul secundário */
  --accent-light:  #4A9BE8;
  --accent-dim:    rgba(46, 123, 196, 0.12);

  --rose:          #c46d7a;   /* destaque terciário */
  --rose-dim:      rgba(196, 109, 122, 0.12);

  --border:        rgba(255,255,255,0.06);
  --radius:        4px;
  --transition:    0.35s cubic-bezier(0.4, 0, 0.2, 1);

  --font-display:           'CIGA Helvetica', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-display-condensed: 'CIGA Helvetica Condensed', 'CIGA Helvetica', sans-serif;
  --font-body:              'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
}
```

## Fontes

`@font-face 'CIGA Helvetica'` = Helvetica Neue LT Pro, arquivos hospedados no wiki em `manualMarca/fonts/`:

| Peso | Arquivo |
|---|---|
| 300 | `HelveticaNeueLTPro-Lt.otf` |
| 400 | `HelveticaNeueLTPro-Md.woff2` |
| 700 | `HelveticaNeueLTPro-Bd.otf` |
| 700 condensed | `HelveticaNeueLTPro-BdCn.otf` |

Fonte licenciada (Linotype). Pedir os arquivos ao cliente (ou copiar do wiki, que já é deles) e servir
localmente em `public/fonts/`. Fallback: Inter ou system sans, sem perda de leitura.

## Logo e assets

- `imagens/ciga-logo.png` e `imagens/favicon.png` no wiki. Wordmark "CIGA design" (CIGA em caixa alta, "design" em minúsculas).
- Fotos de produto por modelo em `<slug>/imagens/*.jpg|webp` — úteis como thumbnail na tabela de estoque/vendas por modelo.

## Como o wiki se comporta (para manter a mesma sensação)

- Fundo quase preto, cards um tom acima, bordas a 6% de branco. Sem sombras pesadas.
- Dourado usado com parcimônia: eyebrows de seção, números de destaque, bordas de hover.
- Tipografia display em caixa alta com tracking largo para rótulos de seção ("eyebrow"), corpo em peso leve.
- Cantos quase retos (4px). Transições suaves de 350ms.

## Adaptação para dashboard (dataviz sobre fundo escuro)

| Uso | Cor |
|---|---|
| Série principal (receita, gasto total) | `--gold` |
| Série de comparação (período anterior) | `--text-subtle` tracejado |
| Meta vs Google | `--accent` (Meta) · `--gold` (Google) — ou vice-versa, mas fixo |
| Positivo / negativo | verde discreto `#5FB77D` · vermelho `#D9534F` (apenas em deltas e alertas) |
| Estoque: ok · atenção · crítico | `--text-muted` · `--gold` · `#D9534F` |
| Grid dos gráficos | `rgba(255,255,255,0.06)` |
| Marcação "troca de plataforma" | linha vertical tracejada `--rose` com rótulo |
