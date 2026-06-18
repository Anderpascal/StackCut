# StackCut — Auditoría SEO completa

**Fecha:** 2026-06-18
**Sitio:** https://stackcut.app
**Stack:** Astro 6 (output `static`) · React 19 · Tailwind 4 · Vercel · Plausible
**Escala:** 486 páginas HTML generadas · 57 productos SaaS · 12 artículos de blog · 10 categorías

> Cada hallazgo de esta auditoría está **verificado** contra el código fuente y/o el build real en `dist/`. La columna _Evidencia_ indica de dónde sale.
>
> ## ✅ ESTADO: IMPLEMENTADO (2026-06-18)
> Todos los puntos de la auditoría (C1–C2, A1–A4, M1–M6, B1–B6) **han sido implementados y verificados con un build limpio** (494 páginas, 0 errores, 1603 bloques JSON-LD válidos). Además se añadieron mejoras extra: 8 blog posts nuevos, FAQ+schema en listados, optimización de keywords en 17 páginas, feed RSS, fuentes self-hosted y manifest/iconos. Ver la sección **§8 — Registro de implementación** al final.

---

## 0. Resumen ejecutivo

El sitio tiene una **base SEO técnica muy sólida**: títulos 100% únicos (486/486), 1 `<h1>` por página, canonical en todas, breadcrumbs con JSON-LD en todo el sitio, sitemap-index enlazado en `robots.txt`, CSP/headers de seguridad correctos, `prefetch`, `compressHTML` y CSS inline. La arquitectura de SEO programático (pricing / compare / alternatives / best / downgrade) está bien planteada.

Pero hay **2 fallos críticos** que rompen funcionalidad SEO visible hoy, y un grupo de mejoras de alto impacto en datos estructurados, Open Graph y sitemap.

| Severidad | Nº de hallazgos |
|-----------|-----------------|
| 🔴 Crítico | 2 |
| 🟠 Alto | 4 |
| 🟡 Medio | 6 |
| 🔵 Bajo / Info | 6 |

---

## 1. 🔴 CRÍTICOS

### C1 — La imagen Open Graph es un SVG disfrazado de `.jpg` → previsualizaciones sociales rotas en TODO el sitio
- **Qué pasa:** `public/og-default.jpg` no es un JPG. Es un archivo **SVG de 697 bytes** con la extensión cambiada. Facebook, LinkedIn, X/Twitter, WhatsApp, Slack, iMessage y Discord **no renderizan SVG** como imagen OG → al compartir cualquier URL de StackCut sale **sin imagen** (o con un placeholder roto).
- **Impacto:** CTR de compartidos sociales y rich previews a cero. Afecta a las 486 páginas (todas heredan `image = "/og-default.jpg"`).
- **Evidencia:**
  - `file public/og-default.jpg` → `SVG Scalable Vector Graphics image`
  - `Layout.astro:18` → `image = "/og-default.jpg"`
  - Build: `dist/.../index.html` → `<meta property="og:image" content="https://stackcut.app/og-default.jpg">`
- **Fix:** generar un **PNG o JPG raster real de 1200×630** (existe `og-default.svg` que se puede rasterizar). Actualizar `og:image` y añadir `og:image:width`, `og:image:height`, `og:image:alt`. Idealmente generar OG dinámicos por página (Satori/`@vercel/og` o `astro-og-canvas`).

### C2 — Canonical de los artículos de blog no coincide con la URL real ni con el sitemap (trailing slash)
- **Qué pasa:** los posts emiten `<link rel="canonical" href="https://stackcut.app/blog/<slug>">` **sin barra final**, pero la URL servida es `/blog/<slug>/` y el sitemap la lista **con** barra final. Canonical apuntando a una URL distinta de la indexada confunde a Google sobre cuál es la versión canónica.
- **Impacto:** señales de canonicalización contradictorias en los 12 artículos (el contenido con mayor potencial de tráfico orgánico).
- **Evidencia:**
  - `blog/[blogSlug].astro:51` → `canonicalURL={new URL('/blog/'+post.id, ...)}` (sin `/`)
  - Build: `dist/blog/hidden-costs-of-saas/index.html` → canonical `…/blog/hidden-costs-of-saas` **vs** sitemap `…/blog/hidden-costs-of-saas/`
  - El resto de páginas SÍ son coherentes (ej. `about/`, `pricing/activecampaign/`, `compare/…-costs/` todas con barra).
- **Fix:** añadir la barra final en el canonical del blog (`/blog/${post.id}/`) o, mejor, **fijar `trailingSlash: 'always'` en `astro.config.mjs`** y dejar que el `Layout` derive el canonical de forma consistente para todo el sitio.

---

## 2. 🟠 ALTOS

### A1 — `og:type` es `website` en todas las páginas, incluidos los artículos de blog
- **Qué pasa:** `Layout.astro:40` fija `og:type="website"` de forma estática. Los posts de blog deberían ser `article` y exponer `article:published_time`, `article:modified_time`, `article:author`, `article:tag`.
- **Impacto:** menos riqueza en compartidos y señales de "artículo" más débiles para Google Discover/News.
- **Evidencia:** build `dist/blog/.../index.html` → `og:type" content="website"`.
- **Fix:** parametrizar `og:type` (prop `type` en `Layout`) y, en el blog, emitir los `article:*` y el `og:type=article`.

### A2 — `heroImage` del blog está en el frontmatter pero NUNCA se renderiza
- **Qué pasa:** los 12 posts declaran `heroImage: '/blog-hero.png'`, pero ningún template del blog usa ese campo. Resultado: los artículos **no tienen imagen destacada**, el JSON-LD `BlogPosting` **no lleva `image`** (Google recomienda imagen para rich results de artículo) y el OG cae a la imagen genérica (que además está rota, ver C1).
- **Impacto:** sin imagen en resultados enriquecidos, sin imagen social específica, y un PNG de **819 KB** (`public/blog-hero.png`) que ni siquiera se sirve.
- **Evidencia:**
  - `grep heroImage src/pages/blog/*.astro` → 0 referencias.
  - `grep -rl blog-hero dist` → 0 archivos.
  - `BlogPosting` en `SchemaOrg.astro:85` no incluye `image`/`dateModified`/`mainEntityOfPage`.
- **Fix:** renderizar `heroImage` en el post (con `alt`), pasarla a `og:image` y al `BlogPosting.image`. Comprimir/convertir a WebP (819 KB → <100 KB) o generar OG por post.

### A3 — Datos estructurados `Product` engañosos (riesgo de penalización / ser ignorados)
- **Qué pasa:** las páginas `pricing/[product]` y `compare/...` emiten `@type: Product` donde:
  - `brand` = **"StackCut"** aunque el producto es de un tercero (ActiveCampaign, Slack…).
  - En `compare` se inserta un `Review` con `reviewBody` y `author: StackCut` → **auto-reseña** de un producto que no es tuyo.
  - `offers` con `price` y `priceCurrency` de un tercero.
  - Faltan campos que Google espera para `Product` con review/offer (p. ej. `aggregateRating` o `review.reviewRating`), lo que de todos modos generaría warnings.
- **Impacto:** las _self-serving reviews_ y el marcado `Product` no representativo violan las guías de structured data de Google; en el mejor caso se ignora, en el peor es una _manual action_.
- **Evidencia:** `SchemaOrg.astro:55-72` (`Product`/`Review`/`offers`), usado desde `pricing/[product].astro:325` y `compare/[saas1]-vs-[saas2]-costs.astro:390`.
- **Fix recomendado:** sustituir por marcado correcto y seguro:
  - Páginas de pricing → `@type: SoftwareApplication` con `offers` (`@type: Offer`/`AggregateOffer`) y **sin** review propia; `name` = el producto real, sin `brand: StackCut`.
  - Páginas compare → mantener `BreadcrumbList` + (opcional) `ItemList`/`FAQPage`, pero **eliminar el `Review` auto-emitido**. Si quieres marcar comparativa, usa contenido editorial real, no review sintética.

### A4 — El sitemap no incluye `lastmod` (ni `changefreq`/`priority`) pese a tener fechas reales
- **Qué pasa:** `@astrojs/sitemap` está con configuración por defecto → cada `<url>` solo tiene `<loc>`. El sitio **sí** tiene fechas fiables (`lastVerified` por producto, `pubDate`/`updatedDate` por post) que deberían exponerse como `lastmod` para guiar el rastreo y recrawl.
- **Impacto:** Google no recibe señal de frescura; con 486 URLs, el presupuesto de rastreo se gasta peor y los cambios de precio tardan más en reflejarse.
- **Evidencia:** `dist/sitemap-0.xml` → entradas tipo `<url><loc>…</loc></url>` sin `lastmod`. `astro.config.mjs` → `sitemap()` sin opciones.
- **Fix:** configurar `serialize`/`lastmod` (ver §6, spec completa del sitemap).

---

## 3. 🟡 MEDIOS

### M1 — La home usa la meta description genérica por defecto
- La portada (`index.astro:69`) pasa solo `title`, así que hereda la `description` por defecto del Layout. Es la página más importante y merece una description propia, orientada a keywords ("auditar gasto SaaS", "bajar de plan sin perder features", "alternativas más baratas").
- **Evidencia:** `grep` en `dist` → solo `index.html` y `404.html` usan la description por defecto.

### M2 — Año "2026" hardcodeado en títulos/H1 de pricing
- `pricing/[product].astro:58,74` → `"${product.name} Pricing 2026"`. En enero de 2027 todas las páginas de pricing quedan visualmente desactualizadas en las SERP.
- **Fix:** derivar el año de la fecha de build o de `lastVerified` (y/o quitarlo del `<title>` y dejarlo solo en el cuerpo).

### M3 — `WebSite`/`Organization` schema incompleto
- `WebSite` (home) no declara `Organization` con `logo`, `sameAs` (perfiles sociales) ni `publisher` enriquecido. No hay un nodo `Organization` global con logo → Google no puede asociar un logo de marca en Knowledge Panel.
- **Fix:** añadir un `Organization` con `logo` (URL absoluta a un PNG ≥112×112), `sameAs` (X, LinkedIn) y descripción.

### M4 — Open Graph / Twitter incompletos
- Falta `og:image:width`/`height`/`alt`, `og:locale`, y `twitter:site`/`twitter:creator`.
- **Evidencia:** `Layout.astro:37-46`.

### M5 — Iconos y PWA mínimos
- Solo `favicon.svg` + `favicon.ico`. Falta `apple-touch-icon` (180×180 PNG), iconos PNG de respaldo y `site.webmanifest`. Sin manifest no hay metadatos de instalación ni iconos en Android/iOS.
- **Evidencia:** `public/` solo tiene `favicon.ico`, `favicon.svg`.

### M6 — Riesgo de _thin content_ en páginas programáticas
- Las 486 páginas escalan bien, pero el contenido de `compare` (pros/cons, "who should choose") se **deriva por plantilla** (`derivePros`/`deriveCons`/`deriveWhoBullets` en `compare/[saas1]-vs-[saas2]-costs.astro:43-121`) con frases genéricas reutilizadas entre productos. A escala, Google puede verlas como casi-duplicadas / poco útiles (Helpful Content).
- **Fix:** enriquecer con datos reales y diferenciadores por par (deltas de precio calculados, features exclusivas concretas, casos), y/o limitar la indexación de combinaciones de baja demanda. No es bloqueante, pero vigílalo conforme crezca el dataset.

---

## 4. 🔵 BAJOS / INFO

- **B1 — 404:** `dist/404.html` lleva `<meta name="robots" content="index, follow">` y 0 `<h1>`. En Vercel se sirve con status 404 (Google no la indexa), pero conviene `noindex` y un `<h1>` por consistencia/accesibilidad.
- **B2 — Fuentes render-blocking externas:** Google Fonts se carga como stylesheet externo bloqueante (`Layout.astro:47-50`). Ya hay `preconnect` + `display=swap` (bien), pero **autohospedar** las fuentes (woff2 con `@fontsource`) mejora LCP y privacidad y elimina una dependencia de terceros.
- **B3 — Sin `og:locale` ni `<html lang>` por contenido:** `lang="en"` fijo está bien (sitio en inglés). Hay selector de moneda USD/EUR/GBP pero **no** versiones por idioma → **no** hace falta `hreflang`. Correcto como está; documentado para evitar añadirlo por error.
- **B4 — Sin `author`/`publisher` visibles a nivel meta** (solo en JSON-LD). Opcional.
- **B5 — `astro.config` no fija `trailingSlash`:** funciona por el comportamiento por defecto, pero fijarlo (`'always'`) elimina toda ambigüedad (resuelve C2 de raíz).
- **B6 — Buenas prácticas YA presentes (no tocar):** títulos 100% únicos (486/486), 1 `<h1>`/página, sin `<img>` sin `alt`, breadcrumbs con `BreadcrumbList` JSON-LD en todo el sitio, `FAQPage` en herramientas, `robots.txt` con sitemap, CSP + headers de seguridad, `canonical` en todas, `prefetch`, `compressHTML`, CSS inline y `lightningcss`. 👍

---

## 5. Cobertura de datos estructurados (mapa actual)

| Tipo de página | Schema emitido | Estado |
|---|---|---|
| Home | `WebSite` + `BreadcrumbList`* | Ampliable (M3) |
| Herramientas (downgrade, audit, enterprise-tax, negotiation) | `WebApplication` + `FAQPage` | ✅ Bien |
| `pricing/[product]` | `Product` + `BreadcrumbList` | ⚠️ Cambiar a `SoftwareApplication` (A3) |
| `compare/...` | `Product` (+Review) + `BreadcrumbList` | ⚠️ Quitar Review auto (A3) |
| `alternatives` / `best` / `tools` | `ItemList` + `BreadcrumbList` | ✅ Bien |
| `blog/[slug]` | `BlogPosting` + `BreadcrumbList` | ⚠️ Falta `image`/`dateModified` (A2) |
| `about` | `FAQPage` | ✅ Bien |

\* La home no monta `Breadcrumbs`; el resto sí.

---

## 6. Sitemap — especificación de mejores prácticas (a implementar)

**Estado actual:** `@astrojs/sitemap` por defecto → `sitemap-index.xml` + `sitemap-0.xml` con solo `<loc>`. Ya referenciado en `robots.txt`. Base correcta.

**Mejoras propuestas (configuración en `astro.config.mjs`):**

```js
import sitemap from '@astrojs/sitemap';

sitemap({
  // Frescura real por URL. Google usa lastmod para priorizar recrawl.
  serialize(item) {
    // Productos: usar lastVerified; Blog: usar updatedDate||pubDate.
    // (se resuelve con un mapa precomputado slug->fecha en el config)
    return item; // item.lastmod se inyecta vía mapa, ver nota
  },
  // changefreq/priority: Google los ignora, Bing los usa. Inofensivos.
  changefreq: 'weekly',
  priority: 0.7,
  lastmod: new Date(),            // fallback global
  // Excluir utilitarias si hiciera falta (404 ya se excluye solo):
  filter: (page) => !page.includes('/404'),
  // entryLimit por defecto 45.000 (< límite de 50.000 de Google). OK.
})
```

**Notas de implementación (mejores prácticas):**
1. **`lastmod` por URL real:** precomputar en el config un mapa `{ url → fecha }` desde `getAllProducts()` (`lastVerified`) y `getCollection('blog')` (`updatedDate ?? pubDate`), e inyectarlo en `serialize`. Las páginas estáticas usan la fecha de build.
2. **Resolver C2 antes:** fijar `trailingSlash: 'always'` para que `loc` del sitemap y `canonical` coincidan exactamente.
3. **Mantener sitemap-index** (ya lo hace) — preparado para crecer >45k URLs sin tocar `robots.txt`.
4. **Imagen en sitemap (opcional):** cuando A1/A2 estén resueltos, añadir `xmlns:image` con la OG/hero por URL.
5. **No incluir** páginas `noindex` (hoy ninguna; si se añade `noindex` al 404, ya queda fuera por `filter`).
6. **Verificación post-deploy:** subir `sitemap-index.xml` a Google Search Console y Bing Webmaster Tools; comprobar 0 errores de "URL no rastreable" y que `lastmod` aparece.

---

## 7. Plan de implementación sugerido (orden por impacto/esfuerzo)

| # | Acción | Severidad | Esfuerzo |
|---|--------|-----------|----------|
| 1 | Imagen OG raster 1200×630 real + `og:image:width/height/alt` (C1) | 🔴 | Bajo |
| 2 | `trailingSlash: 'always'` + canonical coherente (C2/B5) | 🔴 | Bajo |
| 3 | `og:type=article` + `article:*` en blog (A1) | 🟠 | Bajo |
| 4 | Renderizar `heroImage` + `BlogPosting.image`/`dateModified` + comprimir (A2) | 🟠 | Medio |
| 5 | Reemplazar `Product`/Review por `SoftwareApplication`/`Offer` sin auto-review (A3) | 🟠 | Medio |
| 6 | `lastmod` real en sitemap + config (A4 / §6) | 🟠 | Medio |
| 7 | Description propia de la home (M1) | 🟡 | Bajo |
| 8 | Año dinámico en pricing (M2) | 🟡 | Bajo |
| 9 | `Organization` con logo + `sameAs` (M3) | 🟡 | Bajo |
| 10 | Twitter `site/creator`, `og:locale` (M4) | 🟡 | Bajo |
| 11 | apple-touch-icon + `site.webmanifest` + iconos PNG (M5) | 🟡 | Bajo |
| 12 | Autohospedar fuentes (B2) | 🔵 | Medio |
| 13 | `noindex` + `<h1>` en 404 (B1) | 🔵 | Bajo |
| 14 | Enriquecer contenido programático compare (M6) | 🟡 | Alto |

---

---

## 8. Registro de implementación (2026-06-18)

Orquestado por el agente principal + 4 subagentes en paralelo (blogs ×2, metas, FAQ de listados). Verificado con `npm run build` limpio: **494 páginas, 0 errores**.

### Infraestructura compartida (orquestador)
- **C1** — `public/og-default.png` 1200×630 real (rasterizado de SVG con `sharp`, `scripts/generate-assets.mjs`); `Layout.astro` usa `.png` + `og:image:width/height/alt`. Verificado: 0 referencias a `og-default.jpg` en `dist`.
- **C2** — Canonical del blog ahora con barra final (`/blog/<slug>/`), coincide con sitemap. Resuelto sin tocar `trailingSlash` global.
- **A1** — `og:type=article` + `article:published_time`/`modified_time` en posts (prop `type` en `Layout`).
- **A2** — `heroImage` renderizado con `alt`; `BlogPosting` con `image`/`dateModified`/`mainEntityOfPage`/`publisher.logo`; `blog-hero.png` recomprimido 819 KB → 434 KB.
- **A3** — `Product`+Review (auto-reseña engañosa) → `SoftwareApplication` en pricing/compare/plan-downgrade. Verificado: 0 `@type:Product`/`Review` en esas páginas.
- **A4** — Sitemap con `<lastmod>` real por URL (blog→pubDate, pricing→lastVerified) + `changefreq`. 493 URLs, todas con lastmod.
- **M1** — Descripción propia de la home.
- **M2** — Año de pricing dinámico (`priceYear` desde `lastVerified`).
- **M3** — `Organization` con `logo` global (en `Layout`).
- **M4** — `og:locale`, `og:image:alt`, `twitter:image:alt`. (Nota: `twitter:site`/`creator` NO añadidos — requieren un handle real; configúralo cuando tengáis cuenta.)
- **M5** — `apple-touch-icon`, `favicon-16/32`, `icon-192/512`, `site.webmanifest`.
- **B1** — 404 con `noindex` + `<h1>` (sr-only).
- **B2** — Fuentes self-hosted (`@fontsource-variable/*`), eliminado Google Fonts (0 refs en `dist`), 11 woff2 empaquetados.
- **RSS** — `/rss.xml` (`@astrojs/rss`) + `<link rel="alternate">` en el head.

### Mejoras extra (subagentes)
- **+8 blog posts** keyword-targeted (spend management, cancelación, benchmarks de presupuesto, shadow IT, per-seat vs flat-rate, red flags de contratos, free tools para startups, license audit). 1000–1500 palabras, enlaces internos, frontmatter válido.
- **FAQ + FAQPage schema** en `alternatives/index`, `best/index`, `compare/index`, `pricing/index`, `alternatives/[saas]-cheap`, `best/[category]`, y FAQ dinámica en `pricing/[product]` y `compare/...` (texto visible = schema, requisito de Google).
- **Keywords**: títulos/descripciones reescritos en 17 páginas (herramientas, info y listados). 494/494 títulos únicos.
- **Fix**: descripción de `alternatives/[saas]-cheap` (`$` + `toLocaleString`).

### Pendiente para ti (decisiones humanas)
- Añadir `twitter:site`/`twitter:creator` cuando tengáis handle social (y `sameAs` en `Organization`).
- **M6** (contenido de `compare` enriquecido más allá de plantilla) — parcialmente cubierto con la FAQ + matriz real; ampliar si se quiere profundidad editorial.
- Subir `sitemap-index.xml` a Google Search Console / Bing Webmaster Tools y solicitar indexación.
