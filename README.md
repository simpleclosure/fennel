# Project Name

For browser automation.

## Prerequisites

.env.development file from a teammate

### Installing Docker

#### macOS

1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. Run the installer and follow the installation wizard
3. Start Docker Desktop
4. Verify installation by running `docker --version` in your terminal

### Running the Container

1. Build the Docker image:

```bash
docker build -t fennel .
```

2. Run the container:

```bash
docker run -p 8080:8080 --env-file .env.development fennel
```

### Deploying the Container to Cloud Run

Details to come.
