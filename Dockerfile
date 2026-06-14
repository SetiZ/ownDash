FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install
COPY backend/ ./
RUN npx tsc

FROM node:22-alpine
RUN apk add --no-cache kubectl
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
EXPOSE 3001
ENV FRONTEND_DIST=/app/frontend/dist
CMD ["node", "backend/dist/index.js"]
