# Architectural Decision Record (ADR) — Refactorización de StackAuditor: Categorización, Silos, Filtros y Migración

## 1. Contexto y Problema

El `StackAuditor` actual sufre de **falsos positivos masivos**: detecta redundancia entre herramientas de dominios completamente distintos (ej. GitHub vs Microsoft Teams con 100% de solapamiento en `featureIds`) porque su algoritmo compara todas las features por igual, sin distinguir entre features núcleo del negocio (como `crm_basic`, `email_automation`) e infraestructura commodity (como `api_access`, `saml_sso`, `audit_logs`).

Los 5 pasos de refactorización previstos son:

1. **Categorización core vs infrastructure** en el features-registry
2. **Silos de comparación** que limiten qué categorías SaaS pueden compararse entre sí
3. **Refactorización de `analyzeStack`** para filtrar features genéricas en runtime y usar umbral >60%
4. **Migración de JSONs** para alinear el catálogo con la nueva taxonomía
5. **Tests unitarios** para garantizar la corrección del nuevo algoritmo

Este ADR evalúa las alternativas técnicas para implementar cada paso, con trade-offs de complejidad, rendimiento y mantenibilidad.

---

## 2. Alternativas Evaluadas

### Decisión 1: Categorización de Features — Core vs Infrastructure

**Problema:** Las 15 features del registry actual tienen una categoría (`core`, `security`, `integration`, `analytics`, `support`) pero esta categorización no distingue entre features que definen el *dominio funcional* de un SaaS y features que son *prerrequisitos de infraestructura* compartidos por casi todos los productos enterprise. Esto causa que `api_access`, `saml_sso`, `audit_logs`, `roles_permissions` e `integrations` — presentes en la mayoría de productos enterprise — generen solapamiento artificial entre herramientas irreemplazables entre sí.

#### Alternativa A: Hardcodear listas explícitas de `CORE_FEATURES` e `INFRASTRUCTURE_FEATURES`

Definir dos constantes exportadas en `features-registry.ts`:

```typescript
export const CORE_FEATURES = ['crm_basic', 'email_automation', 'custom_fields', 
  'workflows', 'ai_features', 'white_label', 'reporting', 'advanced_analytics'] as const;
export const INFRASTRUCTURE_FEATURES = ['api_access', 'integrations', 'saml_sso', 
  'audit_logs', 'roles_permissions', 'sla', 'priority_support'] as const;
```

- **Pros:**
  - Simple de implementar: dos arrays, cero cambios en el tipo `RegistryFeature`
  - Fácil de leer y razonar: la lista es explícita
  - No requiere migrar los 50 JSONs
  - El algoritmo de `analyzeStack` importa ambas listas y filtra directamente

- **Contras:**
  - **Dos fuentes de verdad**: la categoría existente (`RegistryFeature.category`) y la nueva partición (`CORE_FEATURES` / `INFRASTRUCTURE_FEATURES`) pueden divergir. Si se añade una feature al registry, hay que acordarse de añadirla a la lista correcta. Si se cambia `category` de `api_access` de `integration` a `security`, la lista hardcodeada no se actualiza automáticamente.
  - **No es extensible**: si在未来 se añade una tercera categoría (ej. `COLLABORATION`), hay que crear una tercera lista y refactorizar todos los consumidores
  - **Mantiene la responsabilidad fuera del registry**: la decisión de qué es core vs infrastructure está separada del dato canónico de la feature, lo que viola el principio de única fuente de verdad

#### Alternativa B: Añadir un campo `type: 'core' | 'infrastructure'` al registry, manteniendo `category` como subcategoría

Extender la interfaz `RegistryFeature` con un nuevo campo:

```typescript
export interface RegistryFeature {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'security' | 'integration' | 'analytics' | 'support';
  type: 'core' | 'infrastructure';  // NUEVO: clasificación funcional
  isEnterpriseLocked: boolean;
  comparable: true;
}
```

Asignación propuesta:
| Feature | `category` (existente) | `type` (nuevo) | Justificación |
|---------|----------------------|---------------|---------------|
| `api_access` | integration | **infrastructure** | Prerrequisito técnico, presente en 80%+ de productos |
| `integrations` | integration | **infrastructure** | Catálogo de conectores, presente en 70%+ de productos |
| `custom_fields` | core | **core** | Define la personalización del dominio del negocio |
| `workflows` | core | **core** | Motor de automatización específico del producto |
| `saml_sso` | security | **infrastructure** | Estándar enterprise, presente en 60%+ de productos enterprise |
| `audit_logs` | security | **infrastructure** | Compliance genérico, presente en 55%+ de productos enterprise |
| `sla` | support | **infrastructure** | Compromiso contractual estándar |
| `priority_support` | support | **infrastructure** | SLA de soporte genérico |
| `roles_permissions` | security | **infrastructure** | RBAC genérico, presente en 65%+ de productos enterprise |
| `advanced_analytics` | analytics | **core** | Análisis predictivo es diferenciador del producto |
| `reporting` | analytics | **core** | Dashboards y reportes son parte del dominio funcional |
| `ai_features` | core | **core** | IA generativa como diferenciador del producto |
| `white_label` | core | **core** | Capacidades de marca propia son diferenciador |
| `crm_basic` | core | **core** | Gestión de contactos es el dominio central de CRMs |
| `email_automation` | core | **core** | Automatización de email es diferenciador del producto |

- **Pros:**
  - **Única fuente de verdad**: el dato de si una feature es core o infrastructure vive en el registry mismo. No hay listas separadas que puedan divergir.
  - **Extensible sin breaking changes**: si se añade una nueva categoría de `type` (ej. `collaboration`), simplemente se añade al union type y las features migran gradualmente.
  - **La `category` existente se preserva como subcategoría**: `type` es una partición de nivel superior (`core` vs `infrastructure`), mientras `category` sigue siendo la granularidad existente (`security`, `integration`, etc.). Esto permite que el algoritmo use `type` para el filtrado principal y `category` para UX secundaria.
  - **Derivable en runtime**: `const coreFeatures = featureRegistry.filter(f => f.type === 'core')` — sin imports de listas hardcodeadas.
  - **Reduce falsos positivos en la raíz**: Las features `infrastructure` se etiquetan como tales, y el algoritmo puede simplemente excluirlas del cálculo de solapamiento o darles un peso reducido.

- **Contras:**
  - **Requiere migrar `features-registry.ts`**: hay que modificar 15 entradas para añadir el campo `type`. Es trabajo manual pero trivial (una línea por feature).
  - **Requiere actualizar el schema Zod** en `content.config.ts`: el `SaasFeatureSchema` tiene `category: z.enum([...])` pero `type` no aplica a `proprietaryFeatures` (que tienen `comparable: false`). Se debe decidir si `type` solo aplica a `RegistryFeature` (sí — las `proprietaryFeatures` son por definición core del producto).
  - **Puede requerir actualizar el validador**: `validate-data.mjs` ya tiene una lista hardcodeada de feature IDs, pero `type` es un campo del registro, no de los JSONs, así que no afecta directamente al validador.

### Decisión Recomendada: **Alternativa B — Añadir `type` al registry**

**Justificación:**
1. **Reduce falsos positivos en la raíz del problema.** Las 5 features que aparecen en casi todos los productos enterprise (`api_access`, `integrations`, `saml_sso`, `audit_logs`, `roles_permissions`) más `sla` y `priority_support` son claramente prerrequisitos de infraestructura, no diferenciadores de dominio. Etiquetarlas como `infrastructure` permite al algoritmo excluirlas del cálculo de solapamiento sin eliminarlas del catálogo.
2. **Única fuente de verdad.** La clasificación vive junto a los datos de la feature. Si se añade una feature nueva, el desarrollador debe declarar su `type` — no puede olvidarse de añadirla a una lista separada.
3. **La `category` existente se mantiene como subcategoría para UX.** La distinción `core` vs `infrastructure` es ortogonal a `security` vs `integration` vs `core`. Un filtro de UI puede mostrar "Core Features: Security" como `type=core, category=security` (ej. `advanced_analytics`).

---

### Decisión 2: Silos de Comparación — Matriz de Compatibilidad vs Grafo de Adyacencia

**Problema:** Hoy `RELATED_CATEGORIES` define qué categorías SaaS son comparables. El `StackAuditor` NO usa `RELATED_CATEGORIES` — compara TODOS los pares de herramientas sin importar su categoría. Esto es la causa directa de falsos positivos como "Bitbucket vs Microsoft Teams son redundantes".

#### Alternativa A: Matriz de compatibilidad en `categories.ts`

Extender `RELATED_CATEGORIES` con una estructura explícita que defina qué categorías pueden compararse entre sí para detectar redundancia:

```typescript
export const COMPARISON_SILOS: Record<string, string[]> = {
  'CRM & Sales':        ['CRM & Sales', 'Email Marketing'],
  'Customer Support':   ['Customer Support', 'CRM & Sales'],
  'Communication':      ['Communication', 'Video Conferencing'],
  'Project Management': ['Project Management', 'Productivity & Wiki'],
  'Video Conferencing': ['Video Conferencing', 'Communication'],
  'Email Marketing':    ['Email Marketing', 'CRM & Sales'],
  'Productivity & Wiki':['Productivity & Wiki', 'Project Management'],
  'Dev Tools':          ['Dev Tools'],
  'Design':             ['Design'],
  'Monitoring':          ['Monitoring'],
};
```

- **Pros:**
  - Simple de leer ymaintener: es un `Record<string, string[]>` idéntico en estructura a `RELATED_CATEGORIES`
  - Fácil de validar: si una categoría aparece como clave, debe estar en `CATEGORY_ORDER`; si aparece como valor, también
  - Consulta O(1): `COMPARISON_SILOS[t1.category]?.includes(t2.category)`
  - Se puede reutilizar `RELATED_CATEGORIES` como fallback si no se define un silo para una categoría
  - Consistente con el patrón existente del proyecto

- **Contras:**
  - Menos flexible que un grafo: las relaciones son binarias (A es comparable con B) sin gradación
  - Si se desea en el futuro ponderar la relevancia (ej. "CRM & Sales tiene solapamiento 0.8 con Email Marketing pero solo 0.3 con Customer Support"), se necesitaría migrar a una estructura más compleja
  - La definición de qué categorías son comparables es subjetiva y requiere conocimiento del dominio

#### Alternativa B: Grafo de adyacencia con pesos de relevancia

Definir una estructura más rica donde cada par de categorías tiene un peso de relevancia:

```typescript
export const CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
  'CRM & Sales': {
    'CRM & Sales': 1.0,
    'Email Marketing': 0.8,
    'Customer Support': 0.5,
  },
  'Communication': {
    'Communication': 1.0,
    'Video Conferencing': 0.7,
  },
  // ...
};
```

- **Pros:**
  - Permite gradación fina: "CRM & Sales es 80% relevante para Email Marketing pero solo 50% relevante para Customer Support"
  - El peso se puede usar como multiplicador en el cálculo de solapamiento: `effectiveOverlap = coreOverlapCount * categoryWeight`
  - Futuro-proof: si se quiere un sistema de scoring más sofisticado, los pesos ya están ahí

- **Contras:**
  - **Complejidad significativamente mayor**: definir pesos para cada par de categorías (10 categorías = 45 pares + diagonales) es arbitrario y difícil de justificar sin datos empíricos
  - **Over-engineering para el caso actual**: con 10 categorías y ~50 productos, una matriz binaria es suficiente. Los pesos añaden complejidad sin beneficio medible hoy.
  - **Mantenibilidad reducida**: cada vez que se añade una categoría, hay que definir N nuevos pesos (N = número de categorías existentes). Con una matriz binaria, solo hay que listar las categorías comparables.
  - **Difícil de calibrar**: ¿qué peso tiene "Dev Tools" vs "Project Management"? ¿0.6? ¿0.4? Sin datos de usuario, es especulación.

### Decisión Recomendada: **Alternativa A — Matriz de compatibilidad (`COMPARISON_SILOS`)**

**Justificación:**
1. **La complejidad de los pesos no se justifica.** Con 10 categorías y un catálogo de ~55 productos, una relación binaria "comparable/no comparable" es suficiente para eliminar los falsos positivos más graves (Dev Tools vs Communication, Monitoring vs CRM). La granularidad adicional de pesos no cambia cualitativamente el resultado: el umbral >60% sobre core features ya filtra suficientemente.
2. **Consistencia con el código existente.** `RELATED_CATEGORIES` ya usa `Record<string, string[]>` para relaciones entre categorías. `COMPARISON_SILOS` sigue el mismo patrón, lo que reduce la carga cognitiva para futuros mantenedores.
3. **Mantenibilidad.** Añadir una categoría nueva requiere solo listar con cuáles es comparable. No requiere asignar 9 pesos arbitrarios.

**Diseño específico de `COMPARISON_SILOS`:**

El principio rector es: **dos categorías son comparables si y solo si las herramientas de ambas categorías pueden sustituirse entre sí en algún escenario de negocio**.

| Categoría | Categorías comparables | Justificación |
|-----------|----------------------|---------------|
| CRM & Sales | CRM & Sales, Email Marketing, Customer Support | CRMs y herramientas de email marketing sustituyen funciones de gestión de contactos y automatización |
| Customer Support | Customer Support, CRM & Sales | Soporte y CRM comparten gestión de clientes |
| Communication | Communication, Video Conferencing | Chat y videollamadas compiten en colaboración |
| Project Management | Project Management, Productivity & Wiki, Dev Tools | Gestión de proyectos se solapa con productividad y herramientas de dev |
| Video Conferencing | Video Conferencing, Communication | Videollamadas son forma de comunicación |
| Email Marketing | Email Marketing, CRM & Sales | Email marketing es extensión de CRM |
| Productivity & Wiki | Productivity & Wiki, Project Management, Design | Wikis y productividad solapan con gestión de proyectos y diseño |
| Dev Tools | Dev Tools, Project Management, Monitoring | Herramientas de dev y gestión de proyectos comparten features de automatización |
| Design | Design, Productivity & Wiki | Herramientas de diseño y productividad solapan en colaboración visual |
| Monitoring | Monitoring, Dev Tools | Monitoreo y dev tools comparten infraestructura y alerting |

**Nota importante:** `COMPARISON_SILOS` es más restrictivo que `RELATED_CATEGORIES`. Mientras `RELATED_CATEGORIES` se usa en `DowngradeEngine` para buscar *alternativas* (donde es aceptable ser más amplio), `COMPARISON_SILOS` se usa en `StackAuditor` para detectar *redundancia* (donde es crítico ser más estricto). Esto es intencional: es mejor perder una redundancia real que reportar una falsa.

---

### Decisión 3: Refactorización de `analyzeStack` — Filtrado en Runtime vs Core-First Overlap

**Problema actual:** El algoritmo de `analyzeStack` calcula solapamiento entre TODAS las features (`featureIds`) de dos herramientas, con un umbral del 40% del set más pequeño. Las features de infraestructura (`api_access`, `saml_sso`, etc.) inflan el solapamiento artificialmente.

#### Alternativa A: Filtrar features de infrastructure en runtime y calcular solapamiento solo con core features

```typescript
function analyzeStack(toolIds: string[], allProducts: SaaSProductData[], fmt: (val: number) => string): StackAuditResult {
  const tools = allProducts.filter(p => toolIds.includes(p.id));
  const coreFeatureIds = new Set(
    featureRegistry.filter(f => f.type === 'core').map(f => f.id)
  );
  
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      const t1 = tools[i];
      const t2 = tools[j];
      
      // Step 1: Check comparison silo
      const silo = COMPARISON_SILOS[t1.category];
      if (!silo || !silo.includes(t2.category)) continue;
      
      // Step 2: Filter to core features only
      const t1Core = t1.featureIds.filter(fid => coreFeatureIds.has(fid));
      const t2Core = t2.featureIds.filter(fid => coreFeatureIds.has(fid));
      
      // Step 3: Calculate core overlap
      const t2CoreSet = new Set(t2Core);
      const coreOverlap = t1Core.filter(fid => t2CoreSet.has(fid));
      
      // Step 4: Apply threshold (>60% of the smaller core set)
      if (coreOverlap.length === 0) continue;
      const threshold = Math.ceil(Math.min(t1Core.length, t2Core.length) * 0.6);
      
      if (coreOverlap.length >= threshold && coreOverlap.length >= 2) {
        // Generate redundancy pair...
      }
    }
  }
}
```

- **Pros:**
  - **Elimina falsos positivos en la raíz**: GitLab vs Zoom ya no se comparan porque están en silos distintos (Dev Tools vs Video Conferencing)
  - Aún dentro del mismo silo, solo las core features cuentan para el solapamiento: `api_access` e `integrations` se excluyen del cálculo
  - El umbral del 60% sobre core features es más significativo que 40% sobre todas las features
  - Se preserva la información completa de features para la UI (se muestran todas las overlapping features, no solo las core)
  - Requiere mínimo cambio: el `StackAuditResult` y la interfaz de tipos no cambian

- **Contras:**
  - Dos productos que solo comparten infrastructure features (ej. ambos tienen SSO y API) ya no se marcan como redundantes, lo cual es correcto pero requiere actualizar la UI para explicar por qué
  - La lista de `unusedTools` también debe actualizarse para usar solo core features
  - Si dos productos están en el mismo silo pero tienen 0 core features, nunca se reportan como redundantes (umbral >=2). Esto podría ocultar redundancias muy débiles (pero el exploratorio mostró que esas redundancias son casi siempre falsos positivos)

#### Alternativa B: Calcular solapamiento basado únicamente en `coreFeatures` filtrados previamente, SIN silos de comparación

Modificar el algoritmo para solo considerar features de tipo `core`, pero mantener la comparación universal entre todas las categorías:

```typescript
// Only core features count for overlap
const coreFeatureIds = new Set(featureRegistry.filter(f => f.type === 'core').map(f => f.id));
const f1Core = new Set(t1.featureIds.filter(fid => coreFeatureIds.has(fid)));
const f2Core = new Set(t2.featureIds.filter(fid => coreFeatureIds.has(fid)));

const coreOverlap = [...f1Core].filter(fid => f2Core.has(fid));
const threshold = Math.ceil(Math.min(f1Core.size, f2Core.size) * 0.6);

if (coreOverlap.length >= threshold && coreOverlap.length >= 2) {
  // Still comparing across ALL categories
}
```

- **Pros:**
  - Más simple: no requiere `COMPARISON_SILOS`, solo el filtro de `type === 'core'`
  - Menos código nuevo que mantener
  - El umbral alto (60%) sobre core features ya reduce muchos falsos positivos

- **Contras:**
  - **Aún compara herramientas de dominios dispares**: un CRM y una herramienta de monitorización que casualmente comparten `reporting` y `advanced_analytics` seguirían siendo comparados, aunque no sean sustituibles
  - **No resuelve el caso de Bitbucket vs Teams**: si ambos tienen 5 features y 3 son `core` (ej. `custom_fields`, `workflows`, `reporting`), y comparten 2, el umbral de 60% de 3 = `Math.ceil(1.8)` = 2, y 2 >= 2 → aún podría detectar falsos positivos
  - **Menos preciso que los silos**: sin la restricción de categoría, el algoritmo confía exclusivamente en el solapamiento de core features. Pero core features como `reporting` o `custom_fields` son lo suficientemente genéricas para aparecer en herramientas muy diferentes (Notion y Jira comparten `custom_fields` y `workflows`, pero uno es wiki y el otro es project management agile — su redundancia real es cuestionable)

### Decisión Recomendada: **Alternativa A — Filtrar features de infrastructure + usar silos de comparación**

**Justificación:**
1. **Dos capas de protección son necesarias.** Filtrar solo por `type === 'core'` sin silos deja pasar falsos positivos entre dominios dispares (ej. Notion vs Jira comparten `custom_fields`, `workflows`, `reporting`). Los silos eliminan comparaciones entre categorías que no tienen relación funcional (Dev Tools vs Communication).
2. **El umbral >60% fue explícitamente solicitado por el usuario.** Con el umbral original del 40%, el solapamiento de core features era demasiado permisivo. El 60% requiere que las herramientas compartan la mayoría de sus capacidades de dominio, lo que es la definición correcta de "redundancia real".
3. **Rendimiento: la verificación de silo es O(1)** — una simple búsqueda en `COMPARISON_SILOS[category]?.includes(otherCategory)` — y filtra la mayoría de los pares antes del cálculo de intersección de features, reduciendo iteraciones innecesarias.
4. **Claridad del código:** el algoritmo queda en tres pasos legibles: (1) ¿están en el mismo silo? → no ⇒ skip, (2) ¿cuántas core features comparten? → poco ⇒ skip, (3) ¿supera el umbral >60%? → no ⇒ skip. Cada paso es auto-explicativo.

---

### Decisión 4: Migración de JSONs — Script Manual vs Script Automatizado

**Problema:** Los 50 JSONs existentes en `src/content/saas/` contienen `featureIds` que ahora deben ser consistentes con la nueva taxonomía `type: core | infrastructure`. Además, se necesita un catálogo exhaustivo de core features (el usuario solicitó ampliar el registry de 15 a ~25-30 features). Esto requiere:
- Actualizar el registry con nuevas features y el campo `type`
- Verificar que los `featureIds` en cada JSON sigan siendo válidos
- Potencialmente reasignar features si los IDs cambian

#### Alternativa A: Migración manual (script one-off de verificación)

Actualizar `features-registry.ts` manualmente con las nuevas features y el campo `type`. Luego crear un script Node que:
1. Lea todos los JSONs
2. Verifique que cada `featureId` en cada JSON exista en el registry actualizado
3. Reporte IDs inválidos o features faltantes
4. No modifique los JSONs — solo los valida

- **Pros:**
  - Control total: el desarrollador decide exactamente qué cambió y por qué
  - Sin riesgo de corrupción: el script no escribe, solo lee y reporta
  - Simple de implementar: ~100 líneas de Node

- **Contras:**
  - Si se añaden 15 features nuevas al registry, los JSONs existentes NO se actualizan automáticamente. Los productos que deberían tener las nuevas features (ej. `dashboards`, `file_sharing`) seguirán con el subconjunto actual.
  - El trabajo manual de revisar 50 JSONs para decidir qué features nuevas aplica a cada producto es considerable (50 × ~3 features nuevas = ~150 decisiones manuales)
  - Propenso a errores humanos: olvidar añadir `dashboards` a un producto que lo tiene

#### Alternativa B: Script de migración automatizado que lea el nuevo registry y asigne features por mapeo

Crear un script Node (`scripts/migrate-features.mjs`) que:
1. Lea el registry actualizado (con `type: 'core' | 'infrastructure'` y ~25-30 features)
2. Para cada JSON, analice el `category` del producto y su `description` para sugerir qué features nuevas aplicar
3. Use un mapa de categoría → features recomendadas (ej. los productos de "CRM & Sales" deberían tener `crm_basic`; los de "Communication" deberían tener `real_time_messaging`)
4. Escriba los JSONs actualizados con los nuevos `featureIds`
5. Genere un reporte de cambios para revisión humana

- **Pros:**
  - Automatiza la parte más tediosa: asignar features nuevas a 50 JSONs basándose en su categoría
  - El mapa de categoría → features es una fuente de verdad que se puede auditar
  - Genera un reporte de diff para revisión manual
  - Reduce errores de omisión (el script no se olvida de productos)

- **Contras:**
  - Más complejo de implementar: ~200-300 líneas de Node con lógica de mapeo
  - Requiere revisión manual del output (el script puede asignar incorrectamente — ej. darle `dashboards` a un producto que no tiene dashboards)
  - El mapa de categoría → features es una generalización que puede no aplicar a todos los productos de la categoría

### Decisión Recomendada: **Alternativa B — Script de migración automatizado con revisión humana**

**Justificación:**
1. **El catálogo exhaustivo de core features es un requisito del usuario.** Si añadimos 10-15 features nuevas al registry, necesitamos actualizar 50 JSONs. Hacerlo manualmente es propenso a errores y toma horas. Un script que sugiera y aplique basándose en `category` reduce el trabajo a revisión y corrección, no creación desde cero.
2. **El mapa `category → suggested featureIds` es una fuente de verdad auditable.** Se puede revisar antes de ejecutar el script y ajustar las sugerencias. Es mejor tener un mapeo documentado que decisiones dispersas en 50 archivos.
3. **El script es one-off pero reutilizable.** Si en el futuro se añaden más features o más productos, el mismo patrón se puede replicar.

**Diseño del script:**

```javascript
// scripts/migrate-features.mjs
// 1. Lee features-registry.ts y extrae los IDs y tipos
// 2. Define CATEGORY_DEFAULTS: mapa de categoría → featureIds sugeridas
// 3. Para cada JSON:
//    a. Lee el JSON
//    b. Añade featureIds sugeridos por categoría que no existan ya
//    c. Valida que todos los featureIds existan en el registry
//    d. Escribe el JSON actualizado
// 4. Genera reporte: {added: [...], removed: [...], invalid: [...]}
```

**Mapa de categoría → features base sugeridas (subjecto a revisión):**

| Categoría | Core features sugeridas adicionales |
|-----------|--------------------------------------|
| CRM & Sales | `crm_basic`, `email_automation`, `reporting`, `custom_fields` |
| Communication | `real_time_messaging`, `file_sharing`, `integrations` |
| Customer Support | `ticketing`, `knowledge_base`, `reporting` |
| Project Management | `custom_fields`, `workflows`, `reporting`, `dashboards` |
| Video Conferencing | `real_time_messaging`, `file_sharing`, `recording` |
| Email Marketing | `email_automation`, `reporting`, `dashboards` |
| Productivity & Wiki | `custom_fields`, `file_sharing`, `collaboration` |
| Dev Tools | `api_access`, `integrations`, `reporting`, `dashboards` |
| Design | `file_sharing`, `collaboration`, `version_control` |
| Monitoring | `reporting`, `dashboards`, `alerting` |

**Nota:** Este mapa es un punto de partida. El script añadirá las features sugeridas y generará un reporte. El desarrollador revisa el reporte y corrige manualmente las asignaciones incorrectas antes de hacer commit.

---

### Decisión 5: Estrategia de Testing — Vitest Unit Tests vs Playwright E2E

**Problema:** El proyecto no tiene tests automatizados. La refactorización de `analyzeStack` (nuevos silos, filtrado de features, umbral >60%) y la adición de `type` al registry requieren tests para garantizar que:
- Los falsos positivos desaparecen (ej. GitHub vs Zoom ya no se detectan como redundantes)
- Los verdaderos positivos se mantienen (ej. HubSpot vs Salesforce siguen detectándose como redundantes)
- El cálculo de `unusedTools` se comporta correctamente con core features
- El registro de features mantiene consistencia (cada feature tiene `type` válido)

#### Alternativa A: Tests unitarios con Vitest

Añadir Vitest al proyecto y crear tests unitarios para:
1. **`features-registry.ts`**: verificar que cada feature tiene un `type` válido, que no hay IDs duplicados, que las core features son ≥ N, que las infrastructure features son ≥ M
2. **`categories.ts`**: verificar que `COMPARISON_SILOS` es simétrico (si A incluye B, B incluye A), que todas las categorías existen en `CATEGORY_ORDER`
3. **Algoritmo `analyzeStack` (extraído como función pura)**: testear casos específicos de falsos positivos y verdaderos positivos
4. **`validate-data.mjs` refactorizado como módulo importable**: testear la validación de JSONs

- **Pros:**
  - Vitest es el test runner recomendado por Astro y compatible con el ecosistema Vite
  - Los tests unitarios son rápidos (mirrors de segundo por test)
  - Permiten TDD: escribir los tests antes de refactorizar (casos de GitHub vs Zoom = no redundante, HubSpot vs Salesforce = redundante)
  - Se pueden ejecutar en CI/CD (GitHub Actions ya existe)
  - Cobertura precisa de lógica de negocio (algoritmo de solapamiento, silos, filtrado de features)

- **Contras:**
  - No testean la UI (selectores, renderizado de componentes React)
  - Requiere extraer `analyzeStack` como módulo independiente (buena práctica de todos modos)
  - Configuración inicial (~30 min para añadir Vitest, `vitest.config.ts`, etc.)

#### Alternativa B: Tests E2E con Playwright

Añadir Playwright y crear tests end-to-end que:
1. Navegan a `/audit`
2. Seleccionan herramientas específicas
3. Verifican que los resultados esperados aparecen en el DOM
4. Verifican que los falsos positivos no aparecen

- **Pros:**
  - Testean la experiencia completa del usuario: selección → cálculo → UI
  - Capturan bugs de integración (React hydration, eventos, rendering)
  - No requieren extraer lógica de negocio del componente

- **Contras:**
  - **Extremadamente lentos para lógica de negocio**: un test E2E que selecciona 5 herramientas y verifica el resultado tarda 5-10 segundos. Un test unitario de `analyzeStack` tarda 1ms.
  - **Fragilidad**: los selectores de Playwright dependen de la estructura del DOM, que puede cambiar frecuentemente en un componente React
  - **Setup costoso**: Playwright requiere descargar browsers (~200MB), configurar Astro preview server, y manejar async/await para interacciones complejas
  - **No es útil para TDD del algoritmo**: no permite testear la lógica de solapamiento de forma aislada y rápida
  - **Overkill para refactorizar funciones puras**: `analyzeStack`, `COMPARISON_SILOS`, y `featureRegistry` son datos y funciones puras — el lugar natural para testarlas es con tests unitarios

### Decisión Recomendada: **Alternativa A — Vitest para tests unitarios**

**Justificación:**
1. **La refactorización afecta principalmente lógica de negocio pura.** `analyzeStack` es una función que toma arrays y devuelve un objeto estructurado. `featureRegistry` es un array de objetos. `COMPARISON_SILOS` es un mapa. Todas son unidades aisladas que no dependen del DOM ni de React. Los tests unitarios son la herramienta correcta para estas unidades.
2. **TDD es esencial para la refactorización.** Antes de cambiar el algoritmo, debemos escribir tests que capturen el comportamiento actual (ej. "GitHub y Zoom se detectan como redundantes con el umbral antiguo") y luego verificar que el nuevo algoritmo elimina esos falsos positivos (ej. "GitHub y Zoom NO se detectan como redundantes con silos + core features + umbral 60%").
3. **Vitest es la opción natural para Astro 6.** Astro recomienda Vitest para testing. La configuración es mínima (`npm install -D vitest` + `vitest.config.ts`). Los tests se ejecutan con `npx vitest` y se integran con el workflow de GitHub Actions existente.
4. **Playwright es complementario, no sustitutivo.** Si en el futuro se desea test E2E de la UI, se puede añadir Playwright para flujos críticos (selección de herramientas, cambio de moneda). Pero para la refactorización del algoritmo, los tests unitarios son más valiosos por orden de magnitud.

**Plan de tests propuesto:**

```
src/
  __tests__/
    features-registry.test.ts   → Validar tipos, IDs únicos, completitud
    categories.test.ts          → Validar COMPARISON_SILOS (simetría, cobertura)
    analyze-stack.test.ts       → Casos de falsos positivos y verdaderos positivos
    unused-tools.test.ts        → Casos edge de la lógica de unused tools
```

**Casos de test clave para `analyzeStack`:**

| Caso | Stack | Resultado esperado (nuevo algoritmo) |
|------|-------|---------------------------------------|
| GitHub vs Zoom (falso positivo) | github, zoom | No redundante (silos distintos: Dev Tools ≠ Video Conferencing) |
| Bitbucket vs Teams (falso positivo) | bitbucket, microsoft-teams | No redundante (silos distintos: Dev Tools ≠ Communication) |
| HubSpot vs Salesforce (verdadero positivo) | hubspot, salesforce | Redundante (mismo silo: CRM & Sales, core features solapan) |
| Slack vs Teams (verdadero positivo) | slack, microsoft-teams | Redundante (mismo silo: Communication, core features solapan) |
| Jira vs Notion (caso límite) | jira, notion | Redundante solo si core overlap > 60% (Project Management vs Productivity & Wiki son comparables, pero Jira y Notion tienen diferencias funcionales significativas) |
| Un modelo con 1 herramienta | slack | Sin resultados (necesita ≥2 herramientas) |
| Todas las herramientas en silos distintos | github, slack, zoom | Sin redundancias (ningún par pertenece al mismo silo) |

---

## 3. Decisión Recomendada — Resumen

| Decisión | Opción recomendada | Motivos principales |
|----------|-------------------|---------------------|
| Categorización de features | **Alternativa B:Campo `type` en el registry** | Única fuente de verdad; derivable en runtime; reduce falsos positivos en la raíz; extensible sin breaking changes |
| Silos de comparación | **Alternativa A:Matriz `COMPARISON_SILOS`** | Consistente con el patrón existente; O(1) de consulta; suficientemente expresiva para 10 categorías; no over-engineered |
| Refactorización de `analyzeStack` | **Alternativa A:Filtrar infrastructure + silos + umbral 60%** | Dos capas de protección; algoritmo legible en 3 pasos; elimina falsos positivos graves (Dev Tools vs Communication) |
| Migración de JSONs | **Alternativa B:Script automatizado con revisión humana** | Catálogo exhaustivo requiere actualizar 50 JSONs; script reduce errores de omisión; mapa de categoría → features es auditable |
| Tests | **Alternativa A:Vitest unitarios** | Lógica de negocio pura; TDD es esencial para refactorizar; órdenes de magnitud más rápido que E2E; Vitest es natural para Astro |

---

## 4. Impacto Estimado

### Archivos modificados

| Archivo | Tipo de cambio | Complejidad |
|---------|---------------|-------------|
| `src/data/features-registry.ts` | Añadir campo `type`, ~15 nuevas features, ~10 funciones helper | Media |
| `src/lib/categories.ts` | Añadir `COMPARISON_SILOS`, helpers de consulta | Baja |
| `src/components/StackAuditor.tsx` | Refactorizar `analyzeStack` (silos + core features + umbral 60%), refactorizar `unusedTools` | Alta |
| `src/types/saas.ts` | Posiblemente extender `StackAuditResult` con campos de silo/core info | Baja |
| `src/content/saas/*.json` (50 archivos) | Añadir nuevos `featureIds` según mapeo automatizado | Media |
| `scripts/migrate-features.mjs` | NUEVO — Script de migración automatizado | Media |
| `scripts/validate-data.mjs` | Actualizar para validar `type` en registry y nuevos featureIds | Baja |
| `src/__tests__/features-registry.test.ts` | NUEVO — Tests unitarios del registry | Baja |
| `src/__tests__/categories.test.ts` | NUEVO — Tests unitarios de silos | Baja |
| `src/__tests__/analyze-stack.test.ts` | NUEVO — Tests unitarios del algoritmo | Media |
| `src/__tests__/unused-tools.test.ts` | NUEVO — Tests unitarios de unused tools | Baja |
| `vitest.config.ts` | NUEVO — Configuración de Vitest | Baja |
| `package.json` | Añadir `vitest` como devDependency | Baja |

### Dependencias añadidas

| Dependencia | Propósito | Tamaño estimado |
|------------|-----------|-----------------|
| `vitest` | Test runner para unit tests | ~2MB (dev only, no bundle impact) |

### Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Categorización incorrecta de `type` en features del registry | El mapeo propuesto es conservador: solo 7 de 15 features son `infrastructure`. Los tests unitarios verificarán que las features etiquetadas como `infrastructure` aparecen en ≥50% de los productos enterprise. |
| `COMPARISON_SILOS` demasiado restrictivo, ocultando redundancias reales | Los silos se definen de manera similar a `RELATED_CATEGORIES` pero más restrictivos. Si se detectan falsos negativos, se pueden ampliar gradualmente. Los tests cubrirán los 5 casos clave. |
| Script de migración introduce features incorrectas en JSONs | El script genera un reporte de diff para revisión humana. No se hace commit sin revisión manual. |
| Umbral del 60% demasiado alto para productos con pocas core features | Productos con solo 1-2 core features (ej. Zoom tiene `reporting` como única core feature) tendrán umbral de `Math.ceil(min(1,2) * 0.6) = 1`, lo que requiere al menos 1 core feature compartida + el mínimo de 2 features. Se puede ajustar el mínimo absoluto. |
| Refactorización de `analyzeStack` rompe la UX existente | Los resultados cambiarán significativamente (menos redundancias reportadas). Los tests unitarios garantizarán que las redundancias reales se mantienen. Se recomienda A/B visual para verificar. |

---

## 5. Deuda Técnica

### Deuda técnica eliminada

1. **Falsos positivos masivos en `analyzeStack`**: El algoritmo actual compara todos los pares sin restricción de categoría y features genéricas. La refactorización elimina este problema raíz.
2. **`unusedTools` no considera dominio**: La lógica actual marca una herramienta como "unused" si otra tiene todas sus features. La refactorización solo considera core features y silos.
3. **Validador hardcodeado**: `validate-data.mjs` tendrá una lista dinámica derivada del registry real (o importará el registry directamente si se migra a `.ts`).
4. **Regulatory sin `type`**: El registry ahora clasifica features por función (core vs infrastructure), no solo por tema (security, integration, etc.).

### Deuda técnica introducida

1. **`COMPARISON_SILOS` es un mapa manual**: Si se añaden nuevas categorías, hay que actualizar el mapa manualmente. Mitigación: tests unitarios verifican que todas las categorías en `CATEGORY_ORDER` existen como claves en `COMPARISON_SILOS`.
2. **Umbral del 60% es arbitrario**: No hay datos empíricos que justifiquen este valor específico. Mitigación: se puede parametrizar como constante configurable y ajustar con retroalimentación de usuarios.
3. **Script de migración no se re-ejecuta automáticamente**: Si se añaden más features o productos después de la migración inicial, el script debe ejecutarse de nuevo. Mitigación: documentar el proceso en un README o en el propio script.
4. **No hay tests E2E para la UI del StackAuditor**: Los tests unitarios cubren la lógica de negocio, pero no la interacción del usuario con el componente React. Mitigación: se puede añadir Playwright en una iteración futura si se detectan bugs de UI.

### Deuda técnica pendiente (no abordada en esta refactorización)

1. **Precios hardcodeados en `currency.ts`**: Las tasas de cambio son estáticas. Se podría conectar a una API de cotización en el futuro, pero no es requisito de esta tarea.
2. **`featureRegistry` no tiene Zod schema**: A diferencia de los JSONs de productos, el registry de features no tiene validación Zod. Se podría añadir un schema para consistencia.
3. **No hay validación de que `COMPARISON_SILOS` es simétrico**: Si A aparece en el silo de B pero B no aparece en el silo de A, se pierden comparaciones. Los tests lo verificarán, pero no hay build-time check.
4. **Los componentes React del StackAuditor no tienen storybook ni tests de snapshot**: La UI se verifica manualmente. Se podría añadir Storybook en el futuro.