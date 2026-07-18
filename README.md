# MongoBridge - Serverless MongoDB Vercel Backend & Console

MongoBridge is a lightweight, secure serverless Node.js backend designed for Vercel Hobby accounts. It dynamically connects to any MongoDB instance (using a client-supplied connection string and database name), allowing you to save, query, update, and delete documents. 

It comes with a built-in, dark-themed developer dashboard served at the root `/` to interactively construct queries, format payloads, and test operations.

---

## Features

- **Zero-Config Deployment**: Works completely on the Vercel Free Hobby tier.
- **Dynamic Connection Management**: Connects, executes, and closes connection sockets per request, preventing Atlas connection pool exhaustions and Vercel container freezes.
- **Automatic ObjectId Conversion**: Recursively converts hex strings matching MongoDB ObjectIDs in your queries or documents (e.g. `_id` values or values inside `$in` arrays) into BSON `ObjectId`s.
- **CORS Configured**: Global CORS headers are configured via `vercel.json` and endpoint headers, making the API consumable from external frontends.
- **Fail-Fast Timeout**: Implements a 5-second socket selection timeout to avoid hanging serverless functions and exceeding Hobby execution limits.

---

## Directory Structure

```
├── README.md            - Project documentation
├── vercel.json          - Vercel routing & CORS configuration
├── package.json         - Node.js dependencies (mongodb driver)
├── api
│   └── mongo.js         - Vercel serverless function endpoint (/api/mongo)
└── public
    ├── index.html       - Premium Console Dashboard UI
    ├── style.css        - Glassmorphic dark styling
    └── app.js           - Frontend event handlers & api client
```

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the zero-dependency local server**:
   ```bash
   npm start
   ```
   This starts a local development server at `http://localhost:3000` serving the static console files and routing request bodies to the serverless MongoDB API endpoint.

3. **Alternative (Vercel CLI)**:
   If you have the Vercel CLI installed and configured, you can run:
   ```bash
   npx vercel dev
   ```


---

## Deployment to Vercel

Deploying to Vercel is extremely simple and takes less than a minute.

### Option 1: Vercel CLI (Recommended)
From your terminal, run the following command in the project root directory:
```bash
npx vercel
```
Follow the interactive prompts:
- Confirm deployment settings (defaults are fine).
- Once the deployment is complete, it will print your production URL!
- To deploy to production directly: `npx vercel --prod`.

### Option 2: Vercel Dashboard (Git Integration)
1. Push this directory to a GitHub/GitLab/Bitbucket repository.
2. Go to the [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **Add New** > **Project** and select your Git repository.
4. Keep all default configurations (Vercel automatically detects the project layout).
5. Click **Deploy**.

---

## API Documentation

### Endpoint
`POST /api/mongo`

### Request Headers
`Content-Type: application/json`

### Request Body Schema
```json
{
  "connectionString": "YOUR_MONGO_CONNECTION_STRING",
  "db": "YOUR_DATABASE_NAME",
  "collection": "YOUR_COLLECTION_NAME",
  "action": "find | insertOne | insertMany | updateOne | updateMany | deleteOne | deleteMany | count",
  
  "query": {},      // Required for: find, update, delete, count (Optional, defaults to {})
  "options": {},    // Optional for: find, update (e.g. limit, skip, sort, projection)
  "document": {},   // Required for: insertOne
  "documents": [],  // Required for: insertMany (array of objects)
  "update": {}      // Required for: updateOne, updateMany
}
```

### Examples

#### Retrieve (find) documents:
```bash
curl -X POST http://localhost:3000/api/mongo \
  -H "Content-Type: application/json" \
  -d '{
    "connectionString": "mongodb+srv://...",
    "db": "shop_db",
    "collection": "products",
    "action": "find",
    "query": { "inStock": true },
    "options": { "limit": 10, "sort": { "price": -1 } }
  }'
```

#### Save (insertOne) document:
```bash
curl -X POST http://localhost:3000/api/mongo \
  -H "Content-Type: application/json" \
  -d '{
    "connectionString": "mongodb+srv://...",
    "db": "shop_db",
    "collection": "products",
    "action": "insertOne",
    "document": {
      "name": "Mechanical Keyboard",
      "price": 129.99,
      "inStock": true
    }
  }'
```
