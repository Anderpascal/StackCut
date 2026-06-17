# Memoria Técnica de la Sesión — StackAuditor v2: Categorización, Silos, Filtros y Migración

> **Fecha:** 2026-06-07
> **Pipeline:** SDD completo (Explore → Propose ADR → Spec → Design → Tasks → Apply → Verify → Archive)
> **Estado:** ✅ Build (484 páginas, 16.98s), ✅ Validate (50 productos, 0 errores), ✅ Tests (120/120 en 1.68s)
> **Commit:** Pendiente (trabajo en rama)

---

## 1. Resumen Ejecutivo

Se refactorizó el motor de detección de redundancias `StackAuditor` para eliminar **falsos positivos masivos** que comparaban herramientas de dominios dispares (ej. Bitbucket vs Microsoft Teams detectados como redundantes al 100%). Se introdujo un sistema de tres capas de filtrado — **silos de comparación por categoría**, **clasificación core vs infrastructure** en el registry de features, y **umbral >60%** sobre core features — eliminando 4 falsos positivos graves y conservando 2 verdaderos positivos (HubSpot/Salesforce, Slack/Teams). El registry se amplió de 15 a 31 features (24 core + 7 infrastructure), los 50 JSONs de productos se migraron automáticamente con un script dedicado, y se añadió una suite de **120 tests unitarios** con Vitest. Build, validate y tests pasan con 0 errores.

---

## 2. Decisiones Críticas

### D1. Campo `type: 'core' | 'infrastructure'` en el registry (Alternativa B del ADR)
- **Decisión:** Se añadió `type` como campo directo en `RegistryFeature`, en lugar de listas hardcodeadas separadas (`CORE_FEATURES` / `INFRASTRUCTURE_FEATURES`).
- **Justificación:** Única fuente de verdad; derivable en runtime (`featureRegistry.filter(f => f.type === 'core')`); extensible sin breaking changes; la categoría existente (`security`, `integration`, etc.) se preserva como subcategoría ortogonal.
- **Asignación:** 7 infrastructure (`api_access`, `integrations`, `saml_sso`, `audit_logs`, `sla`, `priority_support`, `roles_permissions`), 24 core.

### D2. Matriz `COMPARISON_SILOS` en lugar de grafo de adyacencia con pesos
- **Decisión:** Se definió `COMPARISON_SILOS: Record<string, string[]>` en `categories.ts` como mapa binario de compatibilidad entre categorías SaaS.
- **Justificación:** Consistente con el patrón `RELATED_CATEGORIES` existente; consulta O(1); suficientemente expresivo para 10 categorías; evita el over-engineering de pesos arbitrarios sin datos de usuario.
- **Principio rector:** Dos categorías son comparables si sus herramientas pueden sustituirse en algún escenario de negocio real. `Dev Tools` NO comparable con `Communication`; `CRM & Sales` SÍ comparable con `Email Marketing`.

### D3. Umbral de redundancia elevado a 60% sobre core features
- **Decisión:** El nuevo algoritmo calcula solapamiento **solo** sobre features con `type === 'core'`, con umbral `>60%` del set más pequeño y mínimo absoluto de 2 core features.
- **Justificación:** El antiguo umbral del 40% sobre todas las features (incluyendo infrastructure) generaba falsos positivos incluso entre herramientas del mismo silo. El 60% sobre core features garantiza que la redundancia detectada refleje solapamiento funcional real.
- **Configuración:** `REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6` y `MIN_CORE_OVERLAP_FEATURES = 2` exportados como constantes.

### D4. Extracción de `analyzeStack` y `computeUnusedTools` como funciones puras exportables
- **Decisión:** Ambas funciones se exportan desde `StackAuditor.tsx` como funciones puras (sin dependencia de React, DOM, o localStorage).
- **Justificación:** Permite testing unitario directo sin jsdom ni montaje de componentes. Ambas aceptan arrays de productos mock y devuelven `StackAuditResult`.
- **Firma:** `export function analyzeStack(toolIds, allProducts, fmt): StackAuditResult` y `export function computeUnusedTools(tools, coreFeatureIds): string[]`.

### D5. Script de migración automatizado para 50 JSONs
- **Decisión:** Se creó `scripts/migrate-features.mjs` con un mapa `CATEGORY_DEFAULT_FEATURES` que asigna features sugeridas por categoría.
- **Justificación:** Automatiza la actualización de 50 JSONs para alinearlos con las 31 features del nuevo registry. No elimina features existentes. Preserva `proprietaryFeatures`. Genera reporte de cambios (`migration-report.json`).
- **Estrategia de parsing:** El script no importa TypeScript directamente; hardcodea los IDs con comentario de sincronización.

### D6. Suite de 120 tests unitarios con Vitest
- **Decisión:** Vitest con `environment: 'node'`, tests en `src/__tests__/`. Sin jsdom, sin React Testing Library.
- **Justificación:** La lógica refactorizada (`analyzeStack`, `computeUnusedTools`, `COMPARISON_SILOS`, `featureRegistry`) es puramente funcional y no depende del DOM. Tests deterministas, < 2s de ejecución total.
- **Desglose:** 57 tests de registry, 37 de silos, 18 de analyzeStack, 8 de unusedTools.

### D7. Validador con parseo dinámico del registry
- **Decisión:** `scripts/validate-data.mjs` ahora parsea dinámicamente el archivo `features-registry.ts` usando un regex para extraer los IDs, en lugar de tener una lista hardcodeada.
- **Justificación:** Elimina la deuda técnica del validador hardcodeado (identificada en el explore report). Cualquier cambio futuro en el registry se refleja automáticamente en la validación.

---

## 3. Cambios en Archivos Clave

### Archivos modificados

| Archivo | Líneas | Cambio principal |
|---------|--------|-------------------|
| `src/data/features-registry.ts` | 367 | + Campo `type` en `RegistryFeature`; de 15 a 31 features (7 infra + 24 core); + 6 helpers (`getCoreFeatureIds`, `filterCoreFeatures`, `isCoreFeature`, etc.); + 2 constantes de umbral |
| `src/lib/categories.ts` | 94 | + `COMPARISON_SILOS` (10 categorías); + `areCategoriesComparable()`; `RELATED_CATEGORIES` y `CATEGORY_ORDER` intactos |
| `src/types/saas.ts` | 163 | + 4 campos en `StackAuditResult.redundantPairs[]`: `overlappingCoreFeatures`, `overlappingCoreFeatureNames`, `siloCategory`, `redundancyReason`; interfaces existentes sin cambios |
| `src/components/StackAuditor.tsx` | 502 | `analyzeStack` reescrita con 3 capas de filtrado (silo → core features → umbral 60%); `computeUnusedTools` extraída como función pura (solo core features); recomendación menciona core features + categoría; UI (`StackAuditorInner`) sin cambios en JSX |
| `scripts/validate-data.mjs` | 310 | Parseo dinámico del registry TS en lugar de lista hardcodeada |
| `package.json` | — | + scripts `"test"` y `"test:watch"`; + `vitest` en devDependencies |

### Archivos creados

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `scripts/migrate-features.mjs` | 380 | Script de migración automatizada de 50 JSONs |
| `vitest.config.ts` | 9 | Configuración de Vitest (environment: node) |
| `src/__tests__/helpers.ts` | 41 | Factorías de mocks: `createMockProduct()`, `mockFmt` |
| `src/__tests__/features-registry.test.ts` | 376 | 57 tests (integridad del registry, helpers, cobertura por vertical) |
| `src/__tests__/categories.test.ts` | 269 | 37 tests (COMPARISON_SILOS, areCategoriesComparable, simetría) |
| `src/__tests__/analyze-stack.test.ts` | 592 | 18 tests (falsos positivos, verdaderos positivos, casos límite) |
| `src/__tests__/unused-tools.test.ts` | 308 | 8 tests (computeUnusedTools: solo core, edge cases) |

### Archivos migrados

| Archivo | Cantidad | Estado |
|---------|----------|--------|
| `src/content/saas/*.json` | 50 | Migrados vía script; 0 modificaciones en última ejecución (ya alineados); 0 featureIds inválidos; 0 productos con 0 core features |

---

## 4. Deuda Técnica Pendiente

### Deuda introducida por esta sesión
- [ ] **`COMPARISON_SILOS` es un mapa manual**: Si se añade una nueva categoría SaaS, hay que actualizar el mapa manualmente. Mitigado: tests (CAT-01, CAT-02) verifican que todas las categorías en `CATEGORY_ORDER` existen como claves y que todos los valores son claves válidas.
- [ ] **Umbral del 60% es arbitrario**: No hay datos empíricos que justifiquen este valor. Se puede parametrizar con retroalimentación de usuarios en una iteración futura. Las constantes `REDUNDANCY_CORE_OVERLAP_THRESHOLD` y `MIN_CORE_OVERLAP_FEATURES` están exportadas para facilitar el ajuste.
- [ ] **No hay tests E2E para la UI del StackAuditor**: Los 120 tests cubren lógica de negocio, pero no la interacción del usuario (selectores, renderizado de resultados, cambio de moneda). Playwright sería la herramienta recomendada para una futura suite E2E.
- [ ] **Script de migración no se re-ejecuta automáticamente**: Si se añaden más features al registry o nuevos productos, el script debe ejecutarse de nuevo. El mapa `CATEGORY_DEFAULT_FEATURES` necesita mantenerse sincronizado.

### Deuda pre-existente (no abordada)
- [ ] **Warning pre-existente en `chatwoot`**: `validate-data.mjs` reporta 1 warning (`oss-alt-feature-check`): openSourceAlternative "Chatwoot Self-Hosted" reemplaza "Chatwoot Cloud". **No fue abordado** porque es pre-existente y no relacionado con la refactorización.
- [ ] **`featureRegistry` no tiene schema Zod**: A diferencia de los JSONs de productos (validados con Zod en `content.config.ts`), el registry de features no tiene validación en tiempo de ejecución. Se podría añadir un schema Zod en una iteración futura.
- [ ] **`RELATED_CATEGORIES` y `DowngradeEngine` no se modificaron**: Se preservaron intactos, pero comparten el mismo archivo `categories.ts`. Esto es intencional (son mapas con propósitos diferentes), pero añade complejidad cognitiva.
- [ ] **Precios hardcodeados en `currency.ts`**: Las tasas de cambio son estáticas (USD/EUR/GBP). Conectar a API de cotización en tiempo real queda para trabajo futuro.
- [ ] **CLS en hidratación de moneda**: Flash inicial de USD antes de leer localStorage (pre-existente, no abordado).

---

## 5. Lecciones Aprendidas

### Lo que funcionó bien
1. **Paralelización de tareas**: La Fase 0 (T1, T2, T3, T8 del plan de tareas) se pudo ejecutar en paralelo al no tener dependencias entre sí, reduciendo el tiempo total de implementación.
2. **TDD con mocks**: Los tests se escribieron usando `createMockProduct()` con productos simulados, lo que permitió verificar el comportamiento del algoritmo sin depender de los 50 JSONs reales ni de la hidratación de Astro.
3. **Parseo dinámico del registry en el validador**: Sustituir la lista hardcodeada de feature IDs por parseo dinámico del archivo TypeScript eliminó la deuda técnica del "validador hardcodeado" (identificada en el explore report) y garantiza que el validador nunca diverja del registry.
4. **Dos capas de protección (silos + core features)**: La combinación de silos de comparación y filtrado de core features eliminó más falsos positivos de los estrictamente requeridos, demostrando ser un diseño robusto.
5. **Vitest con environment node**: Sin jsdom, los tests se ejecutan en 1.68s para 120 tests. La elección de evitar React Testing Library para lógica pura fue acertada.

### Lo que fue difícil
1. **Discrepancia entre script de migración y validador**: Inicialmente, el script de migración asignaba features a los JSONs basándose en `CATEGORY_DEFAULT_FEATURES`, pero el validador aún tenía la lista antigua de 15 features. Fue necesario coordinar la actualización de ambos para que `npm run validate` pasara después de la migración.
2. **Colisiones entre `proprietaryFeatures` y nuevos registry IDs**: Algunos productos tenían features en `proprietaryFeatures` cuyos IDs coincidían (o eran similares) a los nuevos IDs del registry. Fue necesario revisar manualmente para evitar duplicados.
3. **`as const satisfies RegistryFeature[]`**: Mantener el type safety del array con `as const` mientras se añadían 16 nuevas features y el campo `type` requirió atención a los detalles de TypeScript estricto.

### Qué se haría diferente en una próxima iteración
1. **Script de migración con dry-run por defecto**: Aunque el script es no-destructivo (no elimina features), sería más seguro que la primera ejecución fuera un dry-run que solo genere el reporte sin modificar archivos.
2. **Test de regresión visual para la UI**: Aunque el build se genera correctamente, no hay verificación automática de que los resultados de auditoría se rendericen correctamente. Un snapshot test de React o un E2E con Playwright sería valioso.
3. **Parametrización temprana del umbral**: En lugar de hardcodear `REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6`, se podría haber diseñado desde el inicio como parámetro configurable por el usuario en la UI. Esto habría permitido A/B testing del umbral óptimo.
4. **Integración continua de tests en el pipeline de GitHub Actions**: El workflow existente (`agent-pipeline.yml`) ejecuta scraping y rebuild, pero no ejecuta `npm test`. Se debería añadir un paso de tests en el CI.

---

## 6. Referencia Rápida para Futuras Sesiones

### Cómo añadir una nueva feature al registry
1. Editar `src/data/features-registry.ts`.
2. Añadir una nueva entrada al array `featureRegistry` con los 6 campos: `id` (snake_case), `name` (Human Readable), `description` (≥30 chars), `category` (core|security|integration|analytics|support), `type` (core|infrastructure), `isEnterpriseLocked`, `comparable: true`.
3. Si es `type: 'core'`: asegurar que esté listada en el mapa de ≥3 core features por vertical (en el comentario del archivo).
4. Actualizar `REGISTRY_FEATURE_IDS` y `CORE_FEATURE_IDS` en `scripts/migrate-features.mjs` (comentario de sincronización).
5. Ejecutar `node scripts/migrate-features.mjs` para que los JSONs existentes ganen la nueva feature si corresponde por su categoría.
6. Ejecutar `npm run validate && npm run build && npm test`.

### Cómo añadir una nueva categoría SaaS
1. Editar `src/content.config.ts`: añadir la categoría al enum Zod.
2. Editar `src/lib/categories.ts`:
   - Añadir entrada en `COMPARISON_SILOS` definiendo con qué categorías es comparable.
   - Añadir entrada en `CATEGORY_ORDER` (orden de renderizado).
   - Si aplica, añadir entrada en `RELATED_CATEGORIES` (para DowngradeEngine).
3. Editar `scripts/migrate-features.mjs`: añadir entrada en `CATEGORY_DEFAULT_FEATURES` con las core e infrastructure features sugeridas.
4. Añadir ≥3 core features ultra-específicas en el registry para la nueva categoría (actualizar comentario de mapeo).
5. Ejecutar migración y validación.

### Cómo ajustar el umbral de redundancia
- Editar las constantes en `src/data/features-registry.ts` (o en el archivo donde se definan):
  ```typescript
  export const REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6; // >60%
  export const MIN_CORE_OVERLAP_FEATURES = 2; // mínimo absoluto
  ```
- Los tests en `src/__tests__/analyze-stack.test.ts` usan estas constantes; pueden necesitar actualización si se cambia el umbral.

### Cómo ejecutar tests y validación
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build estático (484 páginas esperadas)
npm run validate     # Validación de datos JSON (50 productos, 0 errores esperados)
npm test             # Suite completa de tests Vitest (120 tests, < 2s)
npx vitest --watch   # Modo watch para desarrollo TDD
node scripts/migrate-features.mjs --dry-run  # Simular migración sin modificar archivos
```

---

## 7. Estadísticas Finales

| Métrica | Valor |
|---------|-------|
| **Productos SaaS migrados** | 50 JSONs |
| **Features en registry** | 31 (24 core + 7 infrastructure) |
| **Features infrastructure** | `api_access`, `integrations`, `saml_sso`, `audit_logs`, `sla`, `priority_support`, `roles_permissions` |
| **Tests unitarios** | 120 (57 registry + 37 silos + 18 analyzeStack + 8 unusedTools) |
| **Tiempo de tests** | 1.68s |
| **Páginas en build** | 484 |
| **Tiempo de build** | 16.98s |
| **Errores de build** | 0 |
| **Errores de validación** | 0 |
| **Falsos positivos eliminados** | 4 (Bitbucket vs Teams, GitHub vs Zoom, GitLab vs Zoom, Jira vs Notion) |
| **Verdaderos positivos conservados** | 2 (HubSpot vs Salesforce, Slack vs Teams) |
| **Herramientas helper exportadas** | 8 (`getCoreFeatureIds`, `getInfrastructureFeatureIds`, `isCoreFeature`, `isInfrastructureFeature`, `filterCoreFeatures`, `filterInfrastructureFeatures`, `analyzeStack`, `computeUnusedTools`) |
| **Constantes exportadas** | 2 (`REDUNDANCY_CORE_OVERLAP_THRESHOLD`, `MIN_CORE_OVERLAP_FEATURES`) |
| **Categorías en COMPARISON_SILOS** | 10 |
| **Archivos nuevos** | 7 |
| **Archivos modificados** | 5 |
| **Warnings en validate** | 1 (pre-existente: chatwoot oss-alt) |
