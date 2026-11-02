# Build from the repository root: docker build -f apps/www/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @corvo/www...
ARG PUBLIC_POSTHOG_KEY
ARG PUBLIC_POSTHOG_HOST
ARG PUBLIC_CRISP_WEBSITE_ID
RUN pnpm --filter @corvo/www build

FROM nginx:1.27-alpine
COPY apps/www/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/www/dist /usr/share/nginx/html
EXPOSE 80
