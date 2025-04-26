# Astral PDF Search Challenge - Getting Started!

This repository contains the code for the Astral PDF Search Challenge. The goal of this challenge is to create a system that can efficiently search through a large collection of PDF document and return relevant results based on user queries.

## Dev Journey 🕸️

Check out the [Dev Journey](./dev-journey.md) for more details.

## Getting Started 🚀

To run the Project, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/BRAVO68WEB/pdf-search 
```

2. Change into the project directory:

```bash
cd pdf-search
```

3. Install the dependencies:

```bash
bun install
```

4. Start the development server:

```bash
bun dev
```

## Tech Stack 🔨

- `Nextjs`: A React framework for building server-side rendered applications.
- `Typescript`: A superset of JavaScript that adds static typing.
- `Tailwind CSS`: A utility-first CSS framework for styling.
- `Zod`: A TypeScript-first schema declaration and validation library.
- `Kysely`: A type-safe SQL query builder for TypeScript.
- `PostgreSQL`: A powerful, open-source relational database. Hosted on Supabase
- `Bun`: A modern JavaScript runtime that is fast and efficient.
- `React`: A JavaScript library for building user interfaces.
- `Groq-SDK`: A SDK for interacting LLMs via the Groq's AI Inference.
- `Wrangler`: A command-line tool for building and deploying serverless applications on CloudFlare
- `Github Actions`: A continuous integration and continuous deployment (CI/CD) platform for automating the build, test, and deployment process.

## Project Structure 📁

The project is organized into the following files and directories:

- `src`: Contains the source code for the project.
  - `actions`: Contains code related to NextJs Server Actions.
  - `public/`: Contains the static assets for the project.
  - `app/`: Contains code for App Router.
    - `api/`: Contains the API routes for the project.
  - `db/`: Contains the database schema and migrations.
  - `components/`: Contains the React components for the project.
  - `libs/`: Contains the utility functions and libraries used in the project.
- `bun.lockb`: Contains the lockfile for the project.
- `README.md`: This file.
- `package.json`: Contains the metadata for the project.
- `.github/workflows/`: Contains the Github Actions workflows for the project.

## API Routes 📡

The project contains the following API routes:

- `/api/search`: Returns a list of documents that match the search query.
- `/api/history`: Returns a list of search history.
- `/api/pre`: Returns results thats are preprocessed due to previous the search query.

Check [API Routes](./app/api) Directory for more details.

## Database Schema 🗄️

The project uses PostgreSQL as the database. The schema is defined in the [db](./src/db/) directory. The database contains the following tables:

- `search_results`: Contains the search history.
- `pdf_stores`: Contains the metadata for the PDF documents.
- `pdf_parsed`: Contains the relevance data extracted from the PDF documents.

Check [Database Schema](./types/database.d.ts) for more details.

## Environment Variables 🌍

To run the project, you need to set up the following environment variables:
```
GROQ_API_KEY=                   // Groq API Key
CSE_API_KEY=                    // Google Custom Search Engine API Key
CSE_CX_ID=                      // Google Custom Search Engine CX ID
DATABASE_URL=                   // PostgreSQL Database URL
R2_BUCKET_NAME=                 // Cloudflare R2 Bucket Name
R2_ACCESS_KEY_ID=               // Cloudflare R2 Access Key ID
R2_SECRET_ACCESS_KEY=           // Cloudflare R2 Secret Access Key
R2_ENDPOINT=                    // Cloudflare R2 Endpoint
R2_PUBLIC_URL=                  // Cloudflare R2 Public URL
```

## Deployment 🚀

The project is deployed on Cloudflare Workers. The deployment is managed using Wrangler. To deploy the project, run the following command:

```bash
bun run deploy
```

The Project is also deployed to CloudFlare Workers using Github Actions. The deployment is triggered on every push to the main branch
Check [deploy-cf.yaml](.github/workflows/deploy-cf.yaml) for more details.
