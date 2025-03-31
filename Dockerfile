# Use a minimal image for the final container
FROM node:alpine3.19

# Set the working directory inside the container
WORKDIR /app

COPY . .

RUN npm i

# Expose the port your application listens on
EXPOSE 8080

# Command to run the executable
ENTRYPOINT ["node","src/index.js"]
