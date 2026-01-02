FROM node:18-alpine AS base
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.js apps/web/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/
RUN npm install

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build --workspace @ringplaza/shared
RUN npm run build --workspace @ringplaza/web

EXPOSE 3000
CMD ["npm", "--workspace", "@ringplaza/web", "run", "start"]
