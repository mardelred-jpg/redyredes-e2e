# redyredes-e2e

**Plataforma de Validación Continua del Customer Journey — RedyRedes**

Repositorio independiente que contiene todos los tests E2E del sistema. Valida el Customer Journey completo desde la perspectiva del usuario final, sin depender de ningún repositorio concreto de la plataforma.

---

## Tests disponibles

| Test | Trigger | Descripción |
|------|---------|-------------|
| **PAT-000** | Cada push | Smoke test: API live/ready/health, DB, reachability |
| **PAT-001B** | Deploy a integration | Customer Journey completo (Testing Token) |
| **PAT-001C** | Manual | Customer Journey con UI real de Clerk |

---

## Configuración inicial

### 1. Dependencias

```bash
npm install
npx playwright install chromium
```

### 2. Variables de entorno

```bash
cp .env.e2e.example .env.e2e
# Editar .env.e2e con los valores reales
```

Las variables necesarias son:

| Variable | Descripción |
|----------|-------------|
| `E2E_JOIN_URL` | URL del onboarding (ej: `https://join.redyredes.com`) |
| `E2E_DASHBOARD_URL` | URL del dashboard (ej: `https://dashboard.redyredes.com`) |
| `E2E_API_URL` | URL de la API core (ej: `https://api.redyredes.com`) |
| `E2E_EMAIL_DOMAIN` | Dominio de emails de prueba (`e2e-test.redyredes.com`) |
| `DATABASE_URL` | Misma cadena de conexión que `redyredes-core` |
| `CLERK_SECRET_KEY` | `sk_test_...` — Clave secreta de Clerk (modo test) |
| `CLERK_TESTING_TOKEN` | Token para bypass de auth en PAT-001B |
| `STRIPE_SECRET_KEY` | `sk_test_...` — Solo para futuros tests de billing |

> **`CLERK_TESTING_TOKEN`**: Generarlo desde el dashboard de Clerk → Testing → Playwright tokens. Es de corta duración y se renueva automáticamente en CI mediante el secret de GitHub Actions.

---

## Ejecución local

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

### Configuración de Branch Protection (paso manual en GitHub)

Para que el CI sea requisito antes de mergear a `main`:

1. **Settings → Branches → Branch protection rules**
2. **Add rule** para la rama `main`
3. Activar: ✅ **Require status checks to pass before merging**
4. Buscar y añadir: `Required Checks (PAT-000 must pass)`
5. Activar: ✅ **Require branches to be up to date before merging**

### Secrets necesarios en GitHub

Ir a **Settings → Secrets and variables → Actions** y añadir:

| Secret | Valor |
|--------|-------|
| `E2E_API_URL` | `https://api.redyredes.com` |
| `E2E_JOIN_URL` | `https://join.redyredes.com` |
| `E2E_DASHBOARD_URL` | `https://dashboard.redyredes.com` |
| `E2E_EMAIL_DOMAIN` | `e2e-test.redyredes.com` |
| `DATABASE_URL` | Cadena de conexión a Neon DB |
| `CLERK_SECRET_KEY` | Secret key de Clerk |
| `CLERK_TESTING_TOKEN` | Testing token de Playwright (Clerk) |
| `STRIPE_SECRET_KEY` | `sk_test_...` (Stripe test mode) |

---

## Artefactos de Playwright

Cuando un test falla en CI, se publican automáticamente:

| Artefacto | Descripción |
|-----------|-------------|
| `*-report-N` | Informe HTML interactivo de Playwright |
| `*-artifacts-N` | Vídeo `.webm` del recorrido completo |
| | Traza `.zip` (abrir con `npx playwright show-trace`) |
| | Capturas `.png` del momento del fallo |

Retención: 7 días para PAT-000, 30 días para PAT-001B.

---

## Arquitectura de datos E2E

Todos los datos de prueba se marcan con `environment = 'E2E'` en la base de datos. La guardia de aislamiento verifica antes de terminar cada test que:

- Ninguna organización `PRODUCTION` tiene clientes con email `@e2e-test.redyredes.com`.
- Ninguna organización con emails E2E está marcada como `PRODUCTION`.

El reset (`e2e/helpers/db-verify.ts → resetE2EDatabase`) nunca toca datos marcados como `PRODUCTION`.

---

## Roadmap de tests

| PAT | Estado | Descripción |
|-----|--------|-------------|
| PAT-000 | ✅ Activo | Smoke test — plataforma UP |
| PAT-001B | ✅ Activo | Customer Journey (Testing Token) |
| PAT-001C | ✅ Activo | Customer Journey (Real Clerk UI) |
| PAT-002 | 🔜 Pendiente | Billing Journey (Stripe) — tras OT-AUTH |
