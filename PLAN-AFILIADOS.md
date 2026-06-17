# Plan: Maximizar Links de Afiliado con Mínimo Esfuerzo

## Contexto

StackCut indexa **57 productos SaaS** pero solo **3 tienen links de afiliado reales** (Notion, Intercom, Crisp). Los otros 54 están vacíos (`affiliateUrl: null`).

---

## Estrategia: 3 pasos cubren ~80% de los productos

### Paso 1 — PartnerStack (el que más cubre)

**Registro único en:** `https://partnerstack.com`

PartnerStack es un marketplace de afiliados B2B. Con UNA sola cuenta accedes a **~35+ programas**:

| Categoría | Productos en PartnerStack |
|---|---|
| CRM | HubSpot, Pipedrive, Close, Freshsales, Monday Sales CRM, Zoho CRM (parcial) |
| Proyectos | Monday, ClickUp, Jira (Atlassian), Shortcut, Coda |
| Comunicación | Slack, Front, Missive, Discord (parcial) |
| Soporte | Zendesk, Intercom (ya lo tienes), Freshdesk, Help Scout, Crisp (ya lo tienes), Gorgias |
| Email Marketing | ActiveCampaign, Brevo, Drip, ConvertKit |
| Video | Zoom, Loom |
| Productividad | Notion (ya lo tienes vía Rewardful), Airtable, Todoist |
| Dev Tools | GitLab, Bitbucket |
| Diseño | Miro |
| Monitoring | Datadog, New Relic |

**~30-35 productos cubiertos con 1 solo registro.**

### Paso 2 — Impact Radius

**Registro en:** `https://impact.com`

Cubre los grandes que PartnerStack no tiene:

| Producto | Nota |
|---|---|
| Salesforce | El de mayor comisión potencial |
| Microsoft Teams / Microsoft 365 | Via Microsoft partner program |
| GitHub | Via GitHub partner program |
| Figma | Programa directo via Impact |
| Canva | Programa directo via Impact |
| Mailchimp (Intuit) | Via Impact |
| Atlassian (Jira, Bitbucket — alternativa) | También está en Impact |

**~6-8 productos adicionales cubiertos.**

### Paso 3 — Programas directos (in-house)

Los que justifican el registro individual por comisiones altas:

| Producto | URL de registro | Por qué vale la pena |
|---|---|---|
| Linear | `https://linear.app/affiliates` | Comisión recurrente alta, audiencia dev |
| Vercel | `https://vercel.com/partners` | Programa de partners |
| Netlify | `https://netlify.com/partners` | Programa de partners |
| Klaviyo | `https://klaviyopartnerprogram.smartpartners.co` | Ecommerce, comisiones altas |
| Height | `https://height.app/affiliates` | Nicho pero fácil |

**~5-7 productos adicionales.**

---

## Los que NO tienen programa de afiliados

- Google Meet / Google Chat — Google no ofrece affiliate program
- Postmark — ActiveCampaign (dueño) no tiene para Postmark
- SendGrid — Twilio (dueño) no ofrece afiliados
- Streak — No tiene
- Chatwoot — Open source, sin comisiones
- Basecamp — No tiene programa de afiliados tradicional

---

## Resumen

| Paso | Plataforma | Registros | Productos cubiertos |
|---|---|---|---|
| 1 | PartnerStack | 1 | ~30-35 |
| 2 | Impact Radius | 1 | ~6-8 |
| 3 | Directos (Linear, Vercel, Netlify, Klaviyo, Height) | ~5 | ~5-7 |
| **Total** | | **~7 registros** | **~45-48 de 57** |

El restante (~9-12 productos) simplemente no tiene programa de afiliados disponible.

---

## Orden de prioridad por revenue potencial

1. **PartnerStack** primero — cubre más productos, interfaz unificada, pagos consolidados
2. **Impact Radius** segundo — cubre los "elefantes" (Salesforce, Figma, Canva, Mailchimp, Microsoft)
3. **Directos** tercero — solo los que tienen comisiones >20% recurrentes

---

## Requisitos de registro

- **PartnerStack**: Website (stackcut.app), tax info (W-8BEN/W-9), PayPal o cuenta bancaria
- **Impact Radius**: Similar, proceso más corporativo, a veces piden tráfico mínimo
- **Directos**: Varía, la mayoría solo pide URL y método de pago

---

## Después de obtener los links

1. Reemplazar cada `affiliateUrl: null` en `src/content/saas/*.json` con el link real
2. Corre `npm run validate-data` para verificar que pasan la validación
3. Corre los tests: `npm test -- affiliates`
4. Deploy
