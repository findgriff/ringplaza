FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies using workspaces
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
RUN npm install

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build --workspace @ringplaza/shared
RUN npm run build --workspace @ringplaza/api

EXPOSE 4000
CMD ["npm", "--workspace", "@ringplaza/api", "run", "start"]
