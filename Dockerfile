FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        g++ \
        make \
        python3 \
        python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci
RUN pip3 install --break-system-packages -r requirements.txt
RUN npm run build

ENV NODE_ENV=production
ENV PYTHON_CMD=python3

EXPOSE 3000

CMD ["npm", "start"]
