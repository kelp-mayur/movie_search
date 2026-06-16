FROM node:20-alpine As Builder 

WORKDIR /app

COPY package*.json ./

RUN npm install 

COPY . .

RUN npm run build

FROM node:20-alpine As Production

WORKDIR /app
 
COPY --from=Builder /app/dist/frontend ./dist/frontend

RUN npm install -g server

EXPOSE 4201

CMD ["server", "-s" ,"dist", "-l", "4201"]

