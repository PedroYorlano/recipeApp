# Deploy

## Cómo fluye

```
rama → PR → CI (lint, tipos, build web, tests) → merge a main
                                                   ├─ Vercel: build y deploy del frontend (si cambió frontend/)
                                                   └─ GitHub Actions: CI + deploy del backend a Cloud Run (si cambió backend/)
```

- **Frontend**: Vercel, proyecto `pizca`, Root Directory `frontend`. Cada push a una rama que no es `main` genera un preview; `main` va a producción (https://pizca-brown.vercel.app). `ignoreCommand` en `frontend/vercel.json` evita buildear si no cambió `frontend/`.
- **Backend**: Cloud Run, servicio `pizca` en el proyecto `pizca-yorlano`, región `us-east5`, `--max-instances=1`. Lo deploya `.github/workflows/deploy-backend.yml`.
- **Migraciones**: corren solas al arrancar el contenedor (`CMD` del `backend/Dockerfile`). Si una falla, la revisión nueva no levanta y sigue la anterior.
- **Base**: Neon, proyecto `cool-dream-46370959` (aws-us-east-2).

## Variables de entorno

Nunca en el repo.

| Dónde | Qué | Cómo se cambia |
|---|---|---|
| Cloud Run | `SECRET_KEY`, `DATABASE_URL`, `GENAI_API_KEY`, `R2_*`, `CORS_*`, `ALLOWED_HOSTS`, `NUM_PROXIES`… | `gcloud run services update pizca --region us-east5 --update-env-vars CLAVE=valor` (crea una revisión nueva) |
| Vercel | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL` | `vercel env add` desde `frontend/`; aplica en el próximo build |
| GitHub (Settings → Variables) | `GCP_WIF_PROVIDER`, `GCP_SERVICE_ACCOUNT` | No son secretos: solo dicen qué identidad usa el deploy |

El deploy automático **no** pasa `--env-vars-file`: Cloud Run conserva las variables de la revisión anterior. La copia de referencia vive en `~/pizca-prod.yaml` (fuera del repo, chmod 600).

## Rollback

- Backend: `gcloud run revisions list --service pizca --region us-east5` y `gcloud run services update-traffic pizca --region us-east5 --to-revisions REVISION=100`. Ojo: no deshace migraciones.
- Frontend: `vercel rollback` desde `frontend/`, o "Promote to Production" sobre un deploy anterior en el dashboard.

## Configuración inicial (una sola vez)

### Permisos de GCP para GitHub Actions

Esto lo tiene que correr **el dueño del proyecto**: hace falta poder asignar roles, y el rol Editor no alcanza. Usa Workload Identity Federation, así que no hay claves JSON. Solo el repo `PedroYorlano/recipeApp` puede usar la identidad.

```sh
PROJECT=pizca-yorlano
NUMBER=250031710115
REPO=PedroYorlano/recipeApp
SA=github-deployer@$PROJECT.iam.gserviceaccount.com
RUNTIME_SA=$NUMBER-compute@developer.gserviceaccount.com

gcloud iam service-accounts create github-deployer --project $PROJECT \
  --display-name "Deploy desde GitHub Actions"

for role in roles/run.admin roles/cloudbuild.builds.editor roles/artifactregistry.writer \
            roles/storage.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding $PROJECT --member "serviceAccount:$SA" --role $role --condition None
done

# Para deployar una revisión que corre con la cuenta de servicio de runtime.
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA --project $PROJECT \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountUser

gcloud iam workload-identity-pools create github --project $PROJECT --location global \
  --display-name "GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc recipeapp --project $PROJECT \
  --location global --workload-identity-pool github \
  --issuer-uri https://token.actions.githubusercontent.com \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition "assertion.repository == '$REPO'"

gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"
```

Después, en GitHub (lo puede hacer el dueño del repo):

```sh
gh variable set GCP_WIF_PROVIDER --body "projects/250031710115/locations/global/workloadIdentityPools/github/providers/recipeapp"
gh variable set GCP_SERVICE_ACCOUNT --body "github-deployer@pizca-yorlano.iam.gserviceaccount.com"
```

El workflow usa el environment `production` de GitHub. Se crea solo la primera vez; si se quiere aprobar cada deploy a mano, agregarle reviewers en Settings → Environments.

### Vercel conectado al repo

Desde `frontend/`: `vercel git connect`. En el proyecto, Settings → Build and Deployment → Root Directory = `frontend`. La rama de producción es `main`.

Para que los previews puedan hablar con el backend: cargar `EXPO_PUBLIC_API_URL` también en el entorno *Preview*, y en Cloud Run setear `CORS_ALLOWED_ORIGIN_REGEXES` con la regex de las URLs de preview (por ejemplo `^https://pizca-[a-z0-9-]+-pedro-d090\.vercel\.app$`).
