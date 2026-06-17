# Plan de Tareas — Refactorización de StackAuditor (v2)
> Generado desde: `spec.md` (secciones 1–7) + `design.md` (arquitectura detallada)
> Alcance: Fase 5 SDD — Categorización, Silos, Filtros y Migración
> Total tareas: 17 (+ 3 sub-tareas verificables)

---

## 1. Mapa de Dependencias (Grafo)

```
FASE 0 — Fundación (sin dependencias entre sí)
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ T1:      │  │ T2:      │  │ T3:      │  │ T8:      │
  │ features │  │ COMPARI- │  │ types/   │  │ Vitest   │
  │ registry │  │ SON_SILOS│  │ saas.ts  │  │ config   │
  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
       │             │             │             │
       ▼             ▼             ▼             │
  ┌──────────┐  ┌──────────┐                ┌────┴─────┐
  │ T5:      │  │ T7:      │                │ T8b:     │
  │ migrate  │  │ validate │                │ helpers  │
  │ script   │  │ update   │                │ (mocks)  │
  └────┬─────┘  └──────────┘                └──────────┘
       │                                        │
       ▼                                        │
  ┌──────────┐                                   │
  │ T6: Run  │                                   │
  │ migrate  │                                   │
  └────┬─────┘                                   │
       │                                         │
       ▼             ▼                           ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ T4:      │  │ T9:      │  │ T10:     │  │ T11+T12: │
  │ Stack    │  │ registry │  │ category │  │ analyze  │
  │ Auditor  │  │ tests    │  │ tests    │  │ +unused  │
  │ refactor │  └──────────┘  └──────────┘  │ tests    │
  └────┬─────┘                               └──────────┘
       │
       └──────────────────┬──────────────────┐
                          ▼                  ▼
                    ┌──────────┐       ┌──────────┐
                    │ T13:     │       │ T14:     │
                    │ validate │       │ build    │
                    └────┬─────┘       └────┬─────┘
                         │                  │
                         └──────┬───────────┘
                                ▼
                          ┌──────────┐
                          │ T15:     │
                          │ npm test │
                          └────┬─────┘
                               │
                               ▼
                          ┌──────────┐
                          │ T16:     │
                          │ docs     │
                          └──────────┘
```

**Leyenda:**
- `→` flecha = "depende de"
- Tareas en el mismo nivel horizontal = PARALELIZABLES
- Tareas en cascada vertical = SECUENCIALES

---

## 2. Lista de Tareas Atómicas

### FASE 0 — Fundación (PARALELIZABLE COMPLETAMENTE)

---

#### T1: Extender `features-registry.ts` con tipo `type` y catálogo de 31 features

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/data/features-registry.ts` |
| **Dependencias** | Ninguna |
| **Paralelizable** | **SÍ** — No depende de ningún otro cambio |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | `RegistryFeature` tiene campo `type: 'core' \| 'infrastructure'` |
| | El array `featureRegistry` tiene 31 entradas exactas (según tabla §2.1.2 del design) |
| | Las 7 features infrastructure existentes tienen `type: 'infrastructure'` |
| | Las 24 features core existentes+nuevas tienen `type: 'core'` |
| | Se exportan 6 helpers: `getCoreFeatureIds()`, `getInfrastructureFeatureIds()`, `isCoreFeature()`, `isInfrastructureFeature()`, `filterCoreFeatures()`, `filterInfrastructureFeatures()` |
| | `getCoreFeatureIds().length >= 20` |
| | `getInfrastructureFeatureIds()` contiene exactamente `['api_access','integrations','saml_sso','audit_logs','sla','priority_support','roles_permissions']` |
| | Cada `description` tiene ≥30 caracteres |
| | No hay IDs duplicados ni `name` duplicados |
| | `as const satisfies RegistryFeature[]` se preserva |
| | Se exporta `REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6` y `MIN_CORE_OVERLAP_FEATURES = 2` |
| | `npm run build` compila sin errores |

---

#### T2: Añadir `COMPARISON_SILOS` y `areCategoriesComparable()` a `categories.ts`

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/lib/categories.ts` |
| **Dependencias** | Ninguna |
| **Paralelizable** | **SÍ** — No depende de ningún otro cambio |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | `COMPARISON_SILOS: Record<string, string[]>` exportado con las 10 categorías como claves según definición canónica (design §2.2.1) |
| | `areCategoriesComparable(cat1: string, cat2: string): boolean` exportada |
| | `areCategoriesComparable('Dev Tools', 'Communication')` → `false` |
| | `areCategoriesComparable('Dev Tools', 'Video Conferencing')` → `false` |
| | `areCategoriesComparable('CRM & Sales', 'CRM & Sales')` → `true` |
| | `areCategoriesComparable('CRM & Sales', 'Email Marketing')` → `true` |
| | `areCategoriesComparable('Project Management', 'Productivity & Wiki')` → `true` |
| | `RELATED_CATEGORIES` permanece sin cambios |
| | `CATEGORY_ORDER` permanece sin cambios |
| | `groupProductsByCategory()` permanece sin cambios |
| | `npm run build` compila sin errores |

---

#### T3: Extender `StackAuditResult` en `types/saas.ts` con 4 campos nuevos

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/types/saas.ts` |
| **Dependencias** | Ninguna |
| **Paralelizable** | **SÍ** — No depende de ningún otro cambio |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | `StackAuditResult.redundantPairs[]` extiende con: |
| | → `overlappingCoreFeatures: string[]` (solo featureIds core solapados) |
| | → `overlappingCoreFeatureNames: string[]` (nombres de solo core features) |
| | → `siloCategory: string` (categoría del silo compartido) |
| | → `redundancyReason: 'core_overlap'` (razón canónica de redundancia) |
| | Todos los campos nuevos son requeridos (no opcionales) |
| | Interfaces existentes (`SaaSProductData`, `SaaSPlanData`, etc.) sin cambios |
| | `npm run build` compila sin errores |

---

#### T4: Configurar Vitest (`vitest.config.ts` + `package.json`)

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `vitest.config.ts` (NUEVO), `package.json` (MOD) |
| **Dependencias** | Ninguna |
| **Paralelizable** | **SÍ** — No depende de ningún otro cambio |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | `vitest.config.ts` existe con `environment: 'node'` e `include: ['src/__tests__/**/*.test.ts']` |
| | `package.json.scripts` contiene `"test": "vitest run"` y `"test:watch": "vitest"` |
| | `package.json.devDependencies` incluye `"vitest": "^1.6.0"` |
| | `npm install` instala vitest sin errores |
| | `npx vitest run` ejecuta y reporta "No test files found" (aún no hay tests) |

---

#### T4b: Crear `src/__tests__/helpers.ts` con factorías de mocks

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/__tests__/helpers.ts` (NUEVO) |
| **Dependencias** | T3 (tipo `StackAuditResult` extendido), T8 (Vitest) |
| **Paralelizable** | **SÍ** — Solo depende de T3 y T8, ambos de Fase 0 |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | Exporta `createMockProduct(overrides): SaaSProductData` con defaults sensatos |
| | Exporta `mockFmt = (val: number): string => \`$\${val}\`` |
| | `createMockProduct({ id: 'test', featureIds: ['crm_basic'] })` produce objeto válido |
| | `createMockProduct({ plans: [...] })` permite sobrescribir planes |
| | Archivo compila sin errores de TypeScript |

---

### FASE 1 — Scripts (dependen de Fase 0, paralelizables entre sí)

---

#### T5: Crear `scripts/migrate-features.mjs` (script de migración de JSONs)

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `scripts/migrate-features.mjs` (NUEVO) |
| **Dependencias** | T1 (registry con 31 features para `REGISTRY_FEATURE_IDS` y `CORE_FEATURE_IDS`) |
| **Paralelizable** | **NO** (depende de T1) — Pero corre en paralelo con T7 (tras T1) |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | Script ESM (`type: "module"`) ejecutable con `node scripts/migrate-features.mjs` |
| | Contiene `REGISTRY_FEATURE_IDS` (Set con los 31 IDs) y `CORE_FEATURE_IDS` (Set con los 24 core) |
| | Contiene `CATEGORY_DEFAULT_FEATURES` con mapa de core + infra por categoría según design §4.1.2 |
| | Función `migrateProduct()` que añade features sugeridas sin eliminar existentes |
| | Función `main()` que itera los 50 JSONs y escribe `migration-report.json` |
| | Valida que todos los `featureIds` existan en `REGISTRY_FEATURE_IDS` |
| | Reporta IDs inválidos como `invalid` sin modificarlos |
| | Preserva `proprietaryFeatures` intactas |
| | Exit code 0 si todos los IDs son válidos, 1 si hay inválidos |
| | Verifica que cada JSON tenga ≥1 core feature tras migración |

---

#### T6: Ejecutar script de migración y actualizar los 50 JSONs

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/content/saas/*.json` (50 archivos) |
| **Dependencias** | T5 (script de migración existe) |
| **Paralelizable** | **NO** — Requiere que T5 esté completado |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | `node scripts/migrate-features.mjs` ejecuta sin errores |
| | 50 JSONs tienen `featureIds` actualizados con nuevas features sugeridas |
| | `migration-report.json` existe y documenta `added`, `removed`, `unchanged`, `invalid` por producto |
| | Cada JSON tiene ≥1 feature con `type === 'core'` |
| | No existen `featureIds` duplicados dentro de ningún JSON |
| | `proprietaryFeatures` de todos los JSONs permanecen sin cambios |
| | `npm run validate` pasa sin errores (tras T7) |

---

#### T7: Actualizar `scripts/validate-data.mjs` con lista ampliada de feature IDs

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `scripts/validate-data.mjs` (MOD) |
| **Dependencias** | T1 (nuevos 31 feature IDs del registry) |
| **Paralelizable** | **NO** (depende de T1) — Pero corre en paralelo con T5 (tras T1) |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | El array `featureRegistry` en línea ~19-22 se reemplaza con los 31 IDs completos |
| | Estructura del script (validación de errores, warnings, exit code) permanece igual |
| | `npm run validate` reconoce los 31 feature IDs como válidos |
| | Si se añade una feature nueva al registry en el futuro, hay que actualizar manualmente (documentado con comentario) |
| | Exit code 0 si todos los JSONs tienen featureIds válidos |

---

### FASE 2 — Lógica Core (depende de Fase 0)

---

#### T8: Refactorizar `StackAuditor.tsx` — extraer `analyzeStack` como función pura y reescribir con silos + core + umbral 60%

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/components/StackAuditor.tsx` (MOD) |
| **Dependencias** | T1 (helpers: `getCoreFeatureIds`, `filterCoreFeatures`), T2 (`areCategoriesComparable`), T3 (`StackAuditResult` extendido) |
| **Paralelizable** | **NO** — Requiere T1, T2, T3 completados |
| **Complejidad** | Alta |
| **Criterio de completitud** | |
| | **Imports modificados:** |
| | → Añadir `import { getCoreFeatureIds, filterCoreFeatures, getFeaturesByIds } from '../data/features-registry'` |
| | → Añadir `import { areCategoriesComparable } from '../lib/categories'` |
| | |
| | **Extraer `computeUnusedTools()` como función pura exportable:** |
| | → `export function computeUnusedTools(tools: SaaSProductData[], coreFeatureIds: Set<string>): string[]` |
| | → Solo considera features con `type === 'core'` |
| | → Si `toolCoreFeatures.length === 0` → no es unused |
| | → Requiere `tools.length > 1` |
| | → Si todas las core features están cubiertas por otras herramientas → es unused |
| | |
| | **Refactorizar `analyzeStack()` (exportada para testing):** |
| | → `export function analyzeStack(...)` |
| | → Paso 1: Precomputar `coreFeatureIds = new Set(getCoreFeatureIds())` |
| | → Paso 2: Para cada par (i,j): |
| | &nbsp;&nbsp;&nbsp; → 2a: `areCategoriesComparable(t1.category, t2.category)` — si no, `continue` |
| | &nbsp;&nbsp;&nbsp; → 2b: Filtrar a solo core features `t1Core = t1.featureIds.filter(fid => coreFeatureIds.has(fid))` |
| | &nbsp;&nbsp;&nbsp; → 2c: Si `Math.min(t1Core.length, t2Core.length) === 0` → `continue` |
| | &nbsp;&nbsp;&nbsp; → 2d: Calcular `coreOverlap`, umbral = `Math.ceil(min * 0.6)`, mínimo absoluto = 2 |
| | &nbsp;&nbsp;&nbsp; → 2e: Si supera umbral → generar `redundantPair` con los 4 campos nuevos (`overlappingCoreFeatures`, `overlappingCoreFeatureNames`, `siloCategory`, `redundancyReason`) |
| | → Paso 3: La recomendación menciona core features por nombre y el silo compartido |
| | → Paso 4: `unusedTools = computeUnusedTools(tools, coreFeatureIds)` |
| | |
| | **UI (`StackAuditorInner`):** Sin cambios en JSX, estilos, search, localStorage, debounce |
| | |
| | **Verificación de casos:** |
| | → `analyzeStack(['github', 'zoom'], mockProducts, mockFmt).redundantPairs.length === 0` |
| | → `analyzeStack(['hubspot', 'salesforce'], mockProducts, mockFmt).redundantPairs.length >= 1` |
| | → Herramienta con 0 core features no aparece en `unusedTools` |
| | → `npm run build` compila sin errores |

---

### FASE 3 — Tests Unitarios (dependen de Fase 0 y Fase 2)

---

#### T9: Escribir tests para `features-registry.ts`

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/__tests__/features-registry.test.ts` (NUEVO) |
| **Dependencias** | T1 (registry completo), T8 (Vitest) |
| **Paralelizable** | **SÍ** — Solo depende de T1 y T8 (Fase 0); puede correr en paralelo con T10 |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | Tests para todos los casos FR-01 a FR-12 del spec §5.3: |
| | → FR-01: Toda entrada tiene `type` definido |
| | → FR-02: No hay IDs duplicados |
| | → FR-03: `getCoreFeatureIds().length >= 20` |
| | → FR-04: `getInfrastructureFeatureIds()` contiene exactamente las 7 infrastructure |
| | → FR-05: `isCoreFeature('crm_basic')` → `true` |
| | → FR-06: `isCoreFeature('api_access')` → `false` |
| | → FR-07: `isInfrastructureFeature('saml_sso')` → `true` |
| | → FR-08: `filterCoreFeatures` filtra correctamente |
| | → FR-09: `filterInfrastructureFeatures` filtra correctamente |
| | → FR-10: Ningún `description` < 30 caracteres |
| | → FR-11: `featureRegistry.length >= 31` |
| | → FR-12: Cada vertical SaaS tiene ≥3 core features en el registry |
| | Todos los tests pasan con `npx vitest run` |

---

#### T10: Escribir tests para `COMPARISON_SILOS` en `categories.ts`

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/__tests__/categories.test.ts` (NUEVO) |
| **Dependencias** | T2 (`COMPARISON_SILOS`, `areCategoriesComparable`), T8 (Vitest) |
| **Paralelizable** | **SÍ** — Solo depende de T2 y T8 (Fase 0); puede correr en paralelo con T9 |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | Tests para casos CAT-01 a CAT-13 del spec §5.4: |
| | → CAT-01: Las 10 categorías son claves en `COMPARISON_SILOS` |
| | → CAT-02: Todos los valores existen como claves |
| | → CAT-03 a CAT-07: `areCategoriesComparable` retorna `false` para silos incompatibles |
| | → CAT-08 a CAT-11: `areCategoriesComparable` retorna `true` para silos compatibles |
| | → CAT-12: Categoría comparable consigo misma |
| | → CAT-13: Simetría Communication ⇔ Video Conferencing |
| | Todos los tests pasan con `npx vitest run` |

---

#### T11: Escribir tests para `analyzeStack` (falsos positivos y verdaderos positivos)

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/__tests__/analyze-stack.test.ts` (NUEVO) |
| **Dependencias** | T4b (helpers con mocks), T8 (StackAuditor.tsx refactorizado), T8b (Vitest) |
| **Paralelizable** | **NO** — Requiere T8 completo |
| **Complejidad** | Alta |
| **Criterio de completitud** | |
| | Tests T1-T10 del spec §5.5 implementados y pasando: |
| | → T1: `['github','zoom']` → 0 redundancias (distintos silos) |
| | → T2: `['bitbucket','microsoft-teams']` → 0 redundancias |
| | → T3: `['gitlab','zoom']` → 0 redundancias |
| | → T4: `['hubspot','salesforce']` → ≥1 redundancia (mismo silo CRM) |
| | → T5: `['slack','microsoft-teams']` → ≥1 redundancia (mismo silo Communication) |
| | → T6: `['github','slack','zoom']` → 0 redundancias |
| | → T7: `['slack']` → 0 redundancias, unusedTools = [] |
| | → T8: `['github','bitbucket']` → dependiente del core overlap |
| | → T9: `['jira','notion']` → dependiente del core overlap |
| | → T10: `['datadog','vercel']` → 0 redundancias si 0 core overlap |
| | Tests usan `createMockProduct()` y `mockFmt` de helpers.ts |
| | Tests NO dependen de React, DOM, localStorage, ni red |
| | Tests deterministas y ejecución < 5s |
| | `npx vitest run` — todos los tests pasan |

---

#### T12: Escribir tests para `unusedTools`

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/__tests__/unused-tools.test.ts` (NUEVO) |
| **Dependencias** | T4b (helpers), T8 (StackAuditor.tsx con `computeUnusedTools`), T8b (Vitest) |
| **Paralelizable** | **NO** — Requiere T8 completo; puede correr en paralelo con T11 (tras T8) |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | Tests U1-U6 del spec §5.6 implementados y pasando: |
| | → U1: Teams (solo infra) + Zoom → Teams NO en unusedTools (0 core features) |
| | → U2: HubSpot + Salesforce + Pipedrive → Pipedrive SÍ en unusedTools (core subset) |
| | → U3: Slack (con core única) + Teams → Slack NO en unusedTools |
| | → U4: Tool A (0 core) + Tool B (3 core) → Tool A NO en unusedTools |
| | → U5: Stack de 1 → unusedTools = [] |
| | → U6: Stack con features idénticas → ambas o una en unusedTools |
| | Tests usan `computeUnusedTools` importada directamente desde StackAuditor.tsx |
| | `npx vitest run` — todos los tests pasan |

---

### FASE 4 — Verificación (siempre al final)

---

#### T13: Ejecutar `npm run validate` y corregir errores en JSONs

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/content/saas/*.json` (potenciales correcciones) |
| **Dependencias** | T6 (JSONs migrados), T7 (validador actualizado) |
| **Paralelizable** | **NO** — Requiere migración y validador |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | `npm run validate` termina con exit code 0 |
| | 0 errores de `registry-ref-check` |
| | Si hay IDs inválidos reportados, se corrigen manualmente en los JSONs |
| | Si algún JSON tiene 0 core features, se añade manualmente |
| | `migration-report.json` se revisa y los cambios se confirman |

---

#### T14: Ejecutar `npm run build` y corregir errores de TypeScript

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | Todos los modificados |
| **Dependencias** | T4 (StackAuditor.tsx compila), T6 (JSONs migrados), T7 (validador) |
| **Paralelizable** | **NO** — Requiere que todo el código compilable esté listo |
| **Complejidad** | Media |
| **Criterio de completitud** | |
| | `npm run build` → exit code 0 |
| | Sin errores de TypeScript (strict mode) |
| | Sin errores de Zod en la generación del sitio estático |
| | Directorio `dist/` generado correctamente |
| | Sin warnings de builds |

---

#### T15: Ejecutar `npm test` (Vitest) y asegurar 100% de tests pasan

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | — |
| **Dependencias** | T9, T10, T11, T12 (todos los tests escritos), T8b (Vitest configurado) |
| **Paralelizable** | **NO** — Requiere que todos los tests existan |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | `npx vitest run` → exit code 0 |
| | Todos los tests (FR-01 a FR-12, CAT-01 a CAT-13, T1-T10, U1-U6) pasan |
| | Tiempo total de ejecución < 10s |
| | `npm run test` funciona (script en package.json) |

---

#### T16: Actualizar documentación (comentarios y README si es necesario)

| Propiedad | Valor |
|-----------|-------|
| **Archivos** | `src/data/features-registry.ts`, `src/lib/categories.ts`, `src/components/StackAuditor.tsx`, posiblemente `README.md` |
| **Dependencias** | Todas las tareas anteriores |
| **Paralelizable** | **NO** — Debe ser lo último |
| **Complejidad** | Baja |
| **Criterio de completitud** | |
| | Comentarios JSDoc en los 6 nuevos helpers de features-registry.ts |
| | Comentario explicativo en `COMPARISON_SILOS` aclarando diferencia con `RELATED_CATEGORIES` |
| | Comentario en `REDUNDANCY_CORE_OVERLAP_THRESHOLD` explicando el umbral |
| | Si el README del proyecto existe, verificar que mencione `npm test` y `npm run validate` |
| | Cualquier `@deprecated` necesario en funciones viejas |

---

## 3. Plan de Ejecución por Iteraciones

| Iteración | Tareas | Descripción | Archivos en paralelo |
|-----------|--------|-------------|---------------------|
| **Iter 1** | T1, T2, T3, T8 | **4 tareas en paralelo** — Fundación completa | `features-registry.ts`, `categories.ts`, `types/saas.ts`, `vitest.config.ts` + `package.json` |
| **Iter 2** | T5, T7, T4b | **3 tareas en paralelo** — Scripts + helpers de tests (tras T1) | `migrate-features.mjs`, `validate-data.mjs`, `helpers.ts` |
| **Iter 3** | T6 | Ejecutar migración (tras T5) | Solo `scripts/` |
| **Iter 4** | T8 | Refactorizar StackAuditor (tras T1, T2, T3) | `StackAuditor.tsx` — **tarea crítica, única en esta iteración** |
| **Iter 5** | T9, T10 | **2 tests en paralelo** (tras T1, T2, T8) | `features-registry.test.ts`, `categories.test.ts` |
| **Iter 6** | T11, T12 | **2 tests en paralelo** (tras T8) | `analyze-stack.test.ts`, `unused-tools.test.ts` |
| **Iter 7** | T13, T14 | **2 tareas en paralelo** — Validate + Build | `npm run validate`, `npm run build` |
| **Iter 8** | T15 | Ejecutar tests | `npm test` |
| **Iter 9** | T16 | Documentación final | Comentarios + README |

```
Línea de tiempo óptima (9 iteraciones):

Iter1:  ████ T1 ████  ████ T2 ████  ████ T3 ████  ████ T8 ████
Iter2:         ████████ T5 ████████  ██ T7 ██  ████ T4b ████
Iter3:                ██████████ T6 ██████████
Iter4:                         ████████████████ T8 ████████████████
Iter5:                                     ████ T9 ████  ████ T10 ████
Iter6:                                              ████ T11 ████  ████ T12 ████
Iter7:                                                       ██ T13 ██  ██ T14 ██
Iter8:                                                                 ██ T15 ██
Iter9:                                                                        ██ T16 ██
```

---

## 4. Resumen de Métricas

| Tipo | Total | Paralelizables (1ª iter) |
|------|-------|--------------------------|
| Tareas de implementación | 8 (T1-T8) | **4** (T1, T2, T3, T8) |
| Tareas de tests | 5 (T4b, T9, T10, T11, T12) | **1** (T4b con T5/T7) |
| Tareas de verificación | 3 (T13, T14, T15) | **1** (T13 + T14) |
| Tareas de documentación | 1 (T16) | 0 |
| **Total** | **17** | **4 en la 1ª iteración** (pueden ejecutarse simultáneamente) |

**En la primera iteración de codificación se pueden paralelizar 4 tareas** (T1, T2, T3, T8):
- 3 personas diferentes pueden trabajar simultáneamente en `features-registry.ts`, `categories.ts`, y `types/saas.ts` + `vitest.config.ts`
- Una vez completadas, se disparan T5/T7/T4b en paralelo
- Luego T6 → T8 → T9/T10 → T11/T12 → T13/T14 → T15 → T16

**Complejidad estimada:**
- Alta: 2 (T4, T11)
- Media: 7 (T1, T5, T6, T8, T9, T10, T12, T13, T14)
- Baja: 7 (T2, T3, T4b, T7, T8b, T15, T16)

---

## 5. Checklist de Verificación por Tarea (Criterios de Aceptación)

### T1 — features-registry.ts
- [ ] `RegistryFeature.type: 'core' | 'infrastructure'` declarado
- [ ] 31 entradas en `featureRegistry` (7 infra + 24 core)
- [ ] `getCoreFeatureIds().length >= 20`
- [ ] `getInfrastructureFeatureIds()` → 7 IDs exactos
- [ ] `isCoreFeature('crm_basic')` → `true`
- [ ] `isInfrastructureFeature('api_access')` → `true`
- [ ] `filterCoreFeatures(['crm_basic','api_access'])` → `['crm_basic']`
- [ ] `REDUNDANCY_CORE_OVERLAP_THRESHOLD = 0.6` exportado
- [ ] `MIN_CORE_OVERLAP_FEATURES = 2` exportado
- [ ] `as const satisfies RegistryFeature[]` preservado
- [ ] Sin IDs duplicados
- [ ] Sin names duplicados
- [ ] Todo `description.length >= 30`

### T2 — categories.ts (COMPARISON_SILOS)
- [ ] `COMPARISON_SILOS` exportado con 10 claves
- [ ] `areCategoriesComparable()` exportada
- [ ] Dev Tools no comparable con Communication
- [ ] CRM & Sales comparable con Email Marketing y Customer Support
- [ ] Project Management comparable con Productivity & Wiki y Dev Tools
- [ ] Toda clave-valor es válida bidireccionalmente
- [ ] `RELATED_CATEGORIES` sin cambios
- [ ] `CATEGORY_ORDER` sin cambios

### T3 — types/saas.ts
- [ ] `overlappingCoreFeatures: string[]` en `redundantPairs`
- [ ] `overlappingCoreFeatureNames: string[]`
- [ ] `siloCategory: string`
- [ ] `redundancyReason: 'core_overlap'`
- [ ] Interfaces existentes sin cambios

### T4 — Vitest config
- [ ] `vitest.config.ts` existe con `environment: 'node'`
- [ ] `package.json` tiene script `"test": "vitest run"`
- [ ] `vitest` instalado en devDependencies
- [ ] `npx vitest run` funciona (aunque sin tests aún)

### T4b — helpers.ts
- [ ] `createMockProduct()` exportada
- [ ] `mockFmt` exportada
- [ ] Mocks compilan sin errores de tipo

### T5 — migrate-features.mjs
- [ ] Script ejecutable: `node scripts/migrate-features.mjs`
- [ ] `REGISTRY_FEATURE_IDS` con 31 IDs
- [ ] `CORE_FEATURE_IDS` con 24 core IDs
- [ ] `CATEGORY_DEFAULT_FEATURES` con mapa por categoría
- [ ] No elimina features existentes
- [ ] Preserva `proprietaryFeatures`
- [ ] Genera `migration-report.json`
- [ ] Exit code 0 si OK, 1 si hay inválidos

### T6 — Ejecutar migración
- [ ] Los 50 JSONs actualizados
- [ ] `migration-report.json` generado
- [ ] Cada JSON tiene ≥1 core feature
- [ ] Sin featureIds duplicados en ningún JSON
- [ ] `proprietaryFeatures` intactos

### T7 — validate-data.mjs
- [ ] Lista hardcodeada reemplazada por 31 IDs
- [ ] `npm run validate` exit code 0 tras migración
- [ ] Comentario sobre sincronización manual

### T8 — StackAuditor.tsx refactor
- [ ] `analyzeStack` exportada como función pura
- [ ] `computeUnusedTools` exportada como función pura
- [ ] Importa `getCoreFeatureIds`, `areCategoriesComparable`
- [ ] Filtro de silo implementado (O(1) por par)
- [ ] Filtro core features implementado
- [ ] Umbral >60% del set menor implementado
- [ ] Mínimo absoluto de 2 core features implementado
- [ ] `redundantPair` con los 4 campos nuevos
- [ ] Recomendación menciona core features + categoría
- [ ] `unusedTools` solo considera core features
- [ ] Herramienta con 0 core features → nunca unused
- [ ] UI (StackAuditorInner) sin cambios en JSX
- [ ] `npm run build` → exit code 0

### T9 — features-registry tests
- [ ] FR-01 a FR-12 implementados
- [ ] `npx vitest run` pasa todos

### T10 — categories tests
- [ ] CAT-01 a CAT-13 implementados
- [ ] `npx vitest run` pasa todos

### T11 — analyze-stack tests
- [ ] T1 a T10 implementados
- [ ] Mocks con `createMockProduct` de helpers.ts
- [ ] Sin dependencia de React/DOM/localStorage
- [ ] `npx vitest run` pasa todos

### T12 — unused-tools tests
- [ ] U1 a U6 implementados
- [ ] Importa `computeUnusedTools` directamente
- [ ] `npx vitest run` pasa todos

### T13 — npm run validate
- [ ] Exit code 0
- [ ] 0 errores de registry-ref-check
- [ ] 50 JSONs procesados

### T14 — npm run build
- [ ] Exit code 0
- [ ] Sin errores de TypeScript
- [ ] Sin errores de Zod
- [ ] `dist/` generado

### T15 — npm test
- [ ] Exit code 0
- [ ] Todos los tests (≥41 tests) pasan
- [ ] Tiempo < 10s

### T16 — Documentación
- [ ] JSDoc en helpers nuevos de features-registry.ts
- [ ] Comentario en COMPARISON_SILOS vs RELATED_CATEGORIES
- [ ] README actualizado si es necesario

---

## 6. Archivos Críticos con Múltiples Modificaciones

| Archivo | Modificado por | Orden requerido |
|---------|---------------|-----------------|
| `src/data/features-registry.ts` | T1 | Una sola vez |
| `src/lib/categories.ts` | T2 | Una sola vez |
| `src/types/saas.ts` | T3 | Una sola vez |
| `src/components/StackAuditor.tsx` | **T8** | Una sola vez (refactorización completa) |
| `scripts/migrate-features.mjs` | T5 | Nuevo |
| `scripts/validate-data.mjs` | T7 | Una sola vez |
| `vitest.config.ts` | T8b | Nuevo |
| `package.json` | T8b | Una sola vez |
| `src/content/saas/*.json` (50) | T6 | Migración automatizada por script |
| `src/__tests__/helpers.ts` | T4b | Nuevo |
| `src/__tests__/features-registry.test.ts` | T9 | Nuevo |
| `src/__tests__/categories.test.ts` | T10 | Nuevo |
| `src/__tests__/analyze-stack.test.ts` | T11 | Nuevo |
| `src/__tests__/unused-tools.test.ts` | T12 | Nuevo |

**Nota importante:** Ningún archivo es modificado por más de una tarea (salvo `package.json` que solo añade scripts + devDependency una vez). Esto minimiza conflictos de merge y permite máxima paralelización.
