FROM node:20-alpine As Builder 

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

FROM node:20-alpine As Production

WORKDIR /app

COPY package*.json ./

COPY --from=Builder /app/node_modules ./node_modules

COPY --from=Builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]