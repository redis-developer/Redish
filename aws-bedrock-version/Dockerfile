FROM node:24-alpine

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install server dependencies
RUN npm install

# Copy all files
COPY . .

# Expose ports
EXPOSE 3000

# Start app
CMD ["npm", "run", "start"]
