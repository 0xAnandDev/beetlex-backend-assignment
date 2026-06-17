FROM node:20-alpine

# Install OpenSSL and glibc compatibility library required by Prisma engines on Alpine
RUN apk add --no-cache libc6-compat openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and pre-generate the Prisma Client to enable type checking during build
RUN npm install
RUN npx prisma generate

COPY . .

# Compile TypeScript to JavaScript
RUN npm run build

# Ensure the entrypoint script is executable
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
