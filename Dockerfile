FROM node:24-alpine3.24 AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run check && npm run build

FROM nginx:1.30-alpine3.24
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz
ENTRYPOINT ["nginx", "-g", "daemon off;"]
