# StackCut SaaS Audit — Session Log (2026-06-14)

> Resumen de la sesión en la que se cerró el backlog de auditoría de datos SaaS.

---

## 1. Estado al inicio de la sesión

- **Productos existentes:** 50 JSONs en `src/content/saas/`.
- **Productos pendientes de verificación profunda:** `chatwoot`, `zoho-crm`, `zoom`.
- **Productos de expansión pendientes:** `Klaviyo`, `Canva`, `Google Meet`, `Netlify`, `New Relic`, `Gorgias`, `Apollo.io`.
- **Validación:** verde (`node scripts/validate-data.mjs`, `npm test`, `npm run build`).

---

## 2. Verificación de los 3 productos pendientes

### `chatwoot.json`
- Se renombró el plan gratuito a **Hacker** (2 agentes gratis).
- Se añadieron los planes:
  - **Startups** — $19/agente/mo anual ($228/yr), incluye 300 créditos Captain AI.
  - **Business** — $39/agente/mo anual ($468/yr), incluye 500 créditos Captain AI.
  - **Enterprise** — $99/agente/mo anual ($1,188/yr), incluye 800 créditos Captain AI.
- Se añadió el add-on **Captain AI Credits** ($20 por 1,000 créditos adicionales).
- Se corrigió `freeTrialDays` a `15`.
- Se corrigió `openSourceAlternative.replaces` a `shared_inbox` para eliminar la advertencia del validador.

### `zoho-crm.json`
- Se añadió el plan **Ultimate** ($65/mo mensual, $52/mo anual = $624/yr).
- Se actualizaron precios:
  - Standard: $20/mo mensual / $168/yr anual.
  - Professional: $35/mo mensual / $276/yr anual.
  - Enterprise: $50/mo mensual / $480/yr anual.
- Se añadieron `priceNote` y `capturedAt` en cada plan.
- Se añadió `email_sequences` al plan Enterprise.

### `zoom.json`
- Se actualizaron precios:
  - **Pro** — $16.99/mo mensual / $149.90/yr anual.
  - **Business** — $21.99/mo mensual / $199.90/yr anual.
  - **Enterprise** — custom.
- Se añadió el add-on **Large Meetings** ($600/yr).
- Se documentó que **Zoom AI Companion** está incluido en los planes de pago.

---

## 3. Expansión: 7 nuevos productos creados

| Archivo | Categoría | Planes principales | Modelo de precio |
| --- | --- | --- | --- |
| `klaviyo.json` | Email Marketing | Free, Email ($20/mo), Email & SMS ($35/mo) | `per_month` (por tier de contactos) |
| `canva.json` | Design | Free, Pro ($15/mo), Teams ($30/mo), Enterprise (custom) | `per_month` |
| `google-meet.json` | Video Conferencing | Free, Business Starter ($8.40), Standard ($16.80), Plus ($26.40) | `per_user` |
| `netlify.json` | Dev Tools | Free, Personal ($9), Pro ($20), Enterprise (custom) | `per_month` |
| `new-relic.json` | Monitoring | Free, Standard ($99/user/mo), Pro ($418.80/user/mo), Enterprise (custom) | `custom` |
| `gorgias.json` | Customer Support | Starter ($10), Basic ($50), Pro ($300), Advanced ($750), Enterprise (custom) | `per_month` (por tickets) |
| `apollo-io.json` | CRM & Sales | Free, Basic ($59/mo), Professional ($99/mo), Organization ($149/mo), Custom | `per_user` |

Todos incluyen:
- `pricingUrl` canónica.
- `lastVerified` y `capturedAt` con fecha `2026-06-14`.
- `priceNote` explicando límites, facturación anual o modelos basados en uso.
- Add-ons relevantes (SMS credits, AI credits, data ingest, credit packs, etc.).
- `featureIds` del registro canónico y `proprietaryFeatures` donde correspondía.

---

## 4. Decisiones técnicas relevantes

- **Convención de precios mantenida:**
  - `priceMonthly` = mes a mes (el precio más alto).
  - `priceAnnually` = total anual pagado anualmente.
  - Si el precio es por uso/contactos/tickets/hosts, se usa `pricingModel: "custom"` o `"per_month"` con nota explicativa.
- Para productos con páginas de precios dinámicas (Apollo.io, Canva, Klaviyo) se usaron precios de lista públicos conocidos y se documentó la fuente o incertidumbre en `priceNote`.
- Se evitó duplicar feature IDs del registro canónico en `proprietaryFeatures`.
- Se añadió `transactional_email` a Klaviyo para cumplir la recomendación de tener al menos 1 *core feature*.

---

## 5. Validación final

Comandos ejecutados:

```bash
node scripts/validate-data.mjs
npm test
npm run build
```

Resultados:

```text
validate-data.mjs → 57 productos, 0 errores, 0 advertencias
npm test          → 151 tests passed, 7 test files passed
npm run build     → 487 páginas generadas correctamente
```

---

## 6. Archivos modificados / creados

### Modificados
- `src/content/saas/chatwoot.json`
- `src/content/saas/zoho-crm.json`
- `src/content/saas/zoom.json`
- `AUDIT_NEXT_STEPS.md`

### Creados
- `src/content/saas/klaviyo.json`
- `src/content/saas/canva.json`
- `src/content/saas/google-meet.json`
- `src/content/saas/netlify.json`
- `src/content/saas/new-relic.json`
- `src/content/saas/gorgias.json`
- `src/content/saas/apollo-io.json`
- `AUDIT_SESSION_LOG.md` (este archivo)

---

## 7. Estado al cerrar la sesión

- **Total de productos:** 57 JSONs.
- **Backlog de auditoría:** completo.
- **Próximas acciones sugeridas:**
  1. Refrescos periódicos de precios (recomendado antes de los 90 días de `lastVerified`).
  2. Añadir nuevos productos bajo demanda.
  3. Revisar la advertencia preexistente de `chatwoot` si se introduce un `featureId`/`proprietaryFeature` más semántico para *Chatwoot Cloud*.

---

*Sesión completada el 2026-06-14.*
