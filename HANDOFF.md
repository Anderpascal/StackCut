# StackCut — Handoff de sesión (continuación)

> Documento de traspaso para que otro agente continúe en una sesión nueva.
> Fecha de la sesión: **2026-06-14**. Branch: `main`.

## 0. Qué es esto
StackCut: sitio **Astro 6 + React 19 + Tailwind 4** que ayuda a equipos B2B a recortar gasto en SaaS
(Downgrade Engine, Enterprise Tax, Negotiation Scripts, Stack Auditor, + calculadoras).
La **propuesta de valor es la credibilidad de los datos**: precios verificados a mano, análisis
determinista (sin IA), sin login. Por eso cualquier número incorrecto o promesa falsa es crítico.

Datos = **fuente única de verdad** en `src/content/saas/*.json` (57 productos). Todo lo demás
(blog, calculadoras, "worked examples") debe **derivar de ahí**, nunca hardcodear precios.

## 1. Comandos clave (verificación)
```bash
npm test                      # vitest — debe dar 207/207 verde
node scripts/validate-data.mjs  # validador de datos — exitCode 0 (errores), warnings OK
npx astro build               # build prod — 487 páginas, 0 errores
```
Node ≥ 22.12. Shell del entorno: PowerShell (primario) + Bash. Plataforma Windows.

## 2. Qué se hizo esta sesión (TODO aplicado y verificado)
Se partió de una auditoría profunda (4 ejes: valor, errores, profundidad, veracidad) y se
implementó **todo** vía 6 subagentes con ficheros disjuntos + trabajo de datos del coordinador.

**Code/copy (subagentes, ya mergeado):**
- **Blog**: corregido mojibake (69 `â€"`→`—`) en los 12 `.mdx`. Grep limpio.
- **NegotiationScriptGenerator.tsx**: bug de ahorro corregido (`savings × userCount` en las 9
  plantillas); `generateScript` exportada; tests nuevos en `src/__tests__/negotiation-script.test.ts`.
- **EnterpriseTaxCalculator.tsx**: eliminada la tesis FALSA "self-host OSS (Keycloak/Loki) para
  esquivar el SSO tax de un SaaS de terceros" (imposible: el vendor debe aceptar tu SAML, y eso
  es justo lo gateado). Reframe honesto "How to Reduce Your Enterprise Tax" + OSS solo para apps
  propias. Quitado el doble-conteo `(avoidableOverpayment + ossSavings)`. Manejado enterprise=null.
- **index.astro / README.md / SocialProof.tsx**: quitado "autonomous AI" (es verificación
  manual); "Savings on the books" → "Price spread (max−min tier)"; worked example de Notion ahora
  **se calcula del dataset** (= $3.600; antes $2.880 hardcodeado y obsoleto).
- **SaaSavingsCalculator.tsx / savings-calculator.astro**: sin precios hardcodeados (lee dataset);
  reposicionado como "estimación rápida" con disclaimers + embudo a /downgrade y /audit.
- **scripts/validate-data.mjs**: +4 reglas (claves JSON duplicadas, coherencia de add-ons,
  provenance, plan-ids duplicados) + `src/__tests__/validate-data.test.ts` (41 tests).

**Datos (coordinador, con verificación web USD y gateo manual):**
- `slack.json`: quitada clave `addOns` **duplicada** (el defecto original) + add-on Slack AI
  obsoleto (retirado ago-2025); "Enterprise Grid"→"Enterprise+"; precios confirmados OK.
- `zoom.json`: Pro anual `149.90`→`159.90` ($13.33/mo).
- `figma.json`: Professional `18/180`→`20/192`; Organization `54/540`→`55/660` (seat pricing 2025).
- `activecampaign.json`: "Professional $129"→"Pro $79" (rename de tier 2024).
- `saas-pricing-models-explained.mdx`: corregidas cifras que contradecían el dataset
  (Slack Business+, Notion Plus/Business, Salesforce, Figma).

## 3. ⚠️ GOTCHAS CRÍTICOS para verificar precios (LEER ANTES DE SEGUIR)
1. **WebFetch sale por IP de la zona EURO → devuelve precios en € (EUR).** NUNCA escribas un valor
   € como si fuera USD. Esto corrompería el dataset (es el error que casi se comete).
2. **WebSearch es US-only → devuelve USD.** Úsalo como fuente principal. Restringe con
   `allowed_domains: ["vendor.com"]` para precio autoritativo y limpio.
3. **El modelo pequeño del WebSearch a veces confunde monthly vs annual.** El campo `priceAnnually`
   en el JSON es el **total anual por asiento** (ej. $10/mo facturado anual ⇒ `120`). `priceMonthly`
   = tarifa de facturación mensual. Muchas herramientas: `priceAnnually` < `priceMonthly × 12`.
4. **ANTI-FABRICACIÓN (regla de oro):** si no hay precio USD autoritativo claro, **NO cambies nada**
   y deja constancia. Es mejor un dato algo viejo pero antes correcto que un "arreglo" inventado.
5. **El validador detecta claves JSON duplicadas** — si añades `priceNote`/`sourceUrl`/`capturedAt`
   a un plan, comprueba que el plan no los tenga YA más abajo (varios planes los tienen tras
   `isEnterprise`). Corre `node scripts/validate-data.mjs` tras cada tanda.
6. Al corregir un precio, añade `sourceUrl` + `capturedAt: "YYYY-MM-DD"` al plan y sube
   `lastVerified` del producto. Hazlo como **edición quirúrgica** (no reescribas el fichero).

## 4. Trabajo PENDIENTE (prioridad: verificación de precios)
El usuario quiere **precios USD reales de junio 2026 de cada plan de cada SaaS**. Prioriza USD,
**el mínimo de subagentes** posible (el usuario prefiere ir lento y gastar pocos tokens — hazlo tú
con WebSearch en oleadas pequeñas, no fan-out masivo).

**Worklist autoritativa:** corre `node scripts/validate-data.mjs` y mira los warnings
`data-provenance` — marcan exactamente los planes sin `sourceUrl/capturedAt` (= no re-verificados).

**Verificados YA CORRECTOS esta sesión (no tocar salvo nueva evidencia):**
slack, notion, zoom*, figma*, activecampaign*, asana, monday, airtable, clickup, intercom,
zendesk, salesforce, miro, gitlab, datadog, hubspot.  (* = se corrigieron)

**FLAGGED — pendiente histórico:**
- **jira**: RESUELTO 2026-06-14. atlassian.com confirma Standard $7.53 / Premium $13.53 (Atlassian
  bajó precios; el dataset tenía 7.75/15.25 = tarifa vieja). Actualizado monthly; annual = 12× monthly
  (convención del dataset, sin descuento anual confirmado). sourceUrl + capturedAt añadidos.
- **linear**: SIGUE FLAGGED. linear.app/pricing es JS y WebSearch no devuelve cifras. Tiene capturedAt
  pero priceMonthly=null (Basic 120/anual, Business 192/anual). Resolver a mano contra la página real.

**Progreso verificación 2026-06-14 (warnings data-provenance 39 → 12):**
- Verificados USD autoritativos + provenance esta sesión: jira, github (Team $4), vercel (Pro $20,
  monthly-only; nota vieja corregida), basecamp (Plus $15; Pro Unlimited $349 mes-a-mes / $299 anual,
  priceMonthly 299→349), gitlab (Premium $29), postmark (Basic $15), convertkit/kit (Creator $39 /
  Creator Pro $79), brevo (Starter $9 / Business $18).
- Provenance sellada desde verificación de sesión previa (capturedAt = su lastVerified, sin re-buscar,
  precios ya confirmados YA CORRECTOS): asana, airtable, notion, intercom, salesforce, hubspot,
  datadog (pro), activecampaign.
- Validador: regla `addon-price-incomplete` ahora exime add-ons usage-based (`unit:"per_unit"`) →
  resueltos los 2 warnings de gorgias (AI resolutions $0.90/ud). +1 test (208/208).

**Resueltos 2026-06-15 con datos pegados por el usuario (páginas reales):**
- **linear**: priceMonthly null→ Basic $10 / Business $16 (la página muestra precio per-user/month;
  el dataset decía erróneamente "annual-only"). Annual = 12× (sin descuento anual listado). Esto
  arregla además el bug de la página de downgrade (antes generaba una ruta basura por priceMonthly null).
- **help-scout**: precios viejos corregidos → Standard $30/$25anual, Plus $54/$45, Pro $90/$75 (anual −16%,
  priceAnnually = tarifa anual ×12). + provenance.
- **postmark**: MODELO CAMBIADO. Ya no son tiers por volumen ($15/$55/$105) sino tiers por features con
  overage por 1k: Basic $15, Pro $16.50, Platform $18 (ids `standard`→`pro`, `premium`→`platform`). + provenance.
- **sendgrid**: precios ya correctos ($19.95 / $89.95); añadido provenance + afinadas notas de volumen.

**CERRADO 2026-06-15 — 0 warnings data-provenance (las 131 tarifas de pago tienen sourceUrl + capturedAt):**
- **drip** ($39/$89/$154) y **mailchimp** ($13/$20/$350): el dueño confirmó que las cifras USA coinciden
  con el dataset → provenance sellada (sin cambiar números).
- **Tier 3** (17 productos: apollo-io, canva, chatwoot, height, loom, miro, missive, monday, monday-sales-crm,
  pipedrive, shortcut, streak, todoist, zendesk, zendesk-sell, zoho-crm, zoom): se rellenó `sourceUrl`=`pricingUrl`
  en sus planes (ya tenían `capturedAt`; NO re-verificados, solo se añadió el enlace de fuente).

**Tier 2 CERRADO 2026-06-15 (datos del dueño, bundles/uso):**
- **google-chat / google-meet**: precios Workspace CORREGIDOS (estaban altos) → Starter $7.20 flex / $6 anual
  ($72/yr), Standard $14.40 / $12 ($144), Plus $21.60 / $18 ($216). + sourceUrl + capturedAt.
- **microsoft-teams**: ya estaban bien (priceMonthly = flex m2m; priceAnnually = compromiso anual ×12 =
  72/150/264 → $6/$12.50/$22). Solo añadido sourceUrl + fecha. (Ojo: essentials ya tenía un sourceUrl
  específico tras capturedAt — se evitó clave duplicada.)
- **klaviyo**: Email $20 confirmado; nota ahora explicita la métrica (active profiles: $20≤500 / $60≤2.500 /
  $100≤5.000). + sourceUrl.
- **gorgias**: ya correcto ($10/$50/$300 por tickets, usuarios ilimitados). + sourceUrl + fecha.
- **netlify**: Pro $20 flat asientos ilimitados ya correcto. + sourceUrl + fecha.
- **new-relic**: data ingest CORREGIDO $0.40→$0.30/GB (addons + notas); full $99 / core $49 ya correctos. + sourceUrl.

**Estado: 0 errores, 0 warnings de validador (las 131 tarifas de pago tienen sourceUrl + capturedAt).**
Revisión opcional a futuro (ya con provenance, sin urgencia): Tier 4 con fecha algo vieja
(datadog, hubspot, intercom, capturados 01–07 jun) y planes de un solo proveedor no re-verificados
esta semana (precios estables, capturados <2026-06-13 por sesiones previas).

**Otros productos sin tocar (no estaban flagged ni tenían warning de provenance):**
apollo-io, attio, bitbucket, canva, chatwoot, close, coda, crisp, discord, freshdesk, freshsales,
front, google-chat, google-meet, height, klaviyo, loom, microsoft-teams, missive, monday-sales-crm,
netlify, new-relic, pipedrive, shortcut, streak, todoist, zendesk-sell, zoho-crm.

Notas por verificar: Teams/Google Chat/Google Meet suelen venir en bundles (M365/Workspace);
Discord no tiene pricing de equipo (Nitro es consumer); email tools (Brevo, ConvertKit, Drip,
Klaviyo, SendGrid, Postmark, Mailchimp) escalan por contactos/emails — registra la unidad;
Basecamp tiene plan flat (no per-seat); Height pivotó a producto IA (¿cambió el modelo?);
Gorgias tiene 2 warnings `addon-price-incomplete` por arreglar.

## 5. Otras pendientes (no de precios)
- (Opcional) Activar `STRICT_FRESHNESS=1` y resolver los 39 warnings de provenance.
- Blog: solo se corrigieron las cifras de `saas-pricing-models-explained.mdx`. Otros posts pueden
  citar precios viejos — revisar contra el dataset si se busca consistencia total.
- Decisión de producto ya tomada (no deshacer sin permiso): NO se borraron páginas redundantes
  (savings-calculator/roi) por SEO; se de-duplicó el DATO (leen del dataset) y se reencaminó.

## 6. Mapa rápido de ficheros
- Datos SaaS (verdad): `src/content/saas/*.json` · esquema zod: `src/content.config.ts` · tipos: `src/types/saas.ts`
- Stats home: `src/lib/stats.ts` (totalSpread = Σ(max−min plan), es SPREAD no ahorro)
- Categorías/silos: `src/lib/categories.ts` · features: `src/data/features-registry.ts`
- Herramientas (componentes React): `src/components/{DowngradeEngine,StackAuditor,EnterpriseTaxCalculator,NegotiationScriptGenerator,SaaSavingsCalculator,ROICalculator}.tsx`
- Validador: `scripts/validate-data.mjs` · Scraper opcional (necesita FIRECRAWL_API_KEY): `scripts/scrape-pricing.mjs`
- Tests: `src/__tests__/*.test.ts`

## 7. Estado al cerrar la sesión
✅ 207/207 tests · ✅ validador 0 errores (41 warnings informativos) · ✅ build 487 páginas ·
✅ 0 mojibake · sin scripts temporales. Listo para seguir con la verificación de precios pendiente.
