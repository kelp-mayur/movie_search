FROM node:20-alpine As Builder 

WORKDIR /app

COPY package*.json ./

RUN npm install 

COPY . .

RUN npm run build

FROM node:20-alpine As Production

WORKDIR /app
 
COPY --from=Builder /app/dist/frontend/browser ./dist

RUN npm install -g serve

EXPOSE 4201

CMD ["serve", "-s", "dist", "-l", "4201"]

