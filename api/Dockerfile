FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Install all deps (including dev) so that prisma CLI is available for migrations,
# then generate the client from the schema we copied below.
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# Re-generate the Prisma client for the production image's platform
RUN npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
