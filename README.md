# NameSilo Domain Search API

A simple REST API to check domain availability using NameSilo's API.

## Features
- Check single or multiple domains (up to 20 per request)
- Returns JSON with availability status
- Rate limited (30 requests per minute per IP)
- CORS enabled

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env` and set your `NAMESILO_API_KEY`
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. Test: `curl "http://localhost:3000/api/search?domains=example.com,google.com"`

## API Endpoints

### GET /health
Returns service health.

### GET /api/search?domains=example.com,another.com
Check one or more domains (comma-separated).

### POST /api/search
Body: `{ "domains": ["example.com", "another.com"] }`

## Deployment on Render
This repo includes `render.yaml` for Render Blueprint. Connect your GitHub repository to Render and it will deploy automatically. Set the `NAMESILO_API_KEY` environment variable in the Render dashboard.

## Security
Never commit your API key. Use environment variables.
