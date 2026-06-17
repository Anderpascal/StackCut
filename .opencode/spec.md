# Especificación Técnica Formal — Refactorización de StackAuditor: Categorización, Silos, Filtros y Migración

## 1. Alcance y Objetivos

### 1.1 Qué se refactoriza

| Componente | Archivo(s) | Tipo de cambio |
|------------|-----------|----------------|
| **Feature Registry** | `src/data/features-registry.ts` | Ampliar de 15 a ≥25 features; añadir campo `type: 'core' \| 'infrastructure'`; añadir funciones helper de consulta por tipo. |
| **Silos de Comparación** | `src/lib/categories.ts` | Añadir `COMPARISON_SILOS: Record<string, string[]>` que define qué categorías SaaS pueden compararse para detectar redundancia. |
| **Algoritmo `analyzeStack`** | `src/components/StackAuditor.tsx` | Refactorizar para (a) filtrar pares por silo, (b) calcular solapamiento solo sobre features `type === 'core'`, (c) usar umbral >60% del set menor. |
| **Lógica `unusedTools`** | `src/components/StackAuditor.tsx` | Refactorizar para solo considerar features `type === 'core'` al determinar si una herramienta es redundante. |
| **Tipos compartidos** | `src/types/saas.ts` | Extender `StackAuditResult` con campos opcionales: `overlappingCoreFeatures`, `siloCategory`, `redundancyReason`. |
| **Base de datos JSON** | `src/content/saas/*.json` (50 archivos) | Migrar `featureIds` para alinearlos con el nuevo registry ampliado. |
| **Validador de datos** | `scripts/validate-data.mjs` | Reemplazar la lista hardcodeada de `featureRegistry` por importación dinámica desde el registry real. |
| **Tests unitarios** | `src/__tests__/` (nuevos) | Añadir Vitest + tests para el registry, los silos, el algoritmo `analyzeStack` y la lógica `unusedTools`. |

### 1.2 Qué NO se refactoriza

- **`DowngradeEngine.tsx`**: Su lógica de búsqueda de alternativas no se modifica. El mapa `RELATED_CATEGORIES` que usa permanece intacto.
- **Sistema de multidivisa** (`src/lib/currency.ts`, `currency-context.ts`): Sin cambios.
- **Páginas Astro** (`audit.astro`, `downgrade.astro`): Sin cambios estructurales. Solo cambiarán los resultados renderizados.
- **Componentes UI** (`StackAuditor.tsx` fuera de `analyzeStack`/`unusedTools`): Sin cambios en JSX, estilos, o lógica de interacción de usuario (search, localStorage, debounce).
- **Content Collections config** (`src/content.config.ts`): El schema Zod de los JSONs no cambia (los `featureIds` siguen siendo `z.array(z.string())`). El campo `type` no aplica a `proprietaryFeatures`.
- **Estilos Tailwind y CSS**: Sin cambios.

### 1.3 Problemas raíz que se resuelven

1. **Falsos positivos masivos en detección de redundancias**: Bitbucket vs Microsoft Teams (100% overlap), GitHub vs Zoom, GitLab vs Zoom, Jira vs Notion — todas generaban falsos positivos porque el algoritmo no diferenciaba entre features de dominio funcional (`crm_basic`, `workflows`) y features de infraestructura commodity (`api_access`, `saml_sso`, `audit_logs`) ni consideraba las categorías de los productos.

2. **`unusedTools` demasiado agresiva**: Una herramienta se marcaba como "unused" si TODAS sus `featureIds` estaban presentes en al menos otra herramienta del stack, sin considerar `proprietaryFeatures` ni el dominio funcional.

3. **Recomendaciones genéricas y peligrosas**: El texto generado por `analyzeStack` siempre sugiere cancelar la herramienta más cara, lo que puede ser un consejo de negocio erróneo si las herramientas son de dominios distintos.

4. **Registry limitado**: Solo 15 features comparables, sin distinción funcional core vs infrastructure.

5. **Validador hardcodeado**: `validate-data.mjs` duplica manualmente la lista de feature IDs, divergiendo potencialmente del registry real.

6. **Cero tests automatizados**: Ningún test unitario, de integración o E2E para la lógica crítica de auditoría.

### 1.4 Qué se preserva

- **`DowngradeEngine`**: Su lógica de búsqueda de alternativas vía `RELATED_CATEGORIES` permanece intacta. `COMPARISON_SILOS` es un mapa independiente usado exclusivamente por `StackAuditor`.
- **`featureRegistry.category`**: La categorización existente (`core`, `security`, `integration`, `analytics`, `support`) se mantiene como subcategoría. El nuevo campo `type` es ortogonal a `category`.
- **`getCheapestPaidPrice()`**: Sin cambios en su lógica de cálculo.
- **`SaaSProductData.featureIds`**: El campo sigue siendo `string[]` sin cambios en el schema Zod.
- **Firma pública de `analyzeStack`**: Los parámetros de entrada y el tipo de retorno base (`StackAuditResult`) se mantienen compatibles hacia atrás. Los campos añadidos son opcionales.
- **`localStorage` persistencia del stack**: Sin cambios.

---

## 2. Requisitos Funcionales y Reglas de Negocio

### RF-1: Categorización de Features (`type: 'core' | 'infrastructure'`)

**Descripción**: La interfaz `RegistryFeature` debe extenderse con un nuevo campo `type` de tipo union `'core' | 'infrastructure'`. Este campo clasifica cada feature comparable según su naturaleza funcional:

- **`core`**: Features que definen el dominio funcional diferenciador de un producto SaaS. Son la razón principal por la que una empresa elige una herramienta sobre otra (ej. `crm_basic`, `email_automation`, `workflows`).
- **`infrastructure`**: Features que son prerrequisitos técnicos, de seguridad o de compliance compartidos por la mayoría de productos enterprise. No son diferenciadores de dominio (ej. `api_access`, `saml_sso`, `audit_logs`, `roles_permissions`, `sla`, `priority_support`).

**Reglas de validación**:
- Todo `RegistryFeature` debe tener el campo `type` definido explícitamente.
- `type` solo puede ser `'core'` o `'infrastructure'`.
- Las features `api_access`, `integrations`, `saml_sso`, `audit_logs`, `sla`, `priority_support`, `roles_permissions` deben tener `type: 'infrastructure'`.
- Las features `crm_basic`, `email_automation`, `custom_fields`, `workflows`, `advanced_analytics`, `reporting`, `ai_features`, `white_label` deben tener `type: 'core'`.
- El campo `category` preexistente se mantiene sin cambios.
- El campo `type` no aplica a `proprietaryFeatures` (que tienen `comparable: false` y por definición son core de su producto).

**Caso límite**: Si una feature cambia de `core` a `infrastructure` en el futuro, el cambio debe reflejarse tanto en el registry como en los tests.

**Criterio de aceptación**:
- [ ] **AC-1.1**: Toda entrada del array `featureRegistry` tiene el campo `type` con valor `'core'` o `'infrastructure'`.
- [ ] **AC-1.2**: `featureRegistry.filter(f => f.type === 'infrastructure').map(f => f.id)` contiene exactamente `['api_access', 'integrations', 'saml_sso', 'audit_logs', 'sla', 'priority_support', 'roles_permissions']`.
- [ ] **AC-1.3**: `featureRegistry.filter(f => f.type === 'core').map(f => f.id)` contiene al menos `['crm_basic', 'email_automation', 'custom_fields', 'workflows', 'advanced_analytics', 'reporting', 'ai_features', 'white_label']`.
- [ ] **AC-1.4**: `npm run build` compila sin errores de tipo en TypeScript estricto.
- [ ] **AC-1.5**: Se exporta una función helper `getCoreFeatureIds(): string[]` que devuelve los IDs de las features con `type === 'core'`.

---

### RF-2: Catálogo Exhaustivo de Core Features

**Descripción**: El `featureRegistry` debe ampliarse de 15 a un mínimo de **25 features**, garantizando que cada vertical SaaS tenga al menos **3 core features ultra-específicas** que capturen la esencia funcional de ese dominio. Las nuevas features deben tener `type: 'core'` por defecto, salvo que sean claramente infrastructure.

**Reglas de negocio**:
- El registry debe contener ≥25 entradas totales (core + infrastructure).
- Cada una de las 10 categorías SaaS debe tener al menos 3 core features que le sean específicas (no compartidas genéricamente con otras categorías).
- No deben existir etiquetas vagas como "Advanced Workflows" sin una descripción clara y accionable. Cada feature debe tener `description` ≥ 30 caracteres que explique qué capacidades concretas representa.
- Los IDs de feature deben seguir el patrón `snake_case` (`/^[a-z0-9_]+$/`).
- No debe haber IDs duplicados.

**Features nuevas sugeridas (mínimo 10 adicionales)**:

| ID | Name | Category (sub) | Type | Justificación |
|----|------|---------------|------|---------------|
| `real_time_messaging` | Real-Time Messaging | core | core | Chat en tiempo real, diferenciador de Communication |
| `file_sharing` | File Sharing & Storage | core | core | Compartición de archivos, diferenciador de Productividad |
| `ticketing` | Ticketing System | core | core | Sistema de tickets, diferenciador de Customer Support |
| `knowledge_base` | Knowledge Base | core | core | Base de conocimiento, diferenciador de Customer Support |
| `dashboards` | Custom Dashboards | core | core | Dashboards personalizables, diferenciador de Analytics |
| `alerting` | Alerting & Notifications | core | core | Alertas configurables, diferenciador de Monitoring |
| `recording` | Session Recording | core | core | Grabación de sesiones, diferenciador de Video Conferencing |
| `collaboration` | Real-Time Collaboration | core | core | Colaboración en tiempo real, diferenciador de Productividad |
| `version_control` | Version Control | core | core | Control de versiones, diferenciador de Design/Dev Tools |
| `pipeline_mgmt` | Pipeline Management | core | core | Gestión de pipeline de ventas, diferenciador de CRM |
| `lead_scoring` | Lead Scoring | core | core | Puntuación de leads, diferenciador de CRM |
| `email_templates` | Email Templates | core | core | Plantillas de email, diferenciador de Email Marketing |
| `a_b_testing` | A/B Testing | core | core | Tests A/B, diferenciador de Email Marketing |
| `video_hosting` | Video Hosting | core | core | Hosting de video nativo, diferenciador de Video Conferencing |
| `dependency_tracking` | Dependency Tracking | core | core | Seguimiento de dependencias entre tareas, diferenciador de Project Management |

**Reglas de validación**:
- Cada ID debe ser único en el registry.
- Cada `name` debe ser único en el registry.
- `isEnterpriseLocked` debe reflejar correctamente si la feature típicamente requiere plan enterprise.

**Caso límite**: Una feature como `integrations` que es `type: 'infrastructure'` pero cuya subcategoría es `integration` — no hay conflicto. `type` y `category` son ortogonales.

**Criterio de aceptación**:
- [ ] **AC-2.1**: `featureRegistry.length >= 25`.
- [ ] **AC-2.2**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio CRM (contact, lead, deal, pipeline, sales).
- [ ] **AC-2.3**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio Communication (chat, messaging, channel, thread).
- [ ] **AC-2.4**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio Project Management (task, sprint, board, issue, gantt, dependency).
- [ ] **AC-2.5**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio Customer Support (ticket, helpdesk, knowledge, agent).
- [ ] **AC-2.6**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio Dev Tools (repository, code, deployment, pipeline, version).
- [ ] **AC-2.7**: Existen al menos 3 features con `type === 'core'` cuya descripción mencione explícitamente conceptos del dominio Monitoring (alert, metric, dashboard, log, incident).
- [ ] **AC-2.8**: No existen descripciones con longitud < 30 caracteres.
- [ ] **AC-2.9**: No hay IDs duplicados en el registry.
- [ ] **AC-2.10**: No hay `name` duplicados en el registry.

---

### RF-3: Silos de Comparación (`COMPARISON_SILOS`)

**Descripción**: Se debe definir un mapa `COMPARISON_SILOS: Record<string, string[]>` en `src/lib/categories.ts` que establezca qué categorías SaaS son comparables entre sí para efectos de detección de redundancia. Dos herramientas solo pueden ser comparadas si sus categorías pertenecen al mismo silo (es decir, si `COMPARISON_SILOS[t1.category]` incluye `t2.category`).

**Principio rector**: Dos categorías son comparables si y solo si las herramientas de ambas categorías pueden sustituirse entre sí en algún escenario de negocio real.

**Definición canónica de `COMPARISON_SILOS`**:

```typescript
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
```

**Reglas de validación**:
- Toda categoría del enum Zod en `content.config.ts` debe aparecer como **clave** en `COMPARISON_SILOS`.
- Toda categoría que aparezca como **valor** en algún array debe existir como **clave** en `COMPARISON_SILOS`.
- La relación **no** tiene que ser simétrica forzosamente, pero en la práctica se recomienda que lo sea para evitar omisiones.
- `Dev Tools` **NO** debe ser comparable con `Communication`, `Video Conferencing`, `CRM & Sales`, `Email Marketing`, `Design`, o `Customer Support`.
- `Monitoring` **NO** debe ser comparable con `Communication`, `CRM & Sales`, `Email Marketing`, o `Customer Support`.
- `Project Management` **SÍ** debe ser comparable con `Productivity & Wiki` y `Dev Tools`.
- `CRM & Sales` **SÍ** debe ser comparable con `Email Marketing` y `Customer Support`.

**Caso límite**: Si se añade una nueva categoría SaaS en el futuro, debe añadirse como clave en `COMPARISON_SILOS` y como valor en las categorías con las que sea comparable. Si no se añade, el algoritmo tratará esa categoría como no comparable con ninguna otra (no genera falsos positivos, pero podría generar falsos negativos).

**Criterio de aceptación**:
- [ ] **AC-3.1**: Las 10 categorías del enum (`CRM & Sales`, `Project Management`, `Communication`, `Customer Support`, `Email Marketing`, `Video Conferencing`, `Productivity & Wiki`, `Dev Tools`, `Design`, `Monitoring`) existen como claves en `COMPARISON_SILOS`.
- [ ] **AC-3.2**: `COMPARISON_SILOS['Dev Tools']` **no** incluye `'Communication'`, `'Video Conferencing'`, `'CRM & Sales'`, `'Email Marketing'`, `'Design'`, ni `'Customer Support'`.
- [ ] **AC-3.3**: `COMPARISON_SILOS['Monitoring']` **no** incluye `'Communication'`, `'CRM & Sales'`, `'Email Marketing'`, ni `'Customer Support'`.
- [ ] **AC-3.4**: `COMPARISON_SILOS['Project Management']` incluye `'Productivity & Wiki'` y `'Dev Tools'`.
- [ ] **AC-3.5**: `COMPARISON_SILOS['CRM & Sales']` incluye `'Email Marketing'` y `'Customer Support'`.
- [ ] **AC-3.6**: Toda categoría que aparece como valor en algún array existe como clave en `COMPARISON_SILOS`.
- [ ] **AC-3.7**: Se exporta una función helper `areCategoriesComparable(cat1: string, cat2: string): boolean` que realiza la consulta O(1) sobre `COMPARISON_SILOS`.

---

### RF-4: Algoritmo `analyzeStack` Refactorizado

**Descripción**: La función `analyzeStack` en `src/components/StackAuditor.tsx` debe ser refactorizada para implementar tres capas de filtrado que eliminan los falsos positivos:

1. **Filtro de Silo (O(1))**: Antes de calcular cualquier solapamiento, verificar que `t1.category` y `t2.category` pertenezcan al mismo silo. Si no, continuar con el siguiente par.
2. **Filtro de Core Features**: Del conjunto `t1.featureIds` y `t2.featureIds`, conservar solo aquellos IDs que correspondan a features con `type === 'core'` en el registry.
3. **Umbral >60%**: Calcular el solapamiento entre los conjuntos de core features. Si `coreOverlap.length < Math.ceil(Math.min(t1Core.length, t2Core.length) * 0.6)`, descartar el par. Además, se requiere `coreOverlap.length >= 2` como mínimo absoluto.

**Reglas de negocio**:
- Dos herramientas de categorías incompatibles (según `COMPARISON_SILOS`) **NUNCA** deben generar una entrada en `redundantPairs`.
- Solo las features con `type === 'core'` se consideran para el cálculo de solapamiento. Las features `infrastructure` se excluyen completamente del cómputo.
- El umbral de redundancia es **>60%** del set de core features más pequeño. Es decir: `coreOverlapCount / min(t1CoreCount, t2CoreCount) > 0.6`.
- Si `Math.min(t1CoreCount, t2CoreCount) === 0`, el par nunca es redundante.
- La recomendación generada debe mencionar **explícitamente por nombre** las core features solapadas (no features genéricas).
- El campo `potentialSavings` se calcula igual que antes: `Math.min(p1Price, p2Price) * 12`.
- La recomendación debe incluir el silo o dominio compartido (ej. "Both are CRM tools that overlap on...").
- El ordenamiento por `potentialSavings` descendente se mantiene.

**Modificaciones a `StackAuditResult`**:

```typescript
export interface StackAuditResult {
  redundantPairs: {
    tool1: string;
    tool2: string;
    id1: string;
    id2: string;
    overlappingFeatures: string[];        // Todos los featureIds solapados (core + infra) — para UI
    overlappingFeatureNames: string[];    // Nombres de todos los features solapados — para UI
    overlappingCoreFeatures: string[];    // NUEVO: Solo los featureIds core solapados
    overlappingCoreFeatureNames: string[];// NUEVO: Nombres de solo las core features solapadas
    recommendation: string;
    potentialSavings: number;
    siloCategory: string;                 // NUEVO: La categoría del silo compartido (ej. "CRM & Sales")
    redundancyReason: 'core_overlap';     // NUEVO: Razón por la que se detectó redundancia
  }[];
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  unusedTools: string[];
}
```

**Refactorización de `unusedTools`**:
- La lógica de `unusedTools` debe modificarse para **solo considerar features con `type === 'core'`**.
- Una herramienta se considera "potentially unused" si **todas** sus core features están presentes en el conjunto de core features del resto de herramientas del stack, y hay al menos 2 herramientas en el stack.
- Las features `infrastructure` y `proprietaryFeatures` **no** se consideran para el cálculo de `unusedTools`.
- Si una herramienta tiene **0 core features** en el registry, nunca se marca como "unused".

**Caso límite**: Un stack con 2 herramientas del mismo silo donde una tiene 2 core features y la otra tiene 5, y comparten 2 → `coreOverlap.length = 2`, `min(2,5) = 2`, `threshold = Math.ceil(2 * 0.6) = 2`, `2 >= 2` → redundancia detectada (correcto: la herramienta más pequeña está completamente cubierta).

**Caso límite**: Un stack con 2 herramientas donde una tiene 0 core features y la otra tiene 5 core features → `min(0,5) = 0`, no se calcula umbral, no hay redundancia. La herramienta con 0 core features nunca se marca como "unused".

**Criterio de aceptación**:
- [ ] **AC-4.1**: `analyzeStack(['github', 'zoom'], allProducts, fmt)` devuelve `redundantPairs.length === 0` (distintos silos: Dev Tools ≠ Video Conferencing).
- [ ] **AC-4.2**: `analyzeStack(['bitbucket', 'microsoft-teams'], allProducts, fmt)` devuelve `redundantPairs.length === 0` (distintos silos: Dev Tools ≠ Communication).
- [ ] **AC-4.3**: `analyzeStack(['gitlab', 'zoom'], allProducts, fmt)` devuelve `redundantPairs.length === 0` (distintos silos: Dev Tools ≠ Video Conferencing).
- [ ] **AC-4.4**: `analyzeStack(['hubspot', 'salesforce'], allProducts, fmt)` devuelve `redundantPairs.length >= 1` (mismo silo: CRM & Sales, ≥60% core overlap).
- [ ] **AC-4.5**: `analyzeStack(['slack', 'microsoft-teams'], allProducts, fmt)` devuelve `redundantPairs.length >= 1` (mismo silo: Communication, ≥60% core overlap).
- [ ] **AC-4.6**: `analyzeStack(['jira', 'notion'], allProducts, fmt)` devuelve resultado consistente: si core overlap > 60% → redundante; si < 60% → no redundante.
- [ ] **AC-4.7**: `analyzeStack(['github', 'slack', 'zoom'], allProducts, fmt)` devuelve `redundantPairs.length === 0` (ningún par comparte silo: Dev Tools, Communication, Video Conferencing).
- [ ] **AC-4.8**: Para cada `redundantPair` generado, `overlappingCoreFeatures.length > 0` y todos sus IDs corresponden a features con `type === 'core'`.
- [ ] **AC-4.9**: La recomendación generada menciona al menos un nombre de core feature solapada (no solo infrastructure).
- [ ] **AC-4.10**: Una herramienta con `featureIds` que solo contiene IDs de tipo `infrastructure` (ej. `['api_access', 'integrations', 'saml_sso', 'audit_logs', 'roles_permissions']`) nunca aparece en `unusedTools` si tiene 0 core features.
- [ ] **AC-4.11**: `analyzeStack` con stack de 1 sola herramienta devuelve `redundantPairs: []`, `unusedTools: []`, `totalMonthlySpend` correcto.

---

### RF-5: Migración de JSONs

**Descripción**: Los 50 archivos JSON en `src/content/saas/` deben ser migrados para que sus `featureIds` sean consistentes con el nuevo registry ampliado y la taxonomía `type`. Se debe crear un script de migración automatizado (`scripts/migrate-features.mjs`) que:

1. Lea el registry actualizado desde `src/data/features-registry.ts`.
2. Defina un mapa `CATEGORY_DEFAULT_FEATURES` que asigne a cada categoría SaaS un conjunto de features sugeridas.
3. Para cada JSON, añada las features sugeridas que no existan ya en `featureIds`.
4. Valide que todos los `featureIds` resultantes existan en el registry.
5. Genere un reporte de cambios (`added`, `removed`, `unchanged`, `invalid`).

**Reglas de negocio**:
- Ningún `featureId` en ningún JSON debe ser inválido (no existir en el registry).
- Cada JSON debe tener **al menos 1 feature con `type === 'core'`** asignada.
- No se deben usar `featureIds` genéricos como relleno (ej. asignar `api_access` a un producto que no tiene API).
- El script no debe eliminar `featureIds` existentes a menos que sean inválidos o duplicados.
- El script debe preservar `proprietaryFeatures` intactas.
- El reporte de migración debe ser revisado manualmente antes de hacer commit.

**Mapa `CATEGORY_DEFAULT_FEATURES` (sujeto a revisión manual)**:

| Categoría | Core features sugeridas | Infrastructure features sugeridas |
|-----------|------------------------|----------------------------------|
| CRM & Sales | `crm_basic`, `email_automation`, `pipeline_mgmt`, `lead_scoring`, `reporting`, `custom_fields` | `api_access`, `integrations`, `roles_permissions` |
| Communication | `real_time_messaging`, `file_sharing`, `collaboration` | `api_access`, `integrations`, `saml_sso` |
| Customer Support | `ticketing`, `knowledge_base`, `reporting`, `dashboards` | `api_access`, `integrations` |
| Project Management | `custom_fields`, `workflows`, `reporting`, `dashboards`, `dependency_tracking` | `api_access`, `integrations`, `roles_permissions` |
| Video Conferencing | `real_time_messaging`, `recording`, `file_sharing`, `video_hosting` | `api_access`, `integrations` |
| Email Marketing | `email_automation`, `email_templates`, `a_b_testing`, `reporting`, `dashboards` | `api_access`, `integrations` |
| Productivity & Wiki | `custom_fields`, `file_sharing`, `collaboration`, `dashboards` | `api_access`, `integrations` |
| Dev Tools | `version_control`, `dashboards`, `reporting`, `workflows` | `api_access`, `integrations`, `saml_sso`, `audit_logs` |
| Design | `file_sharing`, `collaboration`, `version_control` | `api_access`, `integrations` |
| Monitoring | `alerting`, `dashboards`, `reporting`, `advanced_analytics` | `api_access`, `integrations`, `saml_sso`, `audit_logs` |

**Caso límite**: Un producto como `zoom` (Video Conferencing) podría tener `featureIds: ['api_access', 'integrations', 'reporting', 'roles_permissions', 'saml_sso', 'audit_logs', 'sla', 'priority_support']`. Tras la migración, debería ganar al menos `recording` y `real_time_messaging` como core features. Si `reporting` es su única core feature actual, debe tener al menos 3 core features después de la migración.

**Caso límite**: Si un producto tiene `featureIds` con IDs que ya no existen en el registry (porque se renombraron), el script debe reportarlos como `invalid` y el desarrollador debe corregirlos manualmente.

**Criterio de aceptación**:
- [ ] **AC-5.1**: El script `scripts/migrate-features.mjs` existe y se puede ejecutar con `node scripts/migrate-features.mjs`.
- [ ] **AC-5.2**: Tras ejecutar la migración, `npm run validate` termina con exit code 0, sin errores de `registry-ref-check`.
- [ ] **AC-5.3**: Los 50 JSONs tienen todos sus `featureIds` válidos (existen en el nuevo registry).
- [ ] **AC-5.4**: Cada JSON tiene al menos 1 `featureId` que corresponde a una feature con `type === 'core'`.
- [ ] **AC-5.5**: No existen `featureIds` duplicados dentro de un mismo JSON.
- [ ] **AC-5.6**: El script genera un archivo de reporte (`migration-report.json`) que lista los cambios por producto.
- [ ] **AC-5.7**: Los `proprietaryFeatures` de todos los JSONs permanecen sin modificaciones.

---

### RF-6: Tests Unitarios con Vitest

**Descripción**: Se debe configurar Vitest como test runner y crear tests unitarios para las unidades críticas del sistema. Los tests deben cubrir tanto el comportamiento correcto (verdaderos positivos) como la eliminación de falsos positivos.

**Configuración de Vitest**:
- Archivo `vitest.config.ts` en la raíz del proyecto.
- Compatible con la configuración existente de Astro/Vite.
- Script `"test": "vitest run"` en `package.json`.
- Script `"test:watch": "vitest"` en `package.json`.

**Archivos de test**:

| Archivo | Qué testea |
|---------|-----------|
| `src/__tests__/features-registry.test.ts` | Integridad del registry: todos tienen `type`, no hay IDs duplicados, core features ≥ N, infrastructure features ≥ M, consistencia de tipos |
| `src/__tests__/categories.test.ts` | `COMPARISON_SILOS`: todas las categorías son claves, los valores son categorías válidas, Dev Tools no es comparable con Communication |
| `src/__tests__/analyze-stack.test.ts` | `analyzeStack`: casos de falsos positivos (Bitbucket vs Teams, GitHub vs Zoom), verdaderos positivos (HubSpot vs Salesforce), casos límite (stack de 1, silos mixtos) |
| `src/__tests__/unused-tools.test.ts` | `unusedTools`: herramienta con solo infra features no se marca, herramienta con core features únicas no se marca, herramienta cubierta completamente sí se marca |

**Casos de test obligatorios para `analyze-stack.test.ts`**:

| ID | Stack | Resultado esperado | Razón |
|----|-------|-------------------|-------|
| T1 | `['github', 'zoom']` | 0 redundancias | Distintos silos: Dev Tools ≠ Video Conferencing |
| T2 | `['bitbucket', 'microsoft-teams']` | 0 redundancias | Distintos silos: Dev Tools ≠ Communication |
| T3 | `['gitlab', 'zoom']` | 0 redundancias | Distintos silos: Dev Tools ≠ Video Conferencing |
| T4 | `['hubspot', 'salesforce']` | ≥1 redundancia | Mismo silo CRM & Sales, core overlap > 60% |
| T5 | `['slack', 'microsoft-teams']` | ≥1 redundancia | Mismo silo Communication, core overlap > 60% |
| T6 | `['github', 'slack', 'zoom']` | 0 redundancias | Ningún par comparte silo |
| T7 | `['slack']` | 0 redundancias, unusedTools = [] | Stack de 1 herramienta |
| T8 | `['github', 'bitbucket']` | Comportamiento definido | Mismo silo Dev Tools, depende del % core overlap |
| T9 | `['jira', 'notion']` | Comportamiento definido | Silo Project Management ⇔ Productivity & Wiki |
| T10 | `['datadog', 'vercel']` | 0 redundancias si silos no compatibles | Monitoring vs Dev Tools |

**Casos de test obligatorios para `unused-tools.test.ts`**:

| ID | Stack | Resultado esperado |
|----|-------|-------------------|
| U1 | `['microsoft-teams', 'zoom']` (Teams solo tiene infra features) | Teams NO en unusedTools (0 core features) |
| U2 | `['hubspot', 'salesforce']` (Salesforce core subset de HubSpot) | La herramienta con subset completo de core features SÍ en unusedTools |
| U3 | `['slack', 'microsoft-teams']` (cada una tiene al menos 1 core feature única) | unusedTools = [] |

**Reglas de validación**:
- Los tests deben ejecutarse en `< 5 segundos` en total.
- Los tests deben ser deterministas (sin dependencia de red, localStorage, o DOM).
- `analyzeStack` debe ser extraíble como función pura para testing (acepta arrays de productos mock, devuelve `StackAuditResult`).

**Criterio de aceptación**:
- [ ] **AC-6.1**: `npx vitest run` ejecuta todos los tests y termina con exit code 0.
- [ ] **AC-6.2**: Los tests T1-T10 para `analyzeStack` existen y pasan.
- [ ] **AC-6.3**: Los tests U1-U3 para `unusedTools` existen y pasan.
- [ ] **AC-6.4**: Los tests para `features-registry` verifican: (a) todo feature tiene `type`, (b) no hay IDs duplicados, (c) `featureRegistry.length >= 25`.
- [ ] **AC-6.5**: Los tests para `COMPARISON_SILOS` verifican: (a) las 10 categorías son claves, (b) Dev Tools no es comparable con Communication, (c) todos los valores son claves válidas.
- [ ] **AC-6.6**: `npm run test` existe como script en `package.json`.
- [ ] **AC-6.7**: La función `analyzeStack` es testeable de forma aislada (no requiere React, DOM, o localStorage).

---

## 3. Requisitos No Funcionales (RNF)

### RNF-1: Rendimiento

| Métrica | Valor objetivo | Justificación |
|---------|---------------|---------------|
| Complejidad temporal | O(n²) en número de herramientas del stack (n ≤ 50) | El algoritmo recorre todos los pares (i,j). La complejidad no cambia respecto al original. |
| Filtrado por silo | O(1) por par | `COMPARISON_SILOS[t.category]?.includes(other.category)` es una búsqueda en array pequeño (≤5 elementos). |
| Filtrado de core features | O(k) por herramienta, k ≤ 30 | `featureIds.filter(fid => coreFeatureIds.has(fid))` se ejecuta una vez por herramienta. |
| Tiempo de ejecución máximo | < 50ms para n=50 | El algoritmo con 50 herramientas realiza ~1225 comparaciones de pares. Con los filtros O(1), el tiempo no debe exceder 50ms en hardware moderno. |
| Tiempo de tests | < 5s para la suite completa | Los tests unitarios no tienen dependencias de red y deben ejecutarse en milisegundos por test. |

**Criterio de aceptación**:
- [ ] **RNF-1.1**: `analyzeStack` con 50 herramientas completa en < 100ms (medido con `performance.now()` en un test).

### RNF-2: Build y Compilación

| Métrica | Valor objetivo |
|---------|---------------|
| `npm run build` | Exit code 0, sin errores de TypeScript |
| `tsc --noEmit` (si se configura) | 0 errores en strict mode |
| Compatibilidad | El build de Astro genera el sitio estático en `/dist` sin warnings |

**Criterio de aceptación**:
- [ ] **RNF-2.1**: `npm run build` completa sin errores.
- [ ] **RNF-2.2**: No se introducen errores de TypeScript en ningún archivo existente.
- [ ] **RNF-2.3**: La interfaz `RegistryFeature` con el nuevo campo `type` es compatible con todas las funciones existentes que la consumen (`getFeatureById`, `getFeaturesByIds`, `validateFeatureIds`).

### RNF-3: Validación de Datos

| Métrica | Valor objetivo |
|---------|---------------|
| `npm run validate` | Exit code 0, sin errores de `registry-ref-check` |
| Lista de feature IDs en validador | Debe derivarse del registry real, no estar hardcodeada |

**Criterio de aceptación**:
- [ ] **RNF-3.1**: `npm run validate` termina con exit code 0.
- [ ] **RNF-3.2**: El script `validate-data.mjs` obtiene los feature IDs válidos desde una fuente derivada del registry (ya sea import dinámico del `.ts` compilado, o un archivo JSON generado en build).
- [ ] **RNF-3.3**: Si se añade una feature nueva al registry, `npm run validate` la reconoce como válida sin necesidad de actualizar manualmente el validador.

### RNF-4: Seguridad y Accesibilidad

| Métrica | Valor objetivo |
|---------|---------------|
| Datos de usuario | Los datos del stack del usuario permanecen en `localStorage` del navegador. No se envían a ningún servidor. |
| Accesibilidad | Los nuevos elementos UI (si los hubiera) deben mantener el nivel actual de accesibilidad: `aria-label` en botones, `role` apropiado, contraste de color. |

**Criterio de aceptación**:
- [ ] **RNF-4.1**: No se introduce ninguna llamada de red nueva en `StackAuditor.tsx`.
- [ ] **RNF-4.2**: Los cambios en la UI de resultados de auditoría no degradan la accesibilidad existente.

---

## 4. Contratos de Datos e Interfaces (API)

### 4.1 `RegistryFeature` (modificado)

```typescript
// src/data/features-registry.ts

export interface RegistryFeature {
  id: string;                                           // snake_case, único, ej. 'crm_basic'
  name: string;                                          // Human-readable, ej. 'Basic CRM'
  description: string;                                   // ≥ 30 caracteres
  category: 'core' | 'security' | 'integration' | 'analytics' | 'support';  // SIN CAMBIOS
  type: 'core' | 'infrastructure';                       // NUEVO: clasificación funcional
  isEnterpriseLocked: boolean;
  comparable: true;                                      // SIN CAMBIOS: siempre true para RegistryFeature
}
```

### 4.2 Funciones helper del registry (nuevas)

```typescript
// src/data/features-registry.ts

/** Devuelve los IDs de todas las features con type === 'core' */
export function getCoreFeatureIds(): string[];

/** Devuelve los IDs de todas las features con type === 'infrastructure' */
export function getInfrastructureFeatureIds(): string[];

/** Verifica si un featureId dado es de tipo core */
export function isCoreFeature(id: string): boolean;

/** Verifica si un featureId dado es de tipo infrastructure */
export function isInfrastructureFeature(id: string): boolean;

/** Filtra un array de featureIds para retornar solo los de tipo core */
export function filterCoreFeatures(featureIds: string[]): string[];

/** Filtra un array de featureIds para retornar solo los de tipo infrastructure */
export function filterInfrastructureFeatures(featureIds: string[]): string[];
```

### 4.3 `COMPARISON_SILOS` (nuevo)

```typescript
// src/lib/categories.ts

/**
 * Silos de comparación para detección de redundancia en StackAuditor.
 * Las claves son categorías SaaS. Los valores son las categorías con las que
 * una herramienta de esa categoría puede compararse para detectar redundancia.
 * 
 * Más restrictivo que RELATED_CATEGORIES (usado en DowngradeEngine).
 */
export const COMPARISON_SILOS: Record<string, string[]>;

/**
 * Verifica si dos categorías son comparables según COMPARISON_SILOS.
 * @returns true si cat1 y cat2 pertenecen al mismo silo de comparación.
 */
export function areCategoriesComparable(cat1: string, cat2: string): boolean;
```

### 4.4 `analyzeStack` (firma sin cambios, comportamiento nuevo)

```typescript
// src/components/StackAuditor.tsx

/**
 * Analiza un stack de herramientas SaaS y detecta redundancias.
 * 
 * Algoritmo refactorizado (v2):
 * 1. Para cada par (i, j), verifica que estén en el mismo COMPARISON_SILOS.
 * 2. Filtra las features de cada herramienta para conservar solo type === 'core'.
 * 3. Calcula coreOverlap. Aplica umbral >60% del set menor de core features.
 * 4. Si coreOverlap.length >= 2 y supera el umbral, genera redundantPair.
 * 
 * @param toolIds - IDs de las herramientas en el stack
 * @param allProducts - Catálogo completo de productos SaaS
 * @param fmt - Función de formateo de moneda
 * @returns StackAuditResult con redundancias detectadas y herramientas unused
 */
function analyzeStack(
  toolIds: string[],
  allProducts: SaaSProductData[],
  fmt: (val: number) => string
): StackAuditResult;
```

### 4.5 `StackAuditResult` (extendido con campos opcionales)

```typescript
// src/types/saas.ts

export interface StackAuditResult {
  redundantPairs: {
    tool1: string;
    tool2: string;
    id1: string;
    id2: string;
    overlappingFeatures: string[];            // Todos los featureIds solapados (para UI)
    overlappingFeatureNames: string[];        // Nombres de todos los features solapados (para UI)
    overlappingCoreFeatures: string[];        // NUEVO: Solo featureIds core solapados
    overlappingCoreFeatureNames: string[];    // NUEVO: Nombres de solo core features
    recommendation: string;
    potentialSavings: number;
    siloCategory: string;                     // NUEVO: Categoría del silo (ej. "CRM & Sales")
    redundancyReason: 'core_overlap';         // NUEVO: Razón de la redundancia
  }[];
  totalMonthlySpend: number;
  totalPotentialSavings: number;
  unusedTools: string[];                      // Comportamiento refactorizado (solo core features)
}
```

### 4.6 Contrato del script de migración

```typescript
// scripts/migrate-features.mjs (nuevo)

/**
 * Script de migración de featureIds en JSONs de SaaS.
 * 
 * Entrada:
 *   - src/data/features-registry.ts (lee el registry para obtener IDs válidos por tipo)
 *   - src/content/saas/*.json (50 archivos)
 * 
 * Salida:
 *   - src/content/saas/*.json (sobrescritos con featureIds actualizados)
 *   - migration-report.json (reporte de cambios: added, removed, unchanged, invalid)
 * 
 * Comportamiento:
 *   1. Carga el CATEGORY_DEFAULT_FEATURES (mapa interno del script)
 *   2. Para cada JSON, añade features sugeridas por categoría que no existan ya
 *   3. Valida que todos los featureIds existan en el registry
 *   4. Reporta IDs inválidos sin modificarlos
 *   5. No modifica proprietaryFeatures
 * 
 * Exit code: 0 si todos los featureIds son válidos, 1 si hay IDs inválidos
 */
```

---

## 5. Casos de Uso y Escenarios de Edge Cases

### Escenario 1: Stack con herramientas de categorías incompatibles

**Stack**: `['github', 'microsoft-teams']` (Dev Tools + Communication)

**Precondiciones**:
- `github.category === 'Dev Tools'`
- `microsoft-teams.category === 'Communication'`
- `COMPARISON_SILOS['Dev Tools']` no incluye `'Communication'`

**Resultado esperado**:
- `redundantPairs.length === 0`
- `unusedTools.length === 0` (cada herramienta tiene sus propias core features)
- El mensaje UI: "No Critical Redundancies Found"
- No se genera recomendación de cancelar una por la otra

**Validación**: Test T2

---

### Escenario 2: Stack con 2 herramientas del mismo CRM con ≥60% core overlap

**Stack**: `['hubspot', 'salesforce']` (ambos CRM & Sales)

**Precondiciones**:
- `hubspot.category === 'CRM & Sales'`, `salesforce.category === 'CRM & Sales'`
- `COMPARISON_SILOS['CRM & Sales']` incluye `'CRM & Sales'`
- Ambas herramientas tienen múltiples core features (`crm_basic`, `email_automation`, `pipeline_mgmt`, `lead_scoring`, `reporting`, `dashboards`)
- Core overlap ≥ 60% del set menor

**Resultado esperado**:
- `redundantPairs.length >= 1`
- El `redundantPair` incluye `siloCategory: 'CRM & Sales'`
- `overlappingCoreFeatures` lista explícitamente las core features compartidas
- `potentialSavings > 0`
- La recomendación menciona que ambas son herramientas CRM con solapamiento en features core específicas

**Validación**: Test T4

---

### Escenario 3: Stack con 2 herramientas del mismo silo pero <60% core overlap

**Stack**: `['jira', 'notion']` (Project Management ⇔ Productivity & Wiki)

**Precondiciones**:
- `COMPARISON_SILOS['Project Management']` incluye `'Productivity & Wiki'`
- Jira tiene core features de gestión de proyectos (ej. `workflows`, `custom_fields`, `reporting`)
- Notion tiene core features de wiki/documentación (ej. `file_sharing`, `collaboration`, `knowledge_base`)
- El core overlap (features compartidas) es < 60% del set menor

**Resultado esperado**:
- `redundantPairs.length === 0`
- No se sugiere cancelar una por la otra
- El sistema reconoce que, aunque son comparables, el solapamiento funcional real no es suficiente

**Validación**: Test T9

---

### Escenario 4: Herramienta con 0 core features (solo infrastructure)

**Stack**: `['microsoft-teams', 'zoom']`

**Precondiciones**:
- `microsoft-teams.featureIds` = `['api_access', 'integrations', 'saml_sso', 'audit_logs', 'roles_permissions']` (todas infrastructure)
- `microsoft-teams` tiene 0 core features en el registry
- Tras migración, Teams tendrá al menos 1 core feature (ej. `real_time_messaging`). Pero el escenario prueba el caso hipotético pre-migración.

**Resultado esperado**:
- Teams NO aparece en `unusedTools` (tiene 0 core features → no se puede considerar cubierta)
- Teams NO genera redundancia con Zoom (porque no tiene core features que solapar)
- Si tras la migración Teams gana `real_time_messaging`, y Zoom también la tiene, entonces el comportamiento cambia (es correcto)

**Validación**: Test U1

---

### Escenario 5: Unused tools con stack donde una herramienta está completamente cubierta

**Stack**: `['hubspot', 'salesforce', 'pipedrive']` (todos CRM & Sales)

**Precondiciones**:
- `pipedrive` tiene un subconjunto de core features que están completamente contenidas en la unión de core features de `hubspot` y `salesforce`
- `pipedrive` tiene al menos 1 core feature
- El stack tiene ≥ 2 herramientas

**Resultado esperado**:
- `pipedrive` aparece en `unusedTools`
- La UI muestra el warning "Potentially Unused Tools" con `pipedrive`
- `hubspot` y `salesforce` generan redundantPair entre sí (si su core overlap ≥ 60%)

**Validación**: Test U2 (análogo)

---

## 6. Definiciones y Glosario

### Core Business Feature
**Definición**: Una feature comparable del registro cuyo `type === 'core'`. Representa una capacidad funcional que define el dominio de negocio del producto SaaS y es un factor diferenciador en la decisión de compra. Ejemplos: `crm_basic` (gestión de contactos y deals), `email_automation` (secuencias de email automatizadas), `ticketing` (sistema de tickets de soporte), `real_time_messaging` (chat en tiempo real).

**Propiedades**:
- Se usa para calcular solapamiento funcional real entre herramientas.
- Es el único tipo de feature que cuenta para el umbral de redundancia (>60%).
- Define si una herramienta es "potentially unused".

### Infrastructure Feature
**Definición**: Una feature comparable del registro cuyo `type === 'infrastructure'`. Representa un prerrequisito técnico, de seguridad, integración o compliance que es compartido por la mayoría de productos SaaS enterprise, independientemente de su dominio funcional. Ejemplos: `api_access` (API REST), `saml_sso` (Single Sign-On), `audit_logs` (registros de auditoría), `sla` (garantía de uptime), `roles_permissions` (RBAC).

**Propiedades**:
- **No** se usa para calcular solapamiento funcional.
- **No** cuenta para el umbral de redundancia.
- **No** se considera para `unusedTools`.
- Se preserva en `overlappingFeatures` para mostrarse en la UI (información complementaria), pero no afecta la decisión de redundancia.

### Redundancia Crítica (Critical Redundancy)
**Definición**: Situación donde dos herramientas en un stack SaaS (a) pertenecen a categorías del mismo `COMPARISON_SILOS`, (b) comparten ≥60% de sus core features (medido sobre el set más pequeño), y (c) comparten al menos 2 core features. Una redundancia crítica se reporta como `redundantPair` con una recomendación de consolidación.

**Fórmula**: `coreOverlapCount >= Math.ceil(Math.min(t1CoreCount, t2CoreCount) * 0.6) AND coreOverlapCount >= 2`

### Silo de Comparación (Comparison Silo)
**Definición**: Un grupo de categorías SaaS definido en `COMPARISON_SILOS` que establece qué herramientas pueden compararse entre sí para detectar redundancia. Dos herramientas solo son comparables si la categoría de una está listada en el silo de la otra.

**Propiedades**:
- Definido manualmente en `COMPARISON_SILOS` basado en conocimiento de dominio.
- Más restrictivo que `RELATED_CATEGORIES` (que se usa para buscar alternativas).
- Consulta O(1): `COMPARISON_SILOS[cat1]?.includes(cat2)`.

### Unused Tool (Herramienta Potencialmente No Usada)
**Definición**: Una herramienta en el stack cuyas core features (type === 'core') están completamente contenidas en la unión de las core features del resto de herramientas del stack. Se reporta como advertencia, no como redundancia crítica.

**Condiciones**:
- `tools.length > 1`
- `tool.coreFeatureIds.length > 0` (debe tener al menos 1 core feature)
- `tool.coreFeatureIds.every(fid => allOtherCoreFeatures.has(fid))` (todas sus core features están cubiertas por otras herramientas)

### Falso Positivo
**Definición**: Un `redundantPair` generado por el algoritmo que no representa una redundancia real de negocio. Ejemplo: GitHub vs Microsoft Teams (herramientas de dominios completamente distintos que comparten features de infraestructura).

### Verdadero Positivo
**Definición**: Un `redundantPair` generado por el algoritmo que SÍ representa una redundancia real de negocio. Ejemplo: HubSpot vs Salesforce (ambos son CRM con solapamiento funcional genuino).

---

## 7. Criterios de Aceptación Globales

Para considerar la tarea de refactorización como **completada y aprobada**, deben cumplirse **todos** los siguientes criterios:

### Build & Compilación
- [ ] **GAC-1**: `npm run build` completa con exit code 0, sin errores de TypeScript, generando el sitio estático en `/dist`.
- [ ] **GAC-2**: No se introducen errores de tipo en ningún archivo `.ts` o `.tsx` existente. El compilador strict de TypeScript no reporta nuevos errores.

### Validación de Datos
- [ ] **GAC-3**: `npm run validate` completa con exit code 0. Cero errores de `registry-ref-check`.
- [ ] **GAC-4**: Los 50 JSONs en `src/content/saas/` tienen todos sus `featureIds` válidos contra el nuevo registry.

### Tests
- [ ] **GAC-5**: `npx vitest run` (o `npm run test`) completa con exit code 0. Todos los tests pasan.
- [ ] **GAC-6**: Los tests cubren los 5 casos de falsos positivos identificados en el explore report (GitHub vs Zoom, Bitbucket vs Teams, GitLab vs Zoom, Jira vs Notion, Microsoft Teams vs Zoom) y verifican que ya NO generan redundancia.
- [ ] **GAC-7**: Los tests cubren al menos 2 casos de verdaderos positivos (HubSpot vs Salesforce, Slack vs Teams) y verifican que SÍ generan redundancia.

### Falsos Positivos Eliminados
- [ ] **GAC-8**: Bitbucket vs Microsoft Teams → NO genera redundancia (distintos silos).
- [ ] **GAC-9**: GitHub vs Microsoft Teams → NO genera redundancia (distintos silos).
- [ ] **GAC-10**: GitLab vs Zoom → NO genera redundancia (distintos silos).
- [ ] **GAC-11**: GitHub vs Slack vs Zoom (stack mixto) → 0 redundancias entre ningún par.

### Verdaderos Positivos Conservados
- [ ] **GAC-12**: HubSpot vs Salesforce → SÍ genera redundancia (mismo silo CRM & Sales, core overlap > 60%).
- [ ] **GAC-13**: Slack vs Microsoft Teams (post-migración, con core features asignadas) → SÍ genera redundancia (mismo silo Communication).

### Migración
- [ ] **GAC-14**: El script `scripts/migrate-features.mjs` se ha ejecutado exitosamente y los cambios en los JSONs han sido revisados manualmente.
- [ ] **GAC-15**: El reporte de migración (`migration-report.json`) existe y documenta todos los cambios realizados.

### Registry
- [ ] **GAC-16**: `featureRegistry` contiene ≥ 25 features.
- [ ] **GAC-17**: Cada entrada del registry tiene `type` definido (`'core'` o `'infrastructure'`).
- [ ] **GAC-18**: Las funciones helper (`getCoreFeatureIds`, `filterCoreFeatures`, `isCoreFeature`, etc.) existen y son exportadas.

### Categorías y Silos
- [ ] **GAC-19**: `COMPARISON_SILOS` existe en `src/lib/categories.ts` con entradas para las 10 categorías.
- [ ] **GAC-20**: `areCategoriesComparable()` existe y es exportada.

### No Regresión
- [ ] **GAC-21**: `DowngradeEngine` funciona correctamente (no se modificó su lógica).
- [ ] **GAC-22**: El sistema de multidivisa funciona correctamente (no se modificó).
- [ ] **GAC-23**: La UI del `StackAuditor` renderiza correctamente (search, add/remove tools, clear stack, localStorage).
- [ ] **GAC-24**: `npm run dev` levanta el servidor de desarrollo sin errores.

---

## 8. Plan de Implementación (Resumen de Pasos)

| Paso | Descripción | Archivos afectados | Depende de |
|------|------------|-------------------|------------|
| **Paso 1** | Extender `RegistryFeature` con `type`, ampliar catálogo a ≥25 features, añadir helpers | `src/data/features-registry.ts` | Ninguno |
| **Paso 2** | Definir `COMPARISON_SILOS` y `areCategoriesComparable()` | `src/lib/categories.ts` | Ninguno |
| **Paso 3** | Refactorizar `analyzeStack` (silos + core features + umbral 60%) | `src/components/StackAuditor.tsx` | Paso 1, Paso 2 |
| **Paso 4** | Refactorizar `unusedTools` (solo core features) | `src/components/StackAuditor.tsx` | Paso 1 |
| **Paso 5** | Extender `StackAuditResult` con nuevos campos | `src/types/saas.ts` | Paso 3 |
| **Paso 6** | Configurar Vitest | `vitest.config.ts`, `package.json` | Ninguno |
| **Paso 7** | Escribir tests unitarios | `src/__tests__/*.test.ts` | Paso 3, Paso 4, Paso 6 |
| **Paso 8** | Crear script de migración | `scripts/migrate-features.mjs` | Paso 1 |
| **Paso 9** | Ejecutar migración de JSONs | `src/content/saas/*.json` | Paso 8 |
| **Paso 10** | Actualizar validador (derivar feature IDs del registry) | `scripts/validate-data.mjs` | Paso 1 |
| **Paso 11** | Verificación final: build + validate + tests | Todos | Pasos 1-10 |

---

## 9. Notas y Precauciones

1. **El campo `type` es inmutable en runtime**: Una vez asignado en el registry, no debe cambiar durante la ejecución del algoritmo. Si se necesita recalcular, se debe reinicializar el componente.

2. **`COMPARISON_SILOS` vs `RELATED_CATEGORIES`**: Son mapas diferentes con propósitos diferentes. `RELATED_CATEGORIES` se usa en `DowngradeEngine` para buscar alternativas (más amplio). `COMPARISON_SILOS` se usa en `StackAuditor` para detectar redundancia (más restrictivo). No deben unificarse.

3. **El umbral del 60% es configurable**: Se recomienda definirlo como constante exportada (`REDUNDANCY_THRESHOLD = 0.6`) en `src/components/StackAuditor.tsx` para facilitar ajustes futuros sin reescribir la lógica.

4. **La migración de JSONs es destructiva**: El script sobrescribe los archivos JSON. Se recomienda hacer commit de los archivos originales antes de ejecutar la migración, o ejecutar el script en una rama separada.

5. **Los tests deben ser independientes del orden**: Cada test debe crear sus propios mocks de productos y no depender del estado global del registry.

6. **El `as const satisfies RegistryFeature[]` se mantiene**: El array del registry debe seguir usando `as const satisfies RegistryFeature[]` para garantizar type safety en tiempo de compilación con el nuevo campo `type`.

7. **Retrocompatibilidad de `StackAuditResult`**: Los nuevos campos (`overlappingCoreFeatures`, `overlappingCoreFeatureNames`, `siloCategory`, `redundancyReason`) son requeridos en el tipo, pero el componente React que consume el resultado debe manejar correctamente tanto los nuevos campos como la ausencia de ellos (si se usara una versión anterior del resultado).
