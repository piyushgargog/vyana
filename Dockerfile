# Vyana web + API (ADR-053). Build from the repo root:
#   docker compose --env-file apps/web/.env.production up -d --build
FROM node:26-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS build
RUN npm install -g pnpm@12.11.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @vyana/web...
# Next inlines NEXT_PUBLIC_* while it builds; everything else is read at run time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @vyana/web build

FROM node:26-alpine@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
# The server is started with node alone. npm, npx, corepack and yarn are not used here, and they bring dependencies of
# their own that vulnerability scanners report (they are not part of the app). Removing them leaves less to patch.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
# Trivy flags zlib 1.3.2-r0 in the node:26-alpine base image (CVE-2026-85091, heap
# overflow in gz_vacate()) and musl 1.2.6-r2 (CVE-2026-107891, integer overflows
# in regcomp()). The fixes are already in Alpine main (issue #154).
# Install unpinned on purpose: the repo is rolling, and exact pins broke the
# build on 7 Nov 2026 when it retired zlib 1.3.2-r1 and musl 1.2.6-r3 (issue #655).
# The unpinned install takes the repo's current versions, both newer than the
# pinned ones, and the Trivy scan in CI keeps guarding the installed versions.
RUN apk add --no-cache zlib musl musl-utils
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]
