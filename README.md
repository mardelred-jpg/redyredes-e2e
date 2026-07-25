# redyredes-e2e

**Cross-repository End-to-End testing and Continuous Validation framework for the RedyRedes platform.**

Repositorio independiente que centraliza toda la validación de la plataforma desde la perspectiva del usuario final, garantizando que el entorno de producción nunca se vea comprometido.

---

## Suite de Pruebas

| Suite | Objetivo | Cuándo se ejecuta |
|-------|----------|-------------------|
| **PAT-000** | Smoke test rápido (verificar que la plataforma está viva) | Cada push |
| **PAT-001B** | Customer Journey completo (Testing Token) | Integración / Staging |
| **PAT-001C** | Customer Journey con UI real de Clerk | Manual o programado |
| **PAT-002** | Billing Journey (Stripe) | Futuro (Tras OT-AUTH) |

---

## Configuración inicial

### 1. Dependencias

```bash
npm install
npx playwright install chromium
```

### 2. Variables de entorno (GitHub Secrets)

Para que el CI funcione, se deben configurar los siguientes **Repository Secrets** en GitHub.

#### Secretos Obligatorios

| Variable | Descripción |
|----------|-------------|
| `E2E_API_URL` | URL de la API core. |
| `E2E_JOIN_URL` | URL del onboarding. |
| `E2E_DASHBOARD_URL` | URL del dashboard. |
| `DATABASE_URL` | Cadena de conexión a la base de datos (requerida por PAT-001B para validación de integridad). |
| `CLERK_TESTING_TOKEN` | Token para bypass de auth en Playwright (generar desde Dashboard Clerk -> Testing). Requerido por PAT-001B. |

#### Secretos Opcionales

| Variable | Descripción |
|----------|-------------|
| `CLERK_SECRET_KEY` | Clave secreta de Clerk. Necesaria si se requiere validación profunda o borrado de usuarios en Clerk. |
| `STRIPE_SECRET_KEY` | Clave secreta de Stripe. Requerida para futuros tests de billing (PAT-002). |
| `E2E_EMAIL_DOMAIN` | Dominio de emails de prueba (por defecto `e2e-test.redyredes.com`). |

> **Nota de seguridad**: Nunca documentes valores reales de secretos en el README ni los incluyas en control de versiones.

---

## Ejecución local

Copia `.env.e2e.example` a `.env.e2e` y configura tus valores locales.

```bash
# PAT-000: Smoke test rápido (~60s)
npm run e2e:pat000

# PAT-001B: Customer Journey completo (headless)
npm run e2e:pat001b

# PAT-001B: Con navegador visible (debug)
npm run e2e:pat001b:headed

# PAT-001B: Paso a paso con Playwright inspector
npm run e2e:pat001b:debug

# PAT-001C: Journey con UI real de Clerk
npm run e2e:pat001c:headed

# Abrir último informe HTML
npm run e2e:report

# Abrir traza de un fallo
npm run e2e:trace
```

---

## CI/CD — GitHub Actions

### Workflows activos

| Workflow | Fichero | Trigger |
|----------|---------|---------|
| PAT-000 Smoke | `pat-000-smoke.yml` | Todo push, todo PR |
| PAT-001B Journey | `pat-001b-journey.yml` | Deploy a integration/staging, push a `integration` |
| Branch Protection | `branch-protection.yml` | PRs a `main` |

### Configuración de Branch Protection

Para que el CI sea requisito antes de mergear a `main`:

1. **Settings → Branches → Branch protection rules**
2. **Add rule** para la rama `main`
3. Activar: ✅ **Require a pull request before merging**
4. Activar: ✅ **Require status checks to pass before merging**
5. Buscar y añadir: `Required Checks (PAT-000 must pass)`
6. Activar: ✅ **Require branches to be up to date before merging**

---

## Artefactos de Playwright

Cuando un test falla en CI, se publican automáticamente:

| Artefacto | Descripción |
|-----------|-------------|
| `*-report-N` | Informe HTML interactivo de Playwright |
| `*-artifacts-N` | Vídeo `.webm` del recorrido completo, Traza `.zip`, Capturas `.png` |

Retención: 7 días para PAT-000, 30 días para PAT-001B.

---

## Arquitectura de datos E2E

Todos los datos de prueba se marcan con `environment = 'E2E'` en la base de datos. La guardia de aislamiento (en PAT-001B) verifica antes de terminar cada test que:

- Ninguna organización `PRODUCTION` tiene clientes con email de E2E.
- Ninguna organización con emails E2E está marcada como `PRODUCTION`.

El reset (`e2e/helpers/db-verify.ts → resetE2EDatabase`) nunca toca datos marcados como `PRODUCTION`.
