# Image du serveur de jeu. À construire depuis la racine du dépôt :
#   docker build -f server/Dockerfile -t fightforligeria-server .

# 1) construction : on installe les outils et on empaquette server/ + shared/ en deux fichiers autonomes
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.base.json ./
COPY shared shared
COPY server server
RUN npm run build -w server

# 2) exécution : juste Node et les deux fichiers construits (pas de code source, pas de node_modules)
FROM node:22-alpine
ENV NODE_ENV=production PORT=2567
WORKDIR /app
COPY --from=build /app/server/dist/ ./
USER node
EXPOSE 2567
CMD ["node", "index.mjs"]
