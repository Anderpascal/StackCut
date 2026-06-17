# Reporte de Exploración Técnica

## 1. Stack Tecnológico y Arquitectura General

- **Framework Principal**: Astro 6.4.2 (Static Site Generation, `output: 'static'` implícito).
- **Frontend Interactivo**: React 19.2.6 con JSX transform (`jsx: "react-jsx"`, `jsxImportSource: "react"`). Todos los componentes interactivos usan `client:load` en las páginas `.astro`.
- **Estilos**: Tailwind CSS v4.3.0 con el nuevo plugin `@tailwindcss/vite`. No usa `tailwind.config.js`; la configuración es puramente via CSS con `@import "tailwindcss"` y `@theme` en `src/styles/global.css`.
- **Tipado**: TypeScript estricto (`extends: "astro/tsconfigs/strict"`).
- **Contenido**: Astro Content Collections con loaders (`astro:content`, `glob`) y validación Zod en `src/content.config.ts`.
- **Datos**: **50 productos SaaS** en `src/content/saas/*.json` (ej. zoom, salesforce, slack, notion, github, bitbucket, microsoft-teams, etc.).
- **Moneda**: Sistema de multidivisa implementado en `src/lib/currency.ts` y `src/lib/currency-context.ts` con soporte para USD, EUR, GBP. Usa `Intl.NumberFormat`.
- **Node**: Requiere `>=22.12.0`.
- **Build**: `npm run build` (astro build), `npm run preview`, `npm run dev`.
- **Validación de datos**: Script custom Node ESM (`scripts/validate-data.mjs`) que valida JSONs contra reglas de negocio.
- **CI/CD**: GitHub Actions workflow (`agent-pipeline.yml`) que corre mensualmente para scrapear precios y rebuild.

### Estructura de Directorios Clave
```
src/
  components/          -> React (.tsx) y Astro (.astro) components
  layouts/             -> Layout.astro (root layout con global.css, meta tags)
  pages/               -> Astro pages (SSG), incluye rutas dinámicas como [saas]/
  content/
    saas/              -> JSON files (50 productos)
    blog/              -> MD/MDX files
  content.config.ts    -> Zod schemas para collections
  lib/                 -> Helpers (saas-data.ts, utm.ts, currency.ts, categories.ts)
  data/                -> features-registry.ts (feature canonical IDs)
  types/               -> saas.ts (interfaces TypeScript)
  styles/              -> global.css (Tailwind v4 + theme custom), print.css
scripts/
  validate-data.mjs    -> Validador de JSONs
  scrape-pricing.mjs   -> Script de scraping (agente autónomo)
```

---

## 2. Archivos Clave Relacionados con la Tarea

| Archivo | Rol en la tarea |
|---------|-----------------|
| `src/components/StackAuditor.tsx` | **Motor principal de auditoría de stack**. Contiene la función `analyzeStack` que detecta redundancias entre herramientas basándose en solapamiento de `featureIds`. Genera recomendaciones de texto y cálculo de ahorros potenciales. |
| `src/components/DowngradeEngine.tsx` | Motor de downgrade interno/externo. Recibe `products: SaaSProductData[]`. Analiza planes más baratos del mismo producto y alternativas en categorías relacionadas. |
| `src/data/features-registry.ts` | Registro canónico de 15 features comparables (`api_access`, `saml_sso`, `crm_basic`, etc.). Define categorías de feature (`core`, `security`, `integration`, `analytics`, `support`). |
| `src/lib/categories.ts` | Mapa `RELATED_CATEGORIES` que define qué categorías de SaaS son relacionadas para búsqueda de alternativas. También define `CATEGORY_ORDER` para renderizado. |
| `src/content.config.ts` | Schema Zod de la colección `saas`. Define la estructura de datos que alimenta todos los motores. |
| `src/content/saas/*.json` | Base de datos de productos. 50 JSONs con planes, precios mensuales/anuales, `featureIds`, `proprietaryFeatures`. |
| `src/types/saas.ts` | Interfaces TypeScript que tipan los props de los componentes React. Incluye `StackAuditResult`, `SaaSProductData`, `SaaSPlanData`. |
| `src/lib/saas-data.ts` | Helpers para cargar productos desde Astro content collections (`getCollection('saas')`). Expone `getAllProducts()`, `getAlternatives()`, `getRelatedComparisons()`. |
| `src/pages/audit.astro` | Página que renderiza `StackAuditor` con `client:load` y pasa `allProducts`. |
| `src/pages/downgrade.astro` | Página que renderiza `DowngradeEngine` con `client:load`. |
| `src/lib/currency.ts` | Sistema de multidivisa con tasas hardcodeadas (USD, EUR, GBP) y formateo con `Intl.NumberFormat`. |
| `src/lib/currency-context.ts` | React Context para compartir estado de moneda entre componentes. |

---

## 3. Convenciones de Código y Patrones Detectados

### Estilos (Tailwind v4 + Custom CSS)
- **Tailwind v4**: Se importa via `@import "tailwindcss"` en `global.css`. No hay `tailwind.config.js`.
- **Custom Theme**: Define colores y fuentes bajo `@theme`:
  ```css
  --font-mono: 'JetBrains Mono', ...;
  --color-bg-primary: #09090b;
  --color-accent: #34d399;
  --color-danger: #f87171;
  ```
- **Componentes CSS custom**:
  - `.card-blur`: fondo translúcido con backdrop-filter y borde sutil.
  - `.btn-primary`: botón con fondo accent (emerald) y glow en hover.
  - `.section-padding`: padding responsive predefinido.
- **Naming de clases**: Se mezclan clases de Tailwind (ej. `className="max-w-5xl mx-auto"`) con las custom (ej. `className="card-blur rounded-xl p-6"`).

### Componentes React
- **Props tipadas**: Cada componente recibe `products: SaaSProductData[]` como prop principal.
- **Hooks**: Uso extensivo de `useState`, `useMemo`, `useCallback`.
- **Renderizado condicional**: Patrón común de empty states con íconos de `lucide-react`.
- **Client-side hydration**: Todos los componentes interactivos se montan con `client:load` desde Astro.
- **Patrón Provider**: `CurrencyProvider` envuelve componentes para compartir estado de moneda. `StackAuditor` y `DowngradeEngine` usan este patrón.

### Nomenclatura de archivos
- Componentes React: PascalCase (ej. `StackAuditor.tsx`)
- Páginas Astro: kebab-case (ej. `audit.astro`)
- JSONs de datos: kebab-case (ej. `microsoft-teams.json`)
- Types/interfaces: PascalCase con sufijo `Data` (ej. `SaaSProductData`, `SaaSPlanData`)

### Patrón de Datos
- Astro Content Collections (`astro:content`) cargan los JSONs en build time.
- `src/lib/saas-data.ts` expone `getAllProducts()`, `getProductBySlug()`, etc.
- Los componentes React reciben los datos ya hidratados como props; no hacen fetching en runtime.

---

## 4. Estrategia de Pruebas

**Estado actual**: **No hay suite de tests automatizados.**
- No se encontraron archivos `*.test.*`, `*.spec.*`, ni configuraciones de Jest, Vitest, Cypress o Playwright.
- La única validación automatizada es el script `npm run validate` (`scripts/validate-data.mjs`), que verifica:
  - JSONs parseables
  - Placeholders en `affiliateUrl`
  - Referencias de `featureIds` contra el registro hardcodeado
  - Unicidad de `featureIds` vs `proprietaryFeatures`
  - Staleness de `lastVerified` (>90 días warning)
  - Sanidad de planes (al menos 1 plan, no null prices en no-enterprise)
  - Realismo de precios (no negativos, no < $1 warning)
  - Consistencia de precios (priceAnnually no debe exceder priceMonthly * 12)
  - Slugs duplicados

**Para probar localmente los componentes React**, el flujo es:
1. `npm run dev` (levanta el dev server de Astro)
2. Navegar a `/audit`, `/downgrade`
3. Interactuar manualmente con los selectores y verificar cálculos

**Recomendación**: Si se desea agregar tests, la opción más natural sería **Vitest** (ya Astro lo usa internamente) o **Playwright** para test E2E de los motores interactivos.

---

## 5. Deuda Técnica o Inconsistencias Relevantes

### A. Validador Hardcodeado
`scripts/validate-data.mjs` tiene una copia hardcodeada de los `featureIds` del registro en lugar de importar dinámicamente `features-registry.ts`. Esto significa que si se agrega una nueva feature al registro, el validador puede dejar de detectar errores hasta que se actualice manualmente.

### B. Duplicación de Lógica de Categorías Relacionadas
El mapa `RELATED_CATEGORIES` está centralizado en `src/lib/categories.ts`, lo cual es correcto. Sin embargo, `DowngradeEngine.tsx` importa correctamente desde allí, pero la lógica de relación es simple y podría necesitar refinamiento (ej. pesos por relevancia).

### C. Tipado Inconsistente en `features-registry.ts` vs `content.config.ts`
- `features-registry.ts`: `RegistryFeature.comparable` es `true` (literal).
- `content.config.ts`: `SaasFeatureSchema` tiene `comparable: z.literal(false)`.
- Esto parece un diseño intencional: las `proprietaryFeatures` en los JSONs deben tener `comparable: false`, mientras que el registro define features comparables. Sin embargo, es confuso que no haya un schema Zod para el registro mismo.

### D. Uso de `any` y Castings
- `AffiliateLink.tsx`: `(window as any).plausible`
- No hay `.eslint` o `tsconfig` que lo prohíba explícitamente.

### E. Posibles Problemas de Accesibilidad
- Los toggles de feature en `DowngradeEngine` usan `<button>` con `aria-pressed` sin `role="checkbox"`, lo cual puede ser confuso para algunos screen readers.
- No hay tests de accesibilidad (axe, etc.).

### F. Lógica de `unusedTools` en StackAuditor es Demasiado Agresiva
```tsx
const allFeaturesFromOthers = new Set<string>();
tools.forEach((tool, idx) => {
  tools.forEach((other, jdx) => {
    if (idx !== jdx) {
      other.featureIds.forEach(fid => allFeaturesFromOthers.add(fid));
    }
  });
});

const unusedTools = tools
  .filter(t => {
    const uniqueFeatures = t.featureIds.filter(fid => !allFeaturesFromOthers.has(fid));
    return uniqueFeatures.length === 0 && tools.length > 1;
  })
  .map(t => t.name);
```
**Problema**: Una herramienta se marca como "unused" si TODAS sus features están presentes en AL MENOS otra herramienta del stack. Esto ignora:
- La calidad/cantidad de la feature (ej. "Basic Reporting" en Tool A puede ser mucho más limitada que en Tool B).
- Las `proprietaryFeatures` no se consideran en este cálculo.
- Herramientas con features genéricas comunes (`api_access`, `integrations`) siempre serán consideradas "unused" si otra herramienta también las tiene.

---

## 6. Análisis Profundo: `features-registry.ts`

**Ubicación**: `src/data/features-registry.ts`

```typescript
export interface RegistryFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'security' | 'integration' | 'analytics' | 'support';
  isEnterpriseLocked: boolean;
  comparable: true;
}

export const featureRegistry: RegistryFeature[] = [
  { id: 'api_access',         name: 'API Access',           description: 'REST API with rate limits',                        category: 'integration', isEnterpriseLocked: false, comparable: true },
  { id: 'integrations',       name: 'Native Integrations',  description: 'Pre-built app connections',                        category: 'integration', isEnterpriseLocked: false, comparable: true },
  { id: 'custom_fields',      name: 'Custom Fields',        description: 'User-defined data fields',                         category: 'core',        isEnterpriseLocked: false, comparable: true },
  { id: 'workflows',          name: 'Advanced Workflows',   description: 'Multi-step automation logic',                      category: 'core',        isEnterpriseLocked: true,  comparable: true },
  { id: 'saml_sso',           name: 'SAML SSO',             description: 'Single Sign-On via SAML 2.0',                      category: 'security',    isEnterpriseLocked: true,  comparable: true },
  { id: 'audit_logs',         name: 'Audit Logs',           description: 'Comprehensive activity logging',                   category: 'security',    isEnterpriseLocked: true,  comparable: true },
  { id: 'sla',                name: 'SLA Guarantee',        description: '99.9% uptime with financial backing',              category: 'support',     isEnterpriseLocked: true,  comparable: true },
  { id: 'priority_support',   name: 'Priority Support',     description: '<2h response time',                               category: 'support',     isEnterpriseLocked: true,  comparable: true },
  { id: 'roles_permissions',  name: 'Custom Roles & Permissions', description: 'Granular RBAC',                          category: 'security',    isEnterpriseLocked: true,  comparable: true },
  { id: 'advanced_analytics', name: 'Advanced Analytics',   description: 'Predictive analytics and cohorts',                category: 'analytics',   isEnterpriseLocked: true,  comparable: true },
  { id: 'reporting',          name: 'Basic Reporting',      description: 'Standard analytics dashboards',                   category: 'analytics',   isEnterpriseLocked: false, comparable: true },
  { id: 'ai_features',        name: 'AI Assistant',         description: 'Generative AI capabilities',                      category: 'core',        isEnterpriseLocked: true,  comparable: true },
  { id: 'white_label',        name: 'White Labeling',       description: 'Remove vendor branding',                         category: 'core',        isEnterpriseLocked: true,  comparable: true },
  { id: 'crm_basic',          name: 'Basic CRM',            description: 'Contact and deal management',                     category: 'core',        isEnterpriseLocked: false, comparable: true },
  { id: 'email_automation',   name: 'Email Automation',     description: 'Automated email sequences and triggers',          category: 'core',        isEnterpriseLocked: false, comparable: true },
] as const satisfies RegistryFeature[];
```

**Observaciones**:
- **Total de features**: 15 features comparables.
- **Categorización existente**: Sí, cada feature tiene una categoría (`core`, `security`, `integration`, `analytics`, `support`).
- **Core vs Genéricas**: 
  - **Core** (5): `custom_fields`, `workflows`, `ai_features`, `white_label`, `crm_basic`, `email_automation`.
  - **Security** (3): `saml_sso`, `audit_logs`, `roles_permissions`.
  - **Integration** (2): `api_access`, `integrations`.
  - **Analytics** (2): `advanced_analytics`, `reporting`.
  - **Support** (2): `sla`, `priority_support`.
- **Enterprise Locked**: 8 de 15 son enterprise-only (`workflows`, `saml_sso`, `audit_logs`, `sla`, `priority_support`, `roles_permissions`, `advanced_analytics`, `ai_features`, `white_label`).
- **Problema**: Las features `api_access`, `integrations`, `saml_sso`, `audit_logs`, `roles_permissions` son extremadamente genéricas y aparecen en casi TODOS los productos. Esto genera solapamiento matemático alto pero semántico bajo.

---

## 7. Análisis Profundo: `StackAuditor.tsx` y Lógica de `analyzeStack`

**Ubicación**: `src/components/StackAuditor.tsx` (394 líneas)

### Algoritmo de Detección de Redundancias

```typescript
function analyzeStack(toolIds: string[], allProducts: SaaSProductData[], fmt: (val: number) => string): StackAuditResult {
  const tools = allProducts.filter(p => toolIds.includes(p.id));
  const redundantPairs: StackAuditResult['redundantPairs'] = [];

  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const t1 = tools[i];
      const t2 = tools[j];

      const f1Ids = new Set(t1.featureIds);
      const f2Ids = new Set(t2.featureIds);

      const overlap = [...f1Ids].filter(fid => f2Ids.has(fid));
      const overlapThreshold = Math.ceil(Math.min(t1.featureIds.length, t2.featureIds.length) * 0.4);

      if (overlap.length >= overlapThreshold && overlap.length >= 2) {
        const p1Price = getCheapestPaidPrice(t1);
        const p2Price = getCheapestPaidPrice(t2);

        const overlappingFeatureObjs = getFeaturesByIds(overlap.slice(0, 6));
        const featureNames = overlappingFeatureObjs.map(f => f.name);

        const cheaper = p1Price < p2Price ? t1 : t2;
        const moreExpensive = p1Price < p2Price ? t2 : t1;

        redundantPairs.push({
          tool1: t1.name,
          tool2: t2.name,
          id1: t1.id,
          id2: t2.id,
          overlappingFeatures: overlap.slice(0, 6),
          overlappingFeatureNames: featureNames,
          recommendation:
            `${cheaper.name} (from ${fmt(p1Price)}/mo) and ${moreExpensive.name} (from ${fmt(p2Price)}/mo) both offer ${featureNames.slice(0, 3).join(', ')}. ` +
            `If you only need basic ${featureNames[0]?.toLowerCase() || 'functionality'}, keep ${cheaper.name} and cancel ${moreExpensive.name}.`,
          potentialSavings: Math.min(p1Price, p2Price) * 12,
        });
      }
    }
  }
  // ... sorting y unusedTools
}
```

### Algoritmo Matemático y Umbrales
1. **Solapamiento**: Intersección de `featureIds` entre dos herramientas.
2. **Umbral dinámico**: `Math.ceil(Math.min(t1.featureIds.length, t2.featureIds.length) * 0.4)`. Esto significa que se requiere un 40% del feature set más pequeño.
3. **Umbral mínimo absoluto**: `overlap.length >= 2` (al menos 2 features en común).
4. **Precios**: Usa `getCheapestPaidPrice()` que devuelve el plan más barato con `priceMonthly > 0`.
5. **Savings**: `Math.min(p1Price, p2Price) * 12` (asume que cancelas la más cara y te ahorras el costo de la más barata anualizado).
6. **Ordenamiento**: Ordena por `potentialSavings` descendente.

### Generación de Recomendaciones de Texto
El texto generado es estático y basado en template:
- Menciona ambas herramientas y sus precios.
- Lista hasta 3 nombres de features solapadas.
- Recomienda quedarse con la más barata y cancelar la más cara.
- **Crítico**: La recomendación dice "If you only need basic [featureName]..." lo cual es una generalización peligrosa que ignora el resto del stack y las `proprietaryFeatures`.

---

## 8. Análisis de Categorías

**Ubicación**: `src/lib/categories.ts`

```typescript
export const RELATED_CATEGORIES: Record<string, string[]> = {
  'CRM & Sales':         ['CRM & Sales', 'Customer Support', 'Email Marketing'],
  'Customer Support':    ['Customer Support', 'CRM & Sales', 'Communication'],
  'Communication':       ['Communication', 'Video Conferencing'],
  'Project Management':  ['Project Management', 'Productivity & Wiki', 'Dev Tools'],
  'Video Conferencing':  ['Video Conferencing', 'Communication'],
  'Email Marketing':     ['Email Marketing', 'CRM & Sales'],
  'Productivity & Wiki': ['Productivity & Wiki', 'Project Management', 'Design'],
  'Dev Tools':           ['Dev Tools', 'Project Management', 'Monitoring'],
  'Design':              ['Design', 'Productivity & Wiki', 'Project Management'],
  'Monitoring':          ['Monitoring', 'Dev Tools'],
};
```

**Categorías existentes** (definidas en `content.config.ts` como enum Zod):
1. CRM & Sales
2. Project Management
3. Communication
4. Customer Support
5. Email Marketing
6. Video Conferencing
7. Productivity & Wiki
8. Dev Tools
9. Design
10. Monitoring

**Asignación**: Cada archivo JSON tiene un campo `category` que DEBE ser uno de los valores del enum. La asignación es manual y estática en cada JSON.

**Función `groupProductsByCategory`**: Agrupa productos por su campo `category` para renderizado en selectores.

---

## 9. Base de Datos SaaS (`src/content/saas/`)

**Cantidad**: 50 archivos JSON.

### Formato de cada archivo
Cada archivo sigue el schema Zod definido en `content.config.ts`:

```json
{
  "id": "string-kebab-case",
  "name": "Human Readable Name",
  "slug": "kebab-case",
  "category": "One of 10 categories",
  "description": "10-300 chars",
  "websiteUrl": "https://...",
  "affiliateUrl": "https://..." | null,
  "pricingModel": "per_user" | "per_month" | ...,
  "freeTrialDays": number | null,
  "lastVerified": "YYYY-MM-DD",
  "popularityScore": 0-100 (optional),
  "g2Rating": 0-5 (optional),
  "featureIds": ["api_access", "integrations", ...],
  "proprietaryFeatures": [
    {"id": "...", "name": "...", "description": "...", "category": "proprietary", "isEnterpriseLocked": false, "comparable": false}
  ],
  "plans": [
    {
      "id": "...",
      "name": "...",
      "priceMonthly": number | null,
      "priceAnnually": number | null,
      "seatsIncluded": number,
      "features": {"featureId": true, ...},
      "isEnterprise": boolean,
      "migrationComplexity": "low" | "medium" | "high" (optional)
    }
  ]
}
```

### Ejemplos representativos

#### Microsoft Teams (Communication)
```json
{
  "id": "microsoft-teams",
  "name": "Microsoft Teams",
  "category": "Communication",
  "featureIds": ["api_access", "integrations", "saml_sso", "audit_logs", "roles_permissions"],
  "plans": [
    {"id": "free", "name": "Free", "priceMonthly": 0, ...},
    {"id": "essentials", "name": "Essentials", "priceMonthly": 4, ...},
    {"id": "business_basic", "name": "Business Basic", "priceMonthly": 6, ...},
    {"id": "business_standard", "name": "Business Standard", "priceMonthly": 12.5, ...}
  ]
}
```

#### GitHub (Dev Tools)
```json
{
  "id": "github",
  "name": "GitHub",
  "category": "Dev Tools",
  "featureIds": ["api_access", "integrations", "saml_sso", "audit_logs", "roles_permissions", "sla"],
  "plans": [
    {"id": "free", "name": "Free", "priceMonthly": 0, ...},
    {"id": "team", "name": "Team", "priceMonthly": 4, ...},
    {"id": "enterprise", "name": "Enterprise", "priceMonthly": 21, ...}
  ]
}
```

#### HubSpot (CRM & Sales)
```json
{
  "id": "hubspot",
  "name": "HubSpot",
  "category": "CRM & Sales",
  "featureIds": ["crm_basic", "email_automation", "custom_fields", "api_access", "integrations", "reporting", "workflows", "advanced_analytics", "roles_permissions", "saml_sso", "audit_logs", "ai_features", "sla", "priority_support"],
  "plans": [
    {"id": "free", "name": "Free", "priceMonthly": 0, ...},
    {"id": "starter", "name": "Starter", "priceMonthly": 20, ...},
    {"id": "professional", "name": "Professional", "priceMonthly": 800, ...},
    {"id": "enterprise", "name": "Enterprise", "priceMonthly": 3600, ...}
  ]
}
```

#### Zoom (Video Conferencing)
```json
{
  "id": "zoom",
  "name": "Zoom",
  "category": "Video Conferencing",
  "featureIds": ["api_access", "integrations", "reporting", "roles_permissions", "saml_sso", "audit_logs", "sla", "priority_support"],
  "plans": [
    {"id": "basic", "name": "Basic", "priceMonthly": 0, ...},
    {"id": "pro", "name": "Pro", "priceMonthly": 14, ...},
    {"id": "business", "name": "Business", "priceMonthly": 20, ...},
    {"id": "enterprise", "name": "Enterprise", "priceMonthly": 30, ...}
  ]
}
```

---

## 10. Tipos de Datos Compartidos

**Ubicación**: `src/types/saas.ts` (159 líneas)

### Tipos principales

```typescript
export interface SaaSProductData {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  websiteUrl: string;
  affiliateUrl: string | null;
  pricingModel: string;
  freeTrialDays: number | null;
  lastVerified: string;
  popularityScore?: number;
  g2Rating?: number;
  featureIds: string[];
  proprietaryFeatures: ProprietaryFeature[];
  plans: SaaSPlanData[];
  openSourceAlternatives?: OpenSourceAlternative[];
}

export interface SaaSPlanData {
  id: string;
  name: string;
  priceMonthly: number | null;
  priceAnnually: number | null;
  seatsIncluded: number;
  features: Record<string, boolean | number | string>;
  isEnterprise: boolean;
  migrationComplexity?: 'low' | 'medium' | 'high';
}

export interface ProprietaryFeature {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnterpriseLocked: boolean;
  comparable: false;
}

export interface StackAuditResult {
  redundantPairs: {
    tool1: string;
    tool2: string;
    id1: string;
    id2: string;
    overlappingFeatures: string[];
    overlappingFeatureNames: string[];
    recommendation: string;
    potentialSavings: number;
  }[];
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  unusedTools: string[];
}
```

**Observaciones**:
- `featureIds` es un array de strings que referencian el `features-registry.ts`.
- `proprietaryFeatures` tiene su propia estructura similar pero con `comparable: false`.
- `plans.features` es un `Record<string, boolean | number | string>` lo cual permite flexibilidad pero pierde type safety (podría referenciar featureIds inexistentes).

---

## 11. Dependencias y Convenciones

### Dependencias clave (`package.json`)
```json
{
  "dependencies": {
    "@astrojs/mdx": "^6.0.1",
    "@astrojs/react": "^5.0.6",
    "@astrojs/sitemap": "^3.7.3",
    "@tailwindcss/vite": "^4.3.0",
    "astro": "^6.4.2",
    "clsx": "^2.1.1",
    "lucide-react": "^1.17.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "tailwind-merge": "^3.6.0",
    "tailwindcss": "^4.3.0"
  }
}
```

### Librerías de comparación
- **No usa librerías externas** para comparación de features o detección de redundancias. Todo es lógica propia en `StackAuditor.tsx`.
- **No usa lodash, ramda, etc.** para operaciones de conjuntos; usa `Set` y `filter` nativo.

### Linters/Formatters
- **No hay ESLint configurado** (no se encontró `.eslintrc`, `eslint.config.mjs`, etc.).
- **No hay Prettier configurado** (no se encontró `.prettierrc`, etc.).
- **No hay Husky ni lint-staged**.

---

## 12. Problemas Detectados: Falsos Positivos del Stack Auditor

El algoritmo actual de `analyzeStack` es extremadamente propenso a falsos positivos porque:
1. **No considera categorías**: Una herramienta de Dev Tools y una de Communication pueden ser marcadas como redundantes.
2. **Las features genéricas dominan**: `api_access`, `integrations`, `saml_sso`, `audit_logs`, `roles_permissions` aparecen en casi todos los productos enterprise.
3. **El umbral del 40% es bajo** cuando los productos tienen pocos features en el registro.

### Casos específicos de falsos positivos confirmados

#### Caso 1: Bitbucket vs Microsoft Teams
- **Bitbucket** (`Dev Tools`): featureIds = `[api_access, integrations, saml_sso, audit_logs, roles_permissions]` (5 features)
- **Microsoft Teams** (`Communication`): featureIds = `[api_access, integrations, saml_sso, audit_logs, roles_permissions]` (5 features)
- **Solapamiento**: 5 features (100%)
- **Umbral**: `Math.ceil(5 * 0.4)` = 2
- **Resultado**: `5 >= 2` → **MARCADO COMO REDUNDANTE**
- **Realidad**: Son herramientas de dominios completamente diferentes (hosting de código vs chat empresarial).

#### Caso 2: GitHub vs Microsoft Teams
- **GitHub** (`Dev Tools`): featureIds = `[api_access, integrations, saml_sso, audit_logs, roles_permissions, sla]` (6 features)
- **Microsoft Teams** (`Communication`): featureIds = `[api_access, integrations, saml_sso, audit_logs, roles_permissions]` (5 features)
- **Solapamiento**: 5 features
- **Umbral**: `Math.ceil(5 * 0.4)` = 2
- **Resultado**: `5 >= 2` → **MARCADO COMO REDUNDANTE**
- **Realidad**: GitHub es control de versiones; Teams es comunicación. No son sustituibles.

#### Caso 3: GitLab vs Zoom
- **GitLab** (`Dev Tools`): featureIds = `[api_access, integrations, saml_sso, audit_logs, roles_permissions, sla]` (6 features)
- **Zoom** (`Video Conferencing`): featureIds = `[api_access, integrations, reporting, roles_permissions, saml_sso, audit_logs, sla, priority_support]` (8 features)
- **Solapamiento**: `api_access, integrations, saml_sso, audit_logs, roles_permissions, sla` = 6 features
- **Umbral**: `Math.ceil(6 * 0.4)` = 3
- **Resultado**: `6 >= 3` → **MARCADO COMO REDUNDANTE**
- **Realidad**: GitLab es DevSecOps; Zoom es videoconferencia. Solapamiento puramente de features de seguridad/IT genéricas.

#### Caso 4: Jira vs Notion
- **Jira** (`Project Management`): featureIds = `[custom_fields, api_access, integrations, workflows, reporting, roles_permissions, saml_sso, audit_logs]` (8 features)
- **Notion** (`Productivity & Wiki`): featureIds = `[custom_fields, api_access, integrations, workflows, roles_permissions, audit_logs, saml_sso, sla, priority_support]` (9 features)
- **Solapamiento**: `custom_fields, api_access, integrations, workflows, roles_permissions, saml_sso, audit_logs` = 7 features
- **Umbral**: `Math.ceil(8 * 0.4)` = 4
- **Resultado**: `7 >= 4` → **MARCADO COMO REDUNDANTE**
- **Realidad**: Aunque ambos son productividad, uno es gestión de proyectos agile y el otro es wiki/docs. El auditor recomendaría cancelar uno por el otro, lo cual es un consejo de negocio peligroso.

#### Caso 5: HubSpot vs Salesforce
- **HubSpot** (`CRM & Sales`): 14 features
- **Salesforce** (`CRM & Sales`): 13 features
- **Solapamiento**: Muy alto (ambos son CRM).
- **Observación**: Este es un caso donde la redundancia SÍ es real, pero el auditor no distingue entre "redundancia real de mismo dominio" y "redundancia falsa de features genéricas". El mensaje de recomendación es idéntico en ambos casos.

### Análisis de la función `unusedTools`
Esta función marca una herramienta como "unused" si TODAS sus `featureIds` están presentes en AL MENOS UNA otra herramienta del stack.

**Ejemplo**: Stack = [Slack, Microsoft Teams, Zoom]
- Slack features: `[api_access, integrations, workflows, saml_sso, audit_logs, roles_permissions, sla, priority_support]`
- Teams features: `[api_access, integrations, saml_sso, audit_logs, roles_permissions]`
- Zoom features: `[api_access, integrations, reporting, roles_permissions, saml_sso, audit_logs, sla, priority_support]`

**Slack** tiene `workflows` que Teams no tiene, pero Zoom tampoco tiene `workflows`. Sin embargo, `priority_support` está en Zoom. `api_access` está en Teams y Zoom. Si iteramos: ¿existe algún feature de Slack que NO esté en Teams NI en Zoom? 
- `workflows`: Teams NO, Zoom NO → Slack tiene UN feature único → NO es "unused".

Pero si el stack fuera [Slack, Zoom]:
- Slack `workflows`: Zoom NO → Slack NO es "unused".

Sin embargo, si el stack fuera [GitHub, Bitbucket]:
- GitHub features: `[api_access, integrations, saml_sso, audit_logs, roles_permissions, sla]`
- Bitbucket features: `[api_access, integrations, saml_sso, audit_logs, roles_permissions]`
- Bitbucket `sla`: GitHub NO → Bitbucket NO es "unused".
- GitHub `sla`: Bitbucket NO → GitHub NO es "unused".

Pero si el stack fuera [Microsoft Teams, Zoom]:
- Teams features: `[api_access, integrations, saml_sso, audit_logs, roles_permissions]`
- Zoom features: `[api_access, integrations, reporting, roles_permissions, saml_sso, audit_logs, sla, priority_support]`
- Teams `api_access`: Zoom SÍ
- Teams `integrations`: Zoom SÍ
- Teams `saml_sso`: Zoom SÍ
- Teams `audit_logs`: Zoom SÍ
- Teams `roles_permissions`: Zoom SÍ
- **Resultado**: Teams es marcado como "unused" porque Zoom cubre todos sus features genéricos. Esto es un falso positivo grave: una empresa usa Teams para chat y Zoom para videoconferencia. El auditor sugeriría que Teams es "potentially unused".

---

## 13. Resumen Ejecutivo para el Manager

El proyecto es un **Astro SSG estático** con React 19 para la interactividad y Tailwind v4 para estilos. La base de datos son 50 JSONs validados por Zod. Los componentes clave (`StackAuditor`, `DowngradeEngine`) comparten un patrón común: reciben `products` como prop, usan elementos nativos estilizados, y calculan ahorros manualmente.

**Puntos críticos para mejoras en el Stack Auditor**:
1. **Falsos Positivos Masivos**: El algoritmo de redundancia actual (`40% overlap` + `>=2 features`) genera falsos positivos extremadamente obvios (ej. Bitbucket vs Teams, GitHub vs Zoom) porque ignora la categoría del producto y no diferencia entre features genéricas (`api_access`, `saml_sso`) y features de dominio (`crm_basic`, `workflows`).
2. **Unused Tools Agresivo**: La lógica de `unusedTools` considera que una herramienta es "unused" si otra cubre sus `featureIds`, sin considerar `proprietaryFeatures` ni el dominio de negocio.
3. **Recomendaciones Genéricas**: El texto de recomendación es un template simple que siempre sugiere cancelar la herramienta más cara, sin análisis de criticidad de features.
4. **Sin Tests**: Cero tests unitarios/E2E. Solo validación de datos JSON.
5. **Validador Hardcodeado**: `scripts/validate-data.mjs` duplica la lista de features manualmente.

**Comando de build**: `npm run build` (genera sitio estático en `/dist`).
