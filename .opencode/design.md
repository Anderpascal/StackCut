# Diseño Técnico — Refactorización de StackAuditor: Categorización, Silos, Filtros y Migración

---

## 1. Arquitectura de Componentes

### 1.1 Diagrama de Componentes Involucrados

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          DATOS CANÓNICOS (Build-time)                       │
│                                                                             │
│  src/data/features-registry.ts  ← MODIFICADO                               │
│  ├── RegistryFeature (extendido con `type`)                                │
│  ├── featureRegistry[] (~31 entradas)                                      │
│  ├── getCoreFeatureIds()          ← NUEVO helper                           │
│  ├── getInfrastructureFeatureIds() ← NUEVO helper                          │
│  ├── isCoreFeature(id)            ← NUEVO helper                           │
│  ├── isInfrastructureFeature(id)  ← NUEVO helper                           │
│  ├── filterCoreFeatures(ids)      ← NUEVO helper                           │
│  ├── filterInfrastructureFeatures(ids) ← NUEVO helper                     │
│  └── getFeatureById() / getFeaturesByIds() / validateFeatureIds() — SIN CAMBIOS │
│                                                                             │
│  src/lib/categories.ts  ← MODIFICADO                                       │
│  ├── RELATED_CATEGORIES (SIN CAMBIOS — usado por DowngradeEngine)           │
│  ├── CATEGORY_ORDER (SIN CAMBIOS)                                           │
│  ├── COMPARISON_SILOS       ← NUEVO (usado por StackAuditor)               │
│  ├── areCategoriesComparable(cat1, cat2) ← NUEVO helper                    │
│  └── groupProductsByCategory() — SIN CAMBIOS                               │
│                                                                             │
│  src/types/saas.ts  ← MODIFICADO                                           │
│  ├── StackAuditResult.redundantPairs[] extendido                            │
│  └── El resto de interfaces — SIN CAMBIOS                                  │
│                                                                             │
│  src/content/saas/*.json (50 archivos)  ← MIGRADOS                         │
│  └── featureIds alineados con nuevo registry                                │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     MOTOR DE AUDITORÍA (Runtime, Client-side)               │
│                                                                             │
│  src/components/StackAuditor.tsx  ← REFACTORIZADO                          │
│  ├── analyzeStack()          ← LÓGICA DE NEGOCIO NUEVA                     │
│  │   ├── Paso 1: Filtrar pares por COMPARISON_SILOS (O(1) por par)        │
│  │   ├── Paso 2: Filtrar featureIds a solo core (type === 'core')          │
│  │   ├── Paso 3: Calcular coreOverlap, aplicar umbral >60%                 │
│  │   └── Paso 4: Generar redundantPair con core features nombradas         │
│  ├── unusedTools             ← LÓGICA REFACTORIZADA                        │
│  │   └── Solo considera core features; excluye infra y proprietary         │
│  ├── getCheapestPaidPrice()  ← SIN CAMBIOS                                 │
│  ├── UI (StackAuditorInner)  ← CONEXIÓN SIN CAMBIOS                        │
│  │   └── La UI muestra overlappingCoreFeatures + overlappingFeatureNames   │
│  └── Hooks (useState, useMemo, useCallback, localStorage) — SIN CAMBIOS   │
└────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              SCRIPTS Y TESTS                                │
│                                                                             │
│  scripts/migrate-features.mjs  ← NUEVO                                     │
│  ├── CATEGORY_DEFAULT_FEATURES (mapa)                                      │
│  ├── Lectura del registry (feature IDs, tipos)                             │
│  ├── Procesamiento de 50 JSONs                                             │
│  ├── Generación de migration-report.json                                   │
│  └── Exit code: 0 ok / 1 invalid IDs                                       │
│                                                                             │
│  scripts/validate-data.mjs  ← MODIFICADO                                   │
│  └── Sustituir lista hardcodeada por importación dinámica o JSON generado  │
│                                                                             │
│  src/__tests__/features-registry.test.ts   ← NUEVO                         │
│  src/__tests__/categories.test.ts          ← NUEVO                         │
│  src/__tests__/analyze-stack.test.ts       ← NUEVO                         │
│  src/__tests__/unused-tools.test.ts        ← NUEVO                         │
│                                                                             │
│  vitest.config.ts  ← NUEVO                                                 │
│  package.json      ← MODIFICADO (scripts + devDependency vitest)           │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Dependencias Entre Componentes

```
features-registry.ts ─────────────────┐
  (importado por)                     │
  ├── StackAuditor.tsx                │
  ├── validate-data.mjs               │
  ├── migrate-features.mjs            │
  └── analyze-stack.test.ts           │
                                      │
categories.ts ────────────────────────┤
  (importado por)                     │
  ├── StackAuditor.tsx (COMPARISON_SILOS, areCategoriesComparable)  │
  ├── DowngradeEngine.tsx (RELATED_CATEGORIES — SIN CAMBIOS)        │
  └── categories.test.ts             │
                                      │
types/saas.ts ────────────────────────┤
  (importado por)                     │
  ├── StackAuditor.tsx               │
  ├── categories.ts                  │
  ├── analyze-stack.test.ts          │
  └── unused-tools.test.ts           │
```

**NOTA IMPORTANTE**: `RELATED_CATEGORIES` y `COMPARISON_SILOS` son dos mapas independientes:
- `RELATED_CATEGORIES` → usado por `DowngradeEngine.tsx` para buscar alternativas (más amplio). **NO SE TOCA.**
- `COMPARISON_SILOS` → usado solo por `StackAuditor.tsx` para detectar redundancia (más restrictivo). **NUEVO.**

Ambos coexisten en el mismo archivo `src/lib/categories.ts` con propósitos claramente diferentes y documentados.

---

## 2. Diseño de Datos

### 2.1 Estructura Completa del NUEVO `features-registry.ts`

#### 2.1.1 Interfaz `RegistryFeature` (modificada)

```typescript
// src/data/features-registry.ts

export interface RegistryFeature {
  id: string;                                             // snake_case, único, ej. 'crm_basic'
  name: string;                                           // Human-readable, ej. 'Basic CRM'
  description: string;                                    // ≥ 30 caracteres, descriptivo
  category: 'core' | 'security' | 'integration' | 'analytics' | 'support';  // SIN CAMBIOS
  type: 'core' | 'infrastructure';                        // NUEVO: clasificación funcional
  isEnterpriseLocked: boolean;                            // ¿Requiere plan enterprise típicamente?
  comparable: true;                                       // SIN CAMBIOS: siempre true
}
```

#### 2.1.2 Lista Completa de Features (31 entradas)

> **Leyenda de columna `category`:** La subcategoría técnica existente (`security`, `integration`, `analytics`, `support`, `core`) se preserva.  
> **Leyenda de columna `type`:** `core` = diferenciador funcional del dominio SaaS; `infrastructure` = prerrequisito técnico/enterprise compartido.

| # | ID | Name | Description | Category | Type | Enterprise Locked |
|---|-----|------|-------------|----------|------|-------------------|
| 1 | `api_access` | API Access | REST API with rate limits and documented endpoints | integration | infrastructure | false |
| 2 | `integrations` | Native Integrations | Pre-built third-party app connectors and webhooks | integration | infrastructure | false |
| 3 | `custom_fields` | Custom Fields | User-defined data fields tailored to business workflows | core | core | false |
| 4 | `workflows` | Advanced Workflows | Multi-step automation logic with conditional branching | core | core | true |
| 5 | `saml_sso` | SAML SSO | Single Sign-On via SAML 2.0 protocol for enterprise identity | security | infrastructure | true |
| 6 | `audit_logs` | Audit Logs | Comprehensive activity logging with export capabilities | security | infrastructure | true |
| 7 | `sla` | SLA Guarantee | 99.9%+ uptime commitment with financial service credits | support | infrastructure | true |
| 8 | `priority_support` | Priority Support | Dedicated support with <2h guaranteed response time | support | infrastructure | true |
| 9 | `roles_permissions` | Custom Roles & Permissions | Granular role-based access control with custom role creation | security | infrastructure | true |
| 10 | `advanced_analytics` | Advanced Analytics | Predictive analytics, cohort analysis, and custom funnels | analytics | core | true |
| 11 | `reporting` | Basic Reporting | Standard dashboards with pre-built report templates | analytics | core | false |
| 12 | `ai_features` | AI Assistant | Generative AI capabilities for content generation and insights | core | core | true |
| 13 | `white_label` | White Labeling | Full brand customization—remove vendor logos, custom domains | core | core | true |
| 14 | `crm_basic` | Basic CRM | Contact lifecycle, deal pipeline, and activity tracking | core | core | false |
| 15 | `email_automation` | Email Automation | Automated email sequences, drip campaigns, and behavioral triggers | core | core | false |

###### NUEVAS Features (#16–#31)

| # | ID | Name | Description | Category | Type | Enterprise Locked |
|---|-----|------|-------------|----------|------|-------------------|
| 16 | `real_time_messaging` | Real-Time Messaging | Instant chat with threaded conversations and emoji reactions | core | core | false |
| 17 | `file_sharing` | File Sharing & Storage | Upload, share, and co-edit files within the platform | core | core | false |
| 18 | `ticketing` | Ticketing System | Multi-channel ticket creation with priority, assignment, and SLA tracking | core | core | false |
| 19 | `knowledge_base` | Knowledge Base | Self-service help center with searchable articles and categorization | core | core | false |
| 20 | `dashboards` | Custom Dashboards | Drag-and-drop dashboard builder with real-time widget updates | analytics | core | false |
| 21 | `alerting` | Alerting & Notifications | Configurable alert rules with multi-channel delivery (email, SMS, webhook) | core | core | false |
| 22 | `recording` | Session Recording | Cloud recording of meetings with transcription and searchable archive | core | core | true |
| 23 | `collaboration` | Real-Time Collaboration | Simultaneous multi-user editing with presence indicators and comments | core | core | false |
| 24 | `version_control` | Version Control | Track document/code changes with diff view and rollback to any revision | core | core | false |
| 25 | `pipeline_mgmt` | Pipeline Management | Visual sales pipeline with drag-and-drop stages and revenue forecasting | core | core | true |
| 26 | `lead_scoring` | Lead Scoring | Automated lead qualification based on behavioral and demographic rules | analytics | core | true |
| 27 | `email_templates` | Email Templates | Reusable branded email templates with dynamic merge tags | core | core | false |
| 28 | `a_b_testing` | A/B Testing | Split-test subject lines, content, and send times with statistical reporting | analytics | core | true |
| 29 | `video_hosting` | Video Hosting | Native video upload and playback with adaptive streaming | core | core | false |
| 30 | `dependency_tracking` | Dependency Tracking | Visualize and manage inter-task dependencies with critical path highlighting | core | core | true |
| 31 | `kanban_boards` | Kanban Boards | Visual task management with swimlanes, WIP limits, and custom workflows | core | core | false |

**Total: 31 features** (20 core + 11 infrastructure, aunque 7 de las core son las existentes + 13 nuevas).  
**Recuento real:** 7 infrastructure features existentes; 8 core features existentes; 16 core features nuevas = 31.  
**Features infrastructure (7):** `api_access`, `integrations`, `saml_sso`, `audit_logs`, `sla`, `priority_support`, `roles_permissions`.  
**Features core (24):** Las 8 existentes + 16 nuevas listadas arriba.

##### Mapeo de ≥3 Core Features Ultra-Específicas por Vertical (Categoría SaaS)

| Categoría SaaS | Core Features Específicas (≥3) |
|---------------|-------------------------------|
| CRM & Sales | `crm_basic`, `pipeline_mgmt`, `lead_scoring`, `email_automation` |
| Communication | `real_time_messaging`, `file_sharing`, `collaboration` |
| Customer Support | `ticketing`, `knowledge_base`, `reporting` |
| Project Management | `workflows`, `kanban_boards`, `dependency_tracking`, `dashboards` |
| Video Conferencing | `recording`, `real_time_messaging`, `video_hosting`, `file_sharing` |
| Email Marketing | `email_automation`, `email_templates`, `a_b_testing`, `dashboards` |
| Productivity & Wiki | `collaboration`, `file_sharing`, `custom_fields`, `knowledge_base` |
| Dev Tools | `version_control`, `workflows`, `dashboards` |
| Design | `collaboration`, `file_sharing`, `version_control` |
| Monitoring | `alerting`, `dashboards`, `reporting`, `advanced_analytics` |

#### 2.1.3 Funciones Helper (nuevas + existentes)

```typescript
// ----------------------- NUEVAS (v2) -----------------------

/** Devuelve los IDs de todas las features con type === 'core' */
export function getCoreFeatureIds(): string[] {
  return featureRegistry.filter(f => f.type === 'core').map(f => f.id);
}

/** Devuelve los IDs de todas las features con type === 'infrastructure' */
export function getInfrastructureFeatureIds(): string[] {
  return featureRegistry.filter(f => f.type === 'infrastructure').map(f => f.id);
}

/** Verifica si un featureId dado es de tipo core */
export function isCoreFeature(id: string): boolean {
  const feature = getFeatureById(id);
  return feature !== undefined && feature.type === 'core';
}

/** Verifica si un featureId dado es de tipo infrastructure */
export function isInfrastructureFeature(id: string): boolean {
  const feature = getFeatureById(id);
  return feature !== undefined && feature.type === 'infrastructure';
}

/** Filtra un array de featureIds para retornar solo los de tipo core */
export function filterCoreFeatures(featureIds: string[]): string[] {
  return featureIds.filter(id => isCoreFeature(id));
}

/** Filtra un array de featureIds para retornar solo los de tipo infrastructure */
export function filterInfrastructureFeatures(featureIds: string[]): string[] {
  return featureIds.filter(id => isInfrastructureFeature(id));
}

// ----------------------- EXISTENTES (sin cambios de firma) -----------------------

export function getFeatureById(id: string): RegistryFeature | undefined;
export function getFeaturesByIds(ids: string[]): RegistryFeature[];
export function validateFeatureIds(featureIds: string[]): string[];
```

#### 2.1.4 Constante de Umbral

```typescript
// En features-registry.ts o en StackAuditor.tsx:

/** Umbral de solapamiento para detectar redundancia (>60% del set menor de core features) */
export const REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6;

/** Mínimo absoluto de core features solapadas para considerar redundancia */
export const MIN_CORE_OVERLAP_FEATURES = 2;
```

---

### 2.2 Estructura de `COMPARISON_SILOS` en `categories.ts`

#### 2.2.1 Adición al archivo existente

Se añade **después** de `RELATED_CATEGORIES` y **antes** de `CATEGORY_ORDER`, con un bloque de comentario que documente claramente la diferencia de propósito:

```typescript
// src/lib/categories.ts — ADICIONES (el resto del archivo permanece idéntico)

/**
 * Silos de comparación para detección de REDUNDANCIA en StackAuditor.
 * 
 * A DIFERENCIA de RELATED_CATEGORIES (usado en DowngradeEngine para buscar
 * ALTERNATIVAS), COMPARISON_SILOS es más RESTRICTIVO. Dos herramientas solo
 * se comparan si sus categorías pertenecen al mismo silo.
 * 
 * Principio rector: dos categorías son comparables si y solo si las herramientas
 * de ambas pueden SUSTITUIRSE en algún escenario de negocio real.
 */
export const COMPARISON_SILOS: Record<string, string[]> = {
  'CRM & Sales':         ['CRM & Sales', 'Email Marketing', 'Customer Support'],
  'Customer Support':    ['Customer Support', 'CRM & Sales'],
  'Communication':       ['Communication', 'Video Conferencing'],
  'Project Management':  ['Project Management', 'Productivity & Wiki', 'Dev Tools'],
  'Video Conferencing':  ['Video Conferencing', 'Communication'],
  'Email Marketing':     ['Email Marketing', 'CRM & Sales'],
  'Productivity & Wiki': ['Productivity & Wiki', 'Project Management', 'Design'],
  'Dev Tools':           ['Dev Tools', 'Project Management', 'Monitoring'],
  'Design':              ['Design', 'Productivity & Wiki'],
  'Monitoring':          ['Monitoring', 'Dev Tools'],
};

/**
 * Verifica si dos categorías SaaS pertenecen al mismo silo de comparación.
 * Consulta O(1): búsqueda en array de ≤5 elementos.
 * 
 * @returns true si las herramientas de cat1 y cat2 pueden compararse para redundancia.
 */
export function areCategoriesComparable(cat1: string, cat2: string): boolean {
  // Misma categoría: siempre comparable
  if (cat1 === cat2) return true;
  // Verificar si cat2 está en el silo de cat1
  const silo = COMPARISON_SILOS[cat1];
  if (silo && silo.includes(cat2)) return true;
  // Verificar simétricamente (cat1 en el silo de cat2)
  const silo2 = COMPARISON_SILOS[cat2];
  if (silo2 && silo2.includes(cat1)) return true;
  return false;
}
```

#### 2.2.2 Justificación de cada relación del silo

| Categoría | Comparable con | Justificación de negocio |
|-----------|---------------|--------------------------|
| CRM & Sales | Email Marketing, Customer Support | CRMs, email marketing, y soporte comparten gestión de clientes y automatización de comunicaciones |
| Customer Support | CRM & Sales | Soporte hereda datos de cliente del CRM; herramientas de helpdesk compiten con módulos de servicio de CRMs |
| Communication | Video Conferencing | Chat empresarial y videollamadas son canales de comunicación complementarios y frecuentemente integrados |
| Video Conferencing | Communication | Misma justificación, simétrico |
| Project Management | Productivity & Wiki, Dev Tools | Gestión de proyectos solapa con wikis/documentación (Notion, Confluence) y con herramientas de desarrollo (Jira, GitHub Projects) |
| Productivity & Wiki | Project Management, Design | Wikis compiten con módulos de documentación de PM; diseño y productividad comparten colaboración visual |
| Dev Tools | Project Management, Monitoring | DevOps integra gestión de proyectos (issues, sprints) y monitoreo (alertas, dashboards) |
| Design | Productivity & Wiki | Herramientas de diseño y productividad comparten features de colaboración y whiteboarding |
| Monitoring | Dev Tools | Monitoreo de infraestructura es parte del ciclo DevOps |
| Email Marketing | CRM & Sales | Email marketing es extensión natural del CRM para campañas y automatización |

#### 2.2.3 Lo que NO cambia

- `RELATED_CATEGORIES` permanece **exactamente igual**. `DowngradeEngine.tsx` sigue importándolo y usándolo sin cambios.
- `CATEGORY_ORDER` permanece igual.
- `groupProductsByCategory()` permanece igual.

---

### 2.3 Estructura de Tipos Extendidos en `types/saas.ts`

#### 2.3.1 `StackAuditResult` (extendido)

```typescript
// src/types/saas.ts — SOLO ADICIONES (el resto del archivo no cambia)

export interface StackAuditResult {
  redundantPairs: {
    // --- Campos existentes (sin cambios) ---
    tool1: string;
    tool2: string;
    id1: string;
    id2: string;
    overlappingFeatures: string[];            // TODOS los featureIds solapados (core + infra) — para UI
    overlappingFeatureNames: string[];        // Nombres de TODOS los features solapados — para UI
    recommendation: string;
    potentialSavings: number;

    // --- NUEVOS campos (v2) ---
    overlappingCoreFeatures: string[];        // Solo featureIds con type === 'core' solapados
    overlappingCoreFeatureNames: string[];    // Nombres de solo las core features solapadas
    siloCategory: string;                     // La categoría del silo compartido (ej. "CRM & Sales")
    redundancyReason: 'core_overlap';         // Razón por la que se detectó redundancia
  }[];
  totalMonthlySpend: number;                  // Sin cambios
  totalPotentialSavings: number;              // Sin cambios
  unusedTools: string[];                      // Sin cambios en tipo, comportamiento refactorizado
}
```

#### 2.3.2 Interfaces sin cambios

- `SaaSProductData` — sin cambios.
- `SaaSPlanData` — sin cambios.
- `ProprietaryFeature` — sin cambios.
- `OpenSourceAlternative` — sin cambios.
- `DowngradeSuggestion` — sin cambios.
- `AlternativeSuggestion` — sin cambios.
- `EnterpriseTaxBreakdown` — sin cambios.
- `MigrationCostParams` — sin cambios.
- `CsvExportRow` — sin cambios.
- `NegotiationScriptParams` — sin cambios.

---

## 3. Flujo de Datos del Algoritmo Refactorizado

### 3.1 Diagrama de Flujo de `analyzeStack` (v2)

```
analyzeStack(toolIds, allProducts, fmt)
│
├── 1. CARGAR DATOS CANÓNICOS (fuera del loop, una sola vez)
│   ├── coreFeatureIds = new Set(getCoreFeatureIds())     // O(31)
│   ├── infraFeatureIds = new Set(getInfrastructureFeatureIds()) // O(31)
│   └── tools = allProducts.filter(p => toolIds.includes(p.id))
│
├── 2. PARA CADA PAR (i, j), i < j:                // O(n²) donde n = tools.length
│   │
│   ├── 2a. FILTRO DE SILO (O(1))
│   │   │
│   │   ├── ¿COMPARISON_SILOS[t1.category]?.includes(t2.category)?
│   │   │   └── NO → continue (next pair)
│   │   │   └── SÍ → continuar
│   │   │
│   ├── 2b. FILTRAR CORE FEATURES (O(k) por herramienta, k ≤ 31)
│   │   │
│   │   ├── t1Core = t1.featureIds.filter(fid => coreFeatureIds.has(fid))
│   │   └── t2Core = t2.featureIds.filter(fid => coreFeatureIds.has(fid))
│   │   │
│   ├── 2c. CALCULAR CORE OVERLAP
│   │   │
│   │   ├── t2CoreSet = new Set(t2Core)
│   │   ├── coreOverlap = t1Core.filter(fid => t2CoreSet.has(fid))
│   │   │
│   ├── 2d. APLICAR UMBRAL
│   │   │
│   │   ├── ¿Math.min(t1Core.length, t2Core.length) === 0?
│   │   │   └── SÍ → continue
│   │   │
│   │   ├── threshold = Math.ceil(Math.min(t1Core.length, t2Core.length) * 0.6)
│   │   │
│   │   ├── ¿coreOverlap.length >= threshold Y coreOverlap.length >= 2?
│   │   │   └── NO → continue
│   │   │   └── SÍ → generar redundantPair
│   │   │
│   ├── 2e. GENERAR REDUNDANT PAIR
│   │   │
│   │   ├── overlappingFeatures = TODOS los featureIds solapados (core + infra) — para UI
│   │   ├── overlappingCoreFeatures = solo los core overlap IDs
│   │   ├── overlappingCoreFeatureNames = getFeaturesByIds(coreOverlap).map(f => f.name)
│   │   ├── recommendation = template con nombres de core features + categoría
│   │   ├── potentialSavings = Math.min(p1Price, p2Price) * 12
│   │   ├── siloCategory = t1.category (ambas están en el mismo silo)
│   │   └── redundancyReason = 'core_overlap'
│   │
│   └── push a redundantPairs[]
│
├── 3. ORDENAR redundantPairs por potentialSavings descendente
│
├── 4. CALCULAR totalMonthlySpend (sin cambios)
│
├── 5. CALCULAR unusedTools (REFACTORIZADO, ver §3.3)
│
└── 6. RETORNAR StackAuditResult
```

### 3.2 Pseudo-código Detallado de `analyzeStack`

```typescript
function analyzeStack(
  toolIds: string[],
  allProducts: SaaSProductData[],
  fmt: (val: number) => string
): StackAuditResult {

  // ──────────────────────────────────────────────────────────
  // STEP 0: Precompute canonical data (once, outside loops)
  // ──────────────────────────────────────────────────────────
  const tools = allProducts.filter(p => toolIds.includes(p.id));
  const coreFeatureIds = new Set(getCoreFeatureIds());
  const redundantPairs: StackAuditResult['redundantPairs'] = [];

  const REDUNDANCY_THRESHOLD = 0.6; // >60% of the smaller core set
  const MIN_CORE_OVERLAP = 2;

  // ──────────────────────────────────────────────────────────
  // STEP 1: Pairwise comparison with silo + core filtering
  // ──────────────────────────────────────────────────────────
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const t1 = tools[i];
      const t2 = tools[j];

      // 1a. COMPARISON SILO CHECK (O(1))
      if (!areCategoriesComparable(t1.category, t2.category)) {
        continue;
      }

      // 1b. FILTER TO CORE FEATURES ONLY
      const t1Core = t1.featureIds.filter(fid => coreFeatureIds.has(fid));
      const t2Core = t2.featureIds.filter(fid => coreFeatureIds.has(fid));

      const smallerCoreCount = Math.min(t1Core.length, t2Core.length);
      
      // 1c. Early exit: no core features to compare
      if (smallerCoreCount === 0) continue;

      // 1d. Calculate core overlap
      const t2CoreSet = new Set(t2Core);
      const coreOverlap = t1Core.filter(fid => t2CoreSet.has(fid));

      // 1e. Apply threshold: >60% of smaller set AND >= 2 core features
      const threshold = Math.ceil(smallerCoreCount * REDUNDANCY_THRESHOLD);
      if (coreOverlap.length < threshold || coreOverlap.length < MIN_CORE_OVERLAP) {
        continue;
      }

      // ────────────────────────────────────────────────────
      // Redundancy DETECTED — Generate redundantPair
      // ────────────────────────────────────────────────────

      // Full overlap (core + infra) for UI display
      const f1Ids = new Set(t1.featureIds);
      const f2Ids = new Set(t2.featureIds);
      const fullOverlap = [...f1Ids].filter(fid => f2Ids.has(fid));

      const p1Price = getCheapestPaidPrice(t1);
      const p2Price = getCheapestPaidPrice(t2);

      const coreFeatureObjs = getFeaturesByIds(coreOverlap);
      const coreFeatureNames = coreFeatureObjs.map(f => f.name);
      const allFeatureNames = getFeaturesByIds(fullOverlap.slice(0, 6)).map(f => f.name);

      const cheaper = p1Price < p2Price ? t1 : t2;
      const moreExpensive = p1Price < p2Price ? t2 : t1;

      // Recommendation text: now mentions core features + category silo
      const recommendation =
        `${cheaper.name} (from ${fmt(p1Price)}/mo) and ${moreExpensive.name} ` +
        `(from ${fmt(p2Price)}/mo) both operate in the **${t1.category}** space ` +
        `and share key capabilities: ${coreFeatureNames.slice(0, 3).join(', ')}. ` +
        `If ${cheaper.name} covers your core needs, consider consolidating by ` +
        `canceling ${moreExpensive.name}.`;

      redundantPairs.push({
        tool1: t1.name,
        tool2: t2.name,
        id1: t1.id,
        id2: t2.id,
        overlappingFeatures: fullOverlap.slice(0, 6),
        overlappingFeatureNames: allFeatureNames,
        overlappingCoreFeatures: coreOverlap,
        overlappingCoreFeatureNames: coreFeatureNames,
        recommendation,
        potentialSavings: Math.min(p1Price, p2Price) * 12,
        siloCategory: t1.category,
        redundancyReason: 'core_overlap',
      });
    }
  }

  // ──────────────────────────────────────────────────────────
  // STEP 2: Sort by potentialSavings descending
  // ──────────────────────────────────────────────────────────
  redundantPairs.sort((a, b) => b.potentialSavings - a.potentialSavings);

  // ──────────────────────────────────────────────────────────
  // STEP 3: Total monthly spend (unchanged)
  // ──────────────────────────────────────────────────────────
  const totalMonthlySpend = tools.reduce(
    (acc, t) => acc + getCheapestPaidPrice(t), 0
  );

  // ──────────────────────────────────────────────────────────
  // STEP 4: Total potential savings (unchanged logic)
  // ──────────────────────────────────────────────────────────
  const totalPotentialSavings = redundantPairs.reduce(
    (acc, r) => acc + r.potentialSavings, 0
  );

  // ──────────────────────────────────────────────────────────
  // STEP 5: unusedTools (REFACTORIZED — see §3.3)
  // ──────────────────────────────────────────────────────────
  const unusedTools = computeUnusedTools(tools, coreFeatureIds);

  return {
    redundantPairs,
    totalMonthlySpend,
    totalPotentialSavings,
    unusedTools,
  };
}
```

### 3.3 Cálculo de `unusedTools` — Nueva Lógica

```typescript
/**
 * Determina qué herramientas son "potentially unused".
 * 
 * Nueva lógica (v2):
 * - SOLO considera features con type === 'core'.
 * - Una herramienta es "unused" si TODAS sus core features están presentes
 *   en al menos UNA otra herramienta del stack.
 * - Requiere stack.length > 1.
 * - Si la herramienta tiene 0 core features, NUNCA se marca como unused.
 * - Las features infrastructure y proprietaryFeatures NO se consideran.
 */
function computeUnusedTools(
  tools: SaaSProductData[],
  coreFeatureIds: Set<string>
): string[] {
  if (tools.length <= 1) return [];

  const unused: string[] = [];

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];

    // Solo considerar core features de esta herramienta
    const toolCoreFeatures = tool.featureIds.filter(fid => coreFeatureIds.has(fid));

    // Si no tiene core features, nunca se considera unused
    if (toolCoreFeatures.length === 0) continue;

    // Construir el conjunto de TODAS las core features de las OTRAS herramientas
    const othersCoreFeatures = new Set<string>();
    for (let j = 0; j < tools.length; j++) {
      if (j !== i) {
        tools[j].featureIds
          .filter(fid => coreFeatureIds.has(fid))
          .forEach(fid => othersCoreFeatures.add(fid));
      }
    }

    // ¿Todas las core features de esta herramienta están cubiertas por otras?
    const allCovered = toolCoreFeatures.every(fid => othersCoreFeatures.has(fid));
    if (allCovered) {
      unused.push(tool.name);
    }
  }

  return unused;
}
```

**Comportamiento esperado vs algoritmo anterior:**

| Stack | Antiguo (todas features) | Nuevo (solo core features) | Razón |
|-------|--------------------------|---------------------------|-------|
| [Teams, Zoom] | Teams "unused" (5 infra features cubiertas por Zoom) | Teams NO "unused" (0 core features) | Teams solo tiene infra features → nunca unused |
| [HubSpot, Salesforce, Pipedrive] | Comportamiento impredecible | Pipedrive "unused" si sus core features ⊂ HubSpot ∪ Salesforce | Correcto: la herramienta más pequeña está totalmente cubierta |
| [Slack, Teams] (con core) | Slack posiblemente "unused" | Depende de si Slack tiene core features únicas (ej. `workflows`) | Si Slack tiene `workflows` y Teams no, Slack NO es unused |

---

## 4. Diseño del Script de Migración

### 4.1 Estructura del Script `scripts/migrate-features.mjs`

```javascript
// scripts/migrate-features.mjs
// Node ESM script. Requiere Node ≥22.12.0.
// Ejecutar: node scripts/migrate-features.mjs
// Exit code: 0 = migración exitosa; 1 = hay featureIds inválidos

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const saasDir = resolve(root, 'src', 'content', 'saas');
const reportPath = resolve(root, 'migration-report.json');
```

#### 4.1.1 Extracción del Registry (sin importar TypeScript)

> Dado que `features-registry.ts` es TypeScript y el script es `.mjs` (ESM puro sin TS), la estrategia es **hardcodear temporalmente** los feature IDs y tipos dentro del script, con un comentario que indique que deben mantenerse sincronizados con `features-registry.ts`. Alternativa: usar `tsx` o `ts-node` para importar el `.ts` directamente. **Decisión:** hardcodear con comentario de sincronización, ya que el script es one-off.

```javascript
/**
 * Feature IDs canónicos extraídos manualmente de src/data/features-registry.ts.
 * ⚠️ MANTENER SINCRONIZADO con features-registry.ts.
 * Si se añade/elimina/renombra una feature, actualizar esta lista.
 */
const REGISTRY_FEATURE_IDS = new Set([
  // Infrastructure features (7)
  'api_access', 'integrations', 'saml_sso', 'audit_logs',
  'sla', 'priority_support', 'roles_permissions',
  // Core features — existing (8)
  'custom_fields', 'workflows', 'advanced_analytics', 'reporting',
  'ai_features', 'white_label', 'crm_basic', 'email_automation',
  // Core features — new (16)
  'real_time_messaging', 'file_sharing', 'ticketing', 'knowledge_base',
  'dashboards', 'alerting', 'recording', 'collaboration',
  'version_control', 'pipeline_mgmt', 'lead_scoring', 'email_templates',
  'a_b_testing', 'video_hosting', 'dependency_tracking', 'kanban_boards',
]);

/** Feature IDs que son type === 'core' (para validar que cada JSON tenga ≥1) */
const CORE_FEATURE_IDS = new Set([
  'custom_fields', 'workflows', 'advanced_analytics', 'reporting',
  'ai_features', 'white_label', 'crm_basic', 'email_automation',
  'real_time_messaging', 'file_sharing', 'ticketing', 'knowledge_base',
  'dashboards', 'alerting', 'recording', 'collaboration',
  'version_control', 'pipeline_mgmt', 'lead_scoring', 'email_templates',
  'a_b_testing', 'video_hosting', 'dependency_tracking', 'kanban_boards',
]);
```

#### 4.1.2 Mapa `CATEGORY_DEFAULT_FEATURES`

```javascript
/**
 * Mapa de categoría SaaS → { core: string[], infrastructure: string[] }
 * 
 * Define las features SUGERIDAS para cada categoría. El script AÑADE estas
 * features al `featureIds` del JSON si no existen ya.
 * 
 * ⚠️ Las sugerencias son CONSERVADORAS. El script no elimina features existentes.
 * Tras la ejecución, revisar migration-report.json y ajustar manualmente si es necesario.
 */
const CATEGORY_DEFAULT_FEATURES = {
  'CRM & Sales': {
    core: ['crm_basic', 'email_automation', 'pipeline_mgmt', 'lead_scoring', 'reporting', 'custom_fields'],
    infrastructure: ['api_access', 'integrations', 'roles_permissions'],
  },
  'Communication': {
    core: ['real_time_messaging', 'file_sharing', 'collaboration'],
    infrastructure: ['api_access', 'integrations', 'saml_sso'],
  },
  'Customer Support': {
    core: ['ticketing', 'knowledge_base', 'reporting', 'dashboards'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Project Management': {
    core: ['custom_fields', 'workflows', 'reporting', 'dashboards', 'dependency_tracking', 'kanban_boards'],
    infrastructure: ['api_access', 'integrations', 'roles_permissions'],
  },
  'Video Conferencing': {
    core: ['real_time_messaging', 'recording', 'file_sharing', 'video_hosting'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Email Marketing': {
    core: ['email_automation', 'email_templates', 'a_b_testing', 'reporting', 'dashboards'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Productivity & Wiki': {
    core: ['custom_fields', 'file_sharing', 'collaboration', 'dashboards', 'knowledge_base'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Dev Tools': {
    core: ['version_control', 'dashboards', 'reporting', 'workflows'],
    infrastructure: ['api_access', 'integrations', 'saml_sso', 'audit_logs'],
  },
  'Design': {
    core: ['file_sharing', 'collaboration', 'version_control'],
    infrastructure: ['api_access', 'integrations'],
  },
  'Monitoring': {
    core: ['alerting', 'dashboards', 'reporting', 'advanced_analytics'],
    infrastructure: ['api_access', 'integrations', 'saml_sso', 'audit_logs'],
  },
};
```

#### 4.1.3 Lógica de Lectura/Escritura de JSONs

```javascript
function migrateProduct(jsonPath, category, currentFeatureIds) {
  const defaults = CATEGORY_DEFAULT_FEATURES[category];
  if (!defaults) {
    console.warn(`⚠️  No defaults for category "${category}" — skipping suggestions`);
    return { added: [], removed: [], unchanged: currentFeatureIds, invalid: [] };
  }

  const currentSet = new Set(currentFeatureIds);
  const added = [];
  const suggestions = [...defaults.core, ...defaults.infrastructure];

  for (const fid of suggestions) {
    if (!currentSet.has(fid) && REGISTRY_FEATURE_IDS.has(fid)) {
      currentSet.add(fid);
      added.push(fid);
    }
  }

  const newFeatureIds = [...currentSet];
  
  // Validación: todos los IDs existen en el registry
  const invalid = newFeatureIds.filter(fid => !REGISTRY_FEATURE_IDS.has(fid));
  const unchanged = currentFeatureIds.filter(fid => !added.includes(fid) && !invalid.includes(fid));

  return { added, removed: [], unchanged, invalid };
}

function main() {
  const files = readdirSync(saasDir).filter(f => f.endsWith('.json'));
  const report = { timestamp: new Date().toISOString(), products: {} };
  let hasErrors = false;

  for (const file of files) {
    const filePath = resolve(saasDir, file);
    const raw = readFileSync(filePath, 'utf-8');
    const product = JSON.parse(raw);
    const slug = product.slug || file.replace('.json', '');

    const result = migrateProduct(filePath, product.category, product.featureIds || []);

    // Verificar al menos 1 core feature
    const hasCoreFeature = (product.featureIds || []).some(fid => CORE_FEATURE_IDS.has(fid))
      || result.added.some(fid => CORE_FEATURE_IDS.has(fid));

    if (!hasCoreFeature) {
      result.warnings = result.warnings || [];
      result.warnings.push('Product has 0 core features after migration');
    }

    if (result.invalid.length > 0) {
      hasErrors = true;
    }

    // Si hay cambios, escribir el JSON actualizado
    if (result.added.length > 0 || result.removed.length > 0) {
      product.featureIds = [
        ...new Set([
          ...product.featureIds.filter(fid => !result.removed.includes(fid)),
          ...result.added,
        ])
      ];
      
      // Escribir solo si no hay dry-run
      writeFileSync(filePath, JSON.stringify(product, null, 2) + '\n', 'utf-8');
    }

    report.products[slug] = result;
  }

  report.hasErrors = hasErrors;
  report.exitCode = hasErrors ? 1 : 0;

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Migration report written to ${reportPath}`);
  console.log(`Total products: ${files.length}`);
  console.log(`Has errors: ${hasErrors}`);

  process.exit(report.exitCode);
}

main();
```

#### 4.1.4 Estructura del Reporte de Migración (`migration-report.json`)

```json
{
  "timestamp": "2026-06-07T12:00:00.000Z",
  "products": {
    "zoom": {
      "added": ["recording", "real_time_messaging", "file_sharing", "video_hosting"],
      "removed": [],
      "unchanged": ["api_access", "integrations", "reporting", "roles_permissions", "saml_sso", "audit_logs", "sla", "priority_support"],
      "invalid": [],
      "warnings": []
    },
    "github": {
      "added": ["version_control", "dashboards", "reporting", "workflows", "api_access", "integrations", "saml_sso", "audit_logs"],
      "removed": [],
      "unchanged": ["sla"],
      "invalid": [],
      "warnings": []
    }
  },
  "hasErrors": false,
  "exitCode": 0
}
```

---

## 5. Diseño de Tests Unitarios

### 5.1 Configuración de Vitest

```typescript
// vitest.config.ts (raíz del proyecto)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Los tests están en src/__tests__/
    include: ['src/__tests__/**/*.test.ts'],
    // Compatible con la configuración existente de Vite/Astro
    environment: 'node', // No necesitamos jsdom (sin DOM)
  },
});
```

```jsonc
// package.json — adiciones:
{
  "scripts": {
    // ... existentes ...
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0"
  }
}
```

### 5.2 Archivos de Test — Estructura General

Cada archivo de test usa **mocks inline** de productos SaaS, NO importa los JSONs reales. Esto garantiza tests deterministas y rápidos. Los mocks son objetos `SaaSProductData` parciales con solo los campos necesarios (`id`, `name`, `category`, `featureIds`, `plans`).

```typescript
// src/__tests__/helpers.ts — Factories de mock reutilizables
import type { SaaSProductData } from '../types/saas';

export function createMockProduct(overrides: Partial<SaaSProductData> = {}): SaaSProductData {
  return {
    id: overrides.id || 'test-tool',
    name: overrides.name || 'Test Tool',
    slug: overrides.slug || 'test-tool',
    category: overrides.category || 'Dev Tools',
    description: overrides.description || 'A test SaaS product for unit testing.',
    websiteUrl: overrides.websiteUrl || 'https://example.com',
    affiliateUrl: overrides.affiliateUrl || null,
    pricingModel: overrides.pricingModel || 'per_user',
    freeTrialDays: overrides.freeTrialDays ?? null,
    lastVerified: overrides.lastVerified || '2026-06-01',
    popularityScore: overrides.popularityScore,
    g2Rating: overrides.g2Rating,
    featureIds: overrides.featureIds || [],
    proprietaryFeatures: overrides.proprietaryFeatures || [],
    plans: overrides.plans || [
      { id: 'basic', name: 'Basic', priceMonthly: 10, priceAnnually: 100, seatsIncluded: 1, features: {}, isEnterprise: false },
    ],
    openSourceAlternatives: overrides.openSourceAlternatives,
  };
}

/** Formatter mock: simplemente devuelve "$N" */
export const mockFmt = (val: number): string => `$${val}`;
```

### 5.3 `src/__tests__/features-registry.test.ts`

**Ámbito:** Validar integridad estructural del registry.

| Test ID | Descripción | Entrada | Salida esperada |
|---------|------------|---------|-----------------|
| FR-01 | Todas las entradas tienen `type` definido | `featureRegistry` | `every(f => f.type === 'core' \|\| f.type === 'infrastructure')` es true |
| FR-02 | No hay IDs duplicados | `featureRegistry` | `new Set(ids).size === featureRegistry.length` |
| FR-03 | `getCoreFeatureIds()` contiene ≥20 IDs | Call `getCoreFeatureIds()` | `result.length >= 20` |
| FR-04 | `getInfrastructureFeatureIds()` contiene exactamente 7 IDs | Call `getInfrastructureFeatureIds()` | `result` es `['api_access','integrations','saml_sso','audit_logs','sla','priority_support','roles_permissions']` (en cualquier orden) |
| FR-05 | `isCoreFeature('crm_basic')` retorna true | Call `isCoreFeature('crm_basic')` | `true` |
| FR-06 | `isCoreFeature('api_access')` retorna false | Call `isCoreFeature('api_access')` | `false` |
| FR-07 | `isInfrastructureFeature('saml_sso')` retorna true | Call `isInfrastructureFeature('saml_sso')` | `true` |
| FR-08 | `filterCoreFeatures(['crm_basic','api_access','dashboards'])` filtra correctamente | Call | `['crm_basic','dashboards']` |
| FR-09 | `filterInfrastructureFeatures(['crm_basic','api_access'])` filtra correctamente | Call | `['api_access']` |
| FR-10 | Ningún `description` tiene longitud < 30 | `featureRegistry` | `every(f => f.description.length >= 30)` es true |
| FR-11 | `featureRegistry.length >= 31` | `featureRegistry` | `>= 31` |
| FR-12 | Cada categoría SaaS tiene ≥3 core features en el registry | Validación manual contra mapa | Pasa |

### 5.4 `src/__tests__/categories.test.ts`

**Ámbito:** Validar estructura de `COMPARISON_SILOS`.

| Test ID | Descripción | Entrada | Salida esperada |
|---------|------------|---------|-----------------|
| CAT-01 | Las 10 categorías del enum son claves en `COMPARISON_SILOS` | `Object.keys(COMPARISON_SILOS)` | Contiene las 10 categorías |
| CAT-02 | Todos los valores en los arrays existen como claves | Validación programática | Pasa |
| CAT-03 | `Dev Tools` NO es comparable con `Communication` | `areCategoriesComparable('Dev Tools', 'Communication')` | `false` |
| CAT-04 | `Dev Tools` NO es comparable con `Video Conferencing` | Call | `false` |
| CAT-05 | `Dev Tools` NO es comparable con `CRM & Sales` | Call | `false` |
| CAT-06 | `Monitoring` NO es comparable con `Communication` | Call | `false` |
| CAT-07 | `Monitoring` NO es comparable con `CRM & Sales` | Call | `false` |
| CAT-08 | `Project Management` SÍ es comparable con `Productivity & Wiki` | `areCategoriesComparable('Project Management', 'Productivity & Wiki')` | `true` |
| CAT-09 | `Project Management` SÍ es comparable con `Dev Tools` | Call | `true` |
| CAT-10 | `CRM & Sales` SÍ es comparable con `Email Marketing` | Call | `true` |
| CAT-11 | `CRM & Sales` SÍ es comparable con `Customer Support` | Call | `true` |
| CAT-12 | Una categoría es comparable consigo misma | `areCategoriesComparable('CRM & Sales', 'CRM & Sales')` | `true` |
| CAT-13 | `Communication` es comparable con `Video Conferencing` (simétrico) | `areCategoriesComparable('Video Conferencing', 'Communication')` | `true` |

### 5.5 `src/__tests__/analyze-stack.test.ts`

**Ámbito:** Verificar que `analyzeStack` (v2) elimina falsos positivos y conserva verdaderos positivos.

Se mockean productos con `featureIds` que representan escenarios reales y se verifica `redundantPairs.length`.

| Test ID | Stack (IDs mock) | Configuración de mocks | Resultado esperado | Razón |
|---------|------------------|----------------------|-------------------|-------|
| T1 | `['github', 'zoom']` | github: cat=Dev Tools, fIds=[5 infra + `version_control`,`dashboards`]; zoom: cat=Video Conferencing, fIds=[5 infra+`recording`,`video_hosting`] | `redundantPairs.length === 0` | Silo distinto: Dev Tools ≠ Video Conferencing |
| T2 | `['bitbucket', 'microsoft-teams']` | bitbucket: cat=Dev Tools, fIds=[5 infra]; teams: cat=Communication, fIds=[5 infra+`real_time_messaging`] | `redundantPairs.length === 0` | Silo distinto: Dev Tools ≠ Communication |
| T3 | `['gitlab', 'zoom']` | gitlab: cat=Dev Tools, fIds=[5 infra+`version_control`,`workflows`]; zoom: cat=Video Conferencing | `redundantPairs.length === 0` | Silo distinto |
| T4 | `['hubspot', 'salesforce']` | hubspot: cat=CRM & Sales, fIds=[5 infra+`crm_basic`,`pipeline_mgmt`,`lead_scoring`,`email_automation`,`reporting`,`custom_fields`]; salesforce: cat=CRM & Sales, fIds=[5 infra+`crm_basic`,`pipeline_mgmt`,`lead_scoring`,`reporting`,`dashboards`] | `redundantPairs.length >= 1` | Mismo silo CRM & Sales, core overlap ≥60% |
| T5 | `['slack', 'microsoft-teams']` | slack: cat=Communication, fIds=[5 infra+`real_time_messaging`,`file_sharing`,`collaboration`,`workflows`]; teams: cat=Communication, fIds=[5 infra+`real_time_messaging`,`file_sharing`,`collaboration`] | `redundantPairs.length >= 1` | Mismo silo Communication, core overlap ≥60% |
| T6 | `['github', 'slack', 'zoom']` | github: Dev Tools; slack: Communication; zoom: Video Conferencing — todos con core+infra features | `redundantPairs.length === 0` | Ningún par comparte silo |
| T7 | `['slack']` | slack: Communication, fIds=[core+infra] | `redundantPairs: []`, `totalMonthlySpend > 0`, `unusedTools: []` | Stack de 1 herramienta |
| T8 | `['github', 'bitbucket']` | Ambos Dev Tools, github: fIds=[5 infra+`version_control`,`workflows`,`dashboards`]; bitbucket: fIds=[5 infra+`version_control`,`dashboards`] | ≥1 redundancia (bitbucket core overlap 100% con github) | Mismo silo, core overlap 2/2 = 100% ≥ 60% |
| T9 | `['jira', 'notion']` | jira: cat=Project Management, fIds=[5 infra+`workflows`,`kanban_boards`,`dependency_tracking`,`reporting`,`custom_fields`]; notion: cat=Productivity & Wiki, fIds=[5 infra+`collaboration`,`file_sharing`,`knowledge_base`,`custom_fields`,`dashboards`] | Depende del overlap real: `custom_fields` es la única core compartida. 1/5 = 20% < 60% → `redundantPairs.length === 0` | Mismo silo (PM ⇔ Prod&Wiki) pero core overlap < 60% |
| T10 | `['datadog', 'vercel']` | datadog: cat=Monitoring, fIds=[5 infra+`alerting`,`dashboards`,`reporting`]; vercel: cat=Dev Tools, fIds=[5 infra+`version_control`,`workflows`] | `redundantPairs.length === 0` si no hay core overlap | Silo Monitoring ⇔ Dev Tools (sí comparable), pero 0 core overlap → 0 < 2 |

**Formato de cada test:**
```typescript
test('T1: GitHub vs Zoom — no redundancia (distintos silos)', () => {
  const github = createMockProduct({
    id: 'github', name: 'GitHub', category: 'Dev Tools',
    featureIds: ['api_access','integrations','saml_sso','audit_logs','roles_permissions','sla','version_control','dashboards'],
    plans: [{ id: 'team', name: 'Team', priceMonthly: 4, priceAnnually: 48, seatsIncluded: 1, features: {}, isEnterprise: false }],
  });
  const zoom = createMockProduct({
    id: 'zoom', name: 'Zoom', category: 'Video Conferencing',
    featureIds: ['api_access','integrations','reporting','roles_permissions','saml_sso','audit_logs','sla','priority_support','recording','video_hosting'],
    plans: [{ id: 'pro', name: 'Pro', priceMonthly: 14, priceAnnually: 168, seatsIncluded: 1, features: {}, isEnterprise: false }],
  });

  const result = analyzeStack(['github', 'zoom'], [github, zoom], mockFmt);

  expect(result.redundantPairs).toHaveLength(0);
});
```

### 5.6 `src/__tests__/unused-tools.test.ts`

**Ámbito:** Verificar que `unusedTools` solo considera core features.

| Test ID | Stack | Descripción del escenario | Resultado esperado |
|---------|-------|--------------------------|-------------------|
| U1 | `['teams', 'zoom']` | Teams tiene SOLO infra features (api_access, integrations, saml_sso, audit_logs, roles_permissions). Zoom tiene infra + core (recording, video_hosting, reporting). | `unusedTools` NO incluye 'Microsoft Teams' (0 core features) |
| U2 | `['hubspot', 'salesforce', 'pipedrive']` | HubSpot y Salesforce cubren todas las core features de Pipedrive (pipeline_mgmt, lead_scoring). Pipedrive tiene ≥1 core feature. | `unusedTools` incluye 'Pipedrive' |
| U3 | `['slack', 'teams']` | Slack tiene `real_time_messaging`, `file_sharing`, `collaboration`, `workflows`. Teams tiene `real_time_messaging`, `file_sharing`, `collaboration`. Slack tiene `workflows` que Teams no. | `unusedTools` NO incluye 'Slack' (tiene core feature única) |
| U4 | `['tool_a', 'tool_b']` | Tool A tiene 0 core features, Tool B tiene 3 core features. Stack de 2. | `unusedTools` NO incluye 'Tool A' (0 core features) |
| U5 | `['tool_a']` | Stack de 1 herramienta con core features | `unusedTools` = [] |
| U6 | `['tool_a', 'tool_b']` | Ambas herramientas tienen las mismas core features (idénticas) | `unusedTools` incluye ambas o una (depende del orden de iteración; cualquiera es válido) |

---

## 6. Plan de Integración con Código Existente

### 6.1 Preservación de `RELATED_CATEGORIES`

**Archivo:** `src/lib/categories.ts`

`RELATED_CATEGORIES` **permanece idéntico**. Se usa exclusivamente en `DowngradeEngine.tsx` para:
- `getAlternatives()` en `src/lib/saas-data.ts`
- Búsqueda de alternativas externas en `DowngradeEngine.tsx`

**Consumidores que NO se tocan:**
- `src/lib/saas-data.ts`: `getRelatedComparisons()` y `getAlternatives()`
- `src/components/DowngradeEngine.tsx`: `useMemo` de `alternativeSuggestions`

`COMPARISON_SILOS` se añade en el mismo archivo pero es un export independiente, usado solo por `StackAuditor.tsx`.

### 6.2 Preservación de `content.config.ts`

**Archivo:** `src/content.config.ts`

**NO se modifica.** El schema Zod permanece igual:
- `featureIds: z.array(z.string()).default([])` — sigue siendo `string[]`, sin cambios.
- Las categorías del enum siguen siendo las 10 existentes.
- `proprietaryFeatures` sigue usando `SaasFeatureSchema` con `comparable: z.literal(false)`.
- El campo `type` **no aplica** a `proprietaryFeatures` ni a los JSONs; solo existe en `RegistryFeature`.

### 6.3 Preservación de `validate-data.mjs`

**Archivo:** `scripts/validate-data.mjs`

**Cambio mínimo requerido:** Sustituir la lista hardcodeada de `featureRegistry` (líneas 19-22 actuales) por la nueva lista completa con los 31 IDs. Esto es necesario para que el validador reconozca las nuevas features como válidas.

**Alternativa a futuro:** En lugar de hardcodear, se podría generar un archivo JSON durante el build (`npm run build` → extraer IDs del registry → escribir `feature-ids.json`) y que el validador lo lea. Pero para el alcance de esta refactorización, **actualizar la lista hardcodeada es suficiente y de menor riesgo**.

**Cambio específico (líneas 18-22 actuales):**
```javascript
// ANTES:
featureRegistry = [
  'api_access','integrations','custom_fields','workflows','saml_sso','audit_logs','sla',
  'priority_support','roles_permissions','advanced_analytics','reporting','ai_features','white_label','crm_basic','email_automation'
];

// DESPUÉS:
featureRegistry = [
  // Infrastructure features (7)
  'api_access','integrations','saml_sso','audit_logs','sla','priority_support','roles_permissions',
  // Core features — existing (8)
  'custom_fields','workflows','advanced_analytics','reporting','ai_features','white_label','crm_basic','email_automation',
  // Core features — new (16)
  'real_time_messaging','file_sharing','ticketing','knowledge_base','dashboards','alerting','recording','collaboration',
  'version_control','pipeline_mgmt','lead_scoring','email_templates','a_b_testing','video_hosting','dependency_tracking','kanban_boards',
];
```

### 6.4 Integración de `StackAuditor.tsx` con el Nuevo Algoritmo

**Cambios en imports:**
```typescript
// ANTES:
import { getFeaturesByIds } from '../data/features-registry';

// DESPUÉS:
import { getFeaturesByIds, getCoreFeatureIds } from '../data/features-registry';
import { areCategoriesComparable } from '../lib/categories';
```

**Cambios en la firma de `analyzeStack`:** Ninguno. Los parámetros y el tipo de retorno son compatibles hacia atrás (los nuevos campos en `StackAuditResult` son adiciones no destructivas).

**Cambios en la UI (StackAuditorInner):**
- El JSX que renderiza `overlappingFeatureNames` sigue funcionando (muestra todos los features solapados).
- Se puede añadir opcionalmente un badge que muestre `overlappingCoreFeatureNames` o `siloCategory`, pero no es requisito obligatorio de esta refactorización.
- El mensaje de "No Critical Redundancies Found" (línea 374-379) se mantiene.

---

## 7. Decisiones de Diseño y Justificaciones

### 7.1 ¿Por qué `type: 'core' | 'infrastructure'` en lugar de listas hardcodeadas?

**Decisión:** Campo `type` en la interfaz `RegistryFeature`.

**Justificación:**
1. **Única fuente de verdad.** La clasificación vive junto al dato canónico de la feature. Si se añade una feature nueva, el desarrollador debe declarar su `type` — no puede olvidarse de añadirla a una lista separada.
2. **Derivable en runtime.** `featureRegistry.filter(f => f.type === 'core')` — sin imports de arrays hardcodeados que puedan divergir.
3. **Extensible.** Si en el futuro se añade un tercer tipo (ej. `'collaboration'`), basta con extender el union type.
4. **La `category` existente se preserva** como subcategoría técnica (`security`, `integration`, etc.), manteniendo compatibilidad con cualquier código que la referencie.

**Trade-off:** Requiere modificar 31 entradas del registry (añadir una línea `type: ...` por feature). Es trabajo manual pero trivial.

### 7.2 ¿Por qué `COMPARISON_SILOS` como `Record<string, string[]>` en lugar de un grafo con pesos?

**Decisión:** Matriz binaria de compatibilidad.

**Justificación:**
1. **Consistencia con el código existente.** `RELATED_CATEGORIES` ya usa `Record<string, string[]>`. Mantener el mismo patrón reduce carga cognitiva.
2. **Consulta O(1).** `COMPARISON_SILOS[cat1]?.includes(cat2)` es una búsqueda en array de ≤5 elementos — insignificante.
3. **Suficiente para 10 categorías.** Un grafo con pesos añadiría complejidad sin beneficio medible: el umbral >60% sobre core features ya filtra suficientemente. Los pesos serían especulativos sin datos empíricos.
4. **Más restrictivo que `RELATED_CATEGORIES` por diseño.** `DowngradeEngine` busca alternativas (amplio); `StackAuditor` detecta redundancia (estricto). Es mejor perder una redundancia real que reportar una falsa.

**Trade-off:** Si se añade una categoría nueva, hay que definir manualmente con cuáles es comparable. Mitigación: los tests unitarios (`CAT-01`, `CAT-02`) verifican que todas las categorías son claves.

### 7.3 ¿Por qué umbral >60% en lugar de 40%?

**Decisión:** `REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6`.

**Justificación:**
1. **El umbral del 40% era la causa directa de falsos positivos.** Con el algoritmo antiguo, GitHub y Zoom con 5 de 5 features solapadas (100%) superaban el umbral de `Math.ceil(5 * 0.4) = 2`. El 60% requiere que las herramientas compartan la mayoría de sus capacidades de dominio.
2. **Ahora se aplica sobre core features, no sobre todas.** El denominador es más pequeño (solo core features) → el umbral debe ser más alto para mantener el mismo nivel de exigencia.
3. **Interpretación de negocio:** "Dos herramientas son redundantes si comparten ≥60% de sus capacidades funcionales diferenciadoras." Esto es conservador pero correcto para un auditor financiero.
4. **Parametrizable.** Definido como constante `REDUNDANCY_CORE_OVERLAP_THRESHOLD` en el código, ajustable sin reescribir la lógica.

**Trade-off:** Productos con pocas core features (ej. 2) y que comparten 1 (50%) no se detectan como redundantes aunque podría haber un caso legítimo. El mínimo absoluto de 2 features compartidas protege contra este caso: si comparten 2 de 2 (100%) sí se detectan.

### 7.4 Rendimiento: O(n²) es aceptable

**Complejidad:** El algoritmo recorre todos los pares (i, j) → O(n²) donde n = número de herramientas en el stack (típicamente ≤10, máximo 50).

**Optimizaciones aplicadas:**
1. El filtro de silo (`areCategoriesComparable`) es O(1) — descarta pares antes del cálculo costoso de intersección de features.
2. El filtrado de core features (`featureIds.filter`) es O(k) donde k ≤ 31 — insignificante.
3. La intersección (`Set.has`) es O(k) — también insignificante.

**Tiempo estimado:** Para n=50 (1225 pares), con silos que descartan ~70% de pares, solo ~368 pares llegan al cálculo de intersección. Tiempo total < 50ms en hardware moderno.

**No se justifica optimizar a O(n)** porque n es pequeño y la complejidad adicional de precomputar un índice de features por categoría no compensa el costo de mantenimiento.

### 7.5 Retrocompatibilidad con JSONs Existentes

**Estrategia:**
1. El script `migrate-features.mjs` **nunca elimina** `featureIds` existentes — solo añade los sugeridos por categoría.
2. Si un JSON tiene un `featureId` que ya no existe en el registry (caso improbable porque no se renombran IDs, solo se añaden), el script lo reporta como `invalid` en `migration-report.json` pero **no lo elimina**.
3. El validador (`validate-data.mjs`) con la lista actualizada detectará el ID inválido → el desarrollador lo corrige manualmente.
4. Los `proprietaryFeatures` no se tocan en absoluto.

**Caso hipotético de ID renombrado:** Si `old_feature_id` se renombró a `new_feature_id`, el script lo reporta como `invalid`. El desarrollador busca en qué JSONs aparece, reemplaza manualmente, y vuelve a ejecutar la migración.

---

## 8. Resumen de Archivos Afectados

| Archivo | Acción | Líneas estimadas |
|---------|--------|-----------------|
| `src/data/features-registry.ts` | MODIFICAR — Extender interfaz con `type`, 16 features nuevas, 6 helpers nuevos | +100 |
| `src/lib/categories.ts` | MODIFICAR — Añadir `COMPARISON_SILOS` + `areCategoriesComparable()` | +50 |
| `src/types/saas.ts` | MODIFICAR — Extender `StackAuditResult.redundantPairs[]` con 4 campos nuevos | +20 |
| `src/components/StackAuditor.tsx` | REFACTORIZAR — Nueva `analyzeStack`, nuevo `computeUnusedTools`, imports actualizados | ~60 nuevas / ~50 modificadas |
| `scripts/migrate-features.mjs` | NUEVO — Script de migración | ~150 |
| `scripts/validate-data.mjs` | MODIFICAR — Actualizar lista hardcodeada de feature IDs | +16 (array extendido) |
| `src/content/saas/*.json` (50) | MIGRAR — Ejecutar script, revisar reporte, commit | ~300 líneas añadidas total |
| `src/__tests__/features-registry.test.ts` | NUEVO — 12 tests | ~120 |
| `src/__tests__/categories.test.ts` | NUEVO — 13 tests | ~100 |
| `src/__tests__/analyze-stack.test.ts` | NUEVO — 10 tests | ~250 |
| `src/__tests__/unused-tools.test.ts` | NUEVO — 6 tests | ~150 |
| `src/__tests__/helpers.ts` | NUEVO — Mocks factory | ~40 |
| `vitest.config.ts` | NUEVO — Config Vitest | ~10 |
| `package.json` | MODIFICAR — Scripts + devDependency | +3 líneas |

**Total estimado:** ~1,400 líneas nuevas, ~70 líneas modificadas, 0 líneas eliminadas (solo adiciones).
