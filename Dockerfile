FROM node:lts-slim

ARG NPM_TOKEN
WORKDIR /usr/src/app

COPY package*.json .npmrc ./
RUN npm set //npm.pkg.github.com/:_authToken $NPM_TOKEN

RUN npm ci

COPY . .

RUN npm run build

CMD npm run start:prod
