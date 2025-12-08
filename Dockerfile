FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3011

CMD ["npx", "nodemon", "--legacy-watch", "src/liver/index.js"]



# FROM node:20

# WORKDIR /app

# COPY package*.json ./
# RUN npm install --production

# COPY . .

# EXPOSE 3011

# CMD ["node", "src/liver/index.js"]