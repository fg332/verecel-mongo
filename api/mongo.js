const { MongoClient, ObjectId } = require('mongodb');

// Recursively search for and convert valid 24-character hex strings into MongoDB ObjectIds
// for any keys named '_id' or values in query objects.
function convertObjectIds(val) {
  if (val === null || val === undefined) return val;
  
  if (typeof val === 'string') {
    if (val.length === 24 && /^[0-9a-fA-F]{24}$/.test(val)) {
      try {
        return new ObjectId(val);
      } catch (e) {
        return val;
      }
    }
    return val;
  }
  
  if (Array.isArray(val)) {
    return val.map(convertObjectIds);
  }
  
  if (typeof val === 'object') {
    const parsed = {};
    for (const key of Object.keys(val)) {
      if (key === '_id') {
        parsed[key] = convertObjectIds(val[key]);
      } else {
        parsed[key] = convertObjectIds(val[key]);
      }
    }
    return parsed;
  }
  
  return val;
}

module.exports = async (req, res) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' });
  }

  const { connectionString, db, collection, action } = req.body;

  if (!connectionString) {
    return res.status(400).json({ success: false, error: 'Missing field: connectionString' });
  }
  if (!db) {
    return res.status(400).json({ success: false, error: 'Missing field: db' });
  }
  if (!collection) {
    return res.status(400).json({ success: false, error: 'Missing field: collection' });
  }
  if (!action) {
    return res.status(400).json({ success: false, error: 'Missing field: action' });
  }

  let client;
  try {
    // Initialize MongoClient with a 5-second timeout to prevent serverless function hangs
    client = new MongoClient(connectionString, {
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    const database = client.db(db);
    const col = database.collection(collection);

    let result;

    switch (action) {
      case 'find': {
        const query = convertObjectIds(req.body.query || {});
        const options = req.body.options || {};
        
        let cursor = col.find(query);
        if (options.projection) cursor = cursor.project(options.projection);
        if (options.sort) cursor = cursor.sort(options.sort);
        if (options.skip) cursor = cursor.skip(Number(options.skip));
        if (options.limit) cursor = cursor.limit(Number(options.limit));
        
        result = await cursor.toArray();
        break;
      }
      
      case 'insertOne': {
        const doc = convertObjectIds(req.body.document || {});
        if (Object.keys(doc).length === 0) {
          return res.status(400).json({ success: false, error: 'document field is empty or missing' });
        }
        result = await col.insertOne(doc);
        break;
      }

      case 'insertMany': {
        const docs = req.body.documents;
        if (!Array.isArray(docs) || docs.length === 0) {
          return res.status(400).json({ success: false, error: 'documents field must be a non-empty array' });
        }
        const parsedDocs = docs.map(d => convertObjectIds(d));
        result = await col.insertMany(parsedDocs);
        break;
      }

      case 'updateOne':
      case 'updateMany': {
        const query = convertObjectIds(req.body.query || {});
        const rawUpdate = req.body.update;
        if (!rawUpdate || Object.keys(rawUpdate).length === 0) {
          return res.status(400).json({ success: false, error: 'update field is empty or missing' });
        }
        
        let updatePayload = convertObjectIds(rawUpdate);
        // Automatically wrap in $set if no MongoDB update operators are specified
        const hasOperators = Object.keys(updatePayload).some(key => key.startsWith('$'));
        if (!hasOperators) {
          updatePayload = { $set: updatePayload };
        }

        const options = req.body.options || {};
        if (action === 'updateOne') {
          result = await col.updateOne(query, updatePayload, options);
        } else {
          result = await col.updateMany(query, updatePayload, options);
        }
        break;
      }

      case 'deleteOne':
      case 'deleteMany': {
        const query = convertObjectIds(req.body.query || {});
        if (action === 'deleteOne') {
          result = await col.deleteOne(query);
        } else {
          result = await col.deleteMany(query);
        }
        break;
      }

      case 'count': {
        const query = convertObjectIds(req.body.query || {});
        const count = await col.countDocuments(query);
        result = { count };
        break;
      }

      default:
        return res.status(400).json({ 
          success: false, 
          error: `Unsupported action: '${action}'. Supported actions: find, insertOne, insertMany, updateOne, updateMany, deleteOne, deleteMany, count.` 
        });
    }

    return res.status(200).json({ success: true, data: result });

  } catch (error) {
    console.error('Database connection or query execution error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'An unexpected server error occurred connecting to MongoDB' 
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (err) {
        console.error('Error closing MongoClient:', err);
      }
    }
  }
};
