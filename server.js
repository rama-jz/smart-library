global.crypto = require('crypto'); // حل مشكلة التشفير للإصدارات القديمة في السيرفر

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =======================
// MongoDB Connection
// =======================
const mongoURI =
  process.env.MONGODB_URI ||
  'mongodb://database:27017/SmartDigitalLibrary';

mongoose
  .connect(mongoURI)
  .then(() => console.log('Connected to SmartDigitalLibrary database successfully!'))
  .catch(err => console.error('Database connection failed:', err));

// =======================
// MODELS
// =======================

const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      username: { type: String, required: true },
      role: { type: String, default: 'Reader' },
      active: { type: Boolean, default: true }
    },
    { collection: 'Users' }
  )
);

const Content = mongoose.model(
  'Content',
  new mongoose.Schema(
    {
      title: { type: String, required: true },
      author: { type: String, required: true },
      subCategory: String,

      file_type: { type: String, default: 'PDF' },
      fileUrl: { type: String, default: '' },   // 🔥 مهم جداً
      image: { type: String, default: '' },

      operator: String
    },
    { collection: 'Content' }
  )
);

const Log = mongoose.model(
  'Log',
  new mongoose.Schema(
    {
      userId: { type: String, default: 'System' },
      action: { type: String, required: true },
      details: { type: String, required: true },
      ipAddress: { type: String, default: '127.0.0.1' },
      timestamp: { type: Date, default: Date.now }
    },
    { collection: 'activity_logs' }
  )
);

// =======================
// USERS ROUTES
// =======================

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, role } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const newUser = new User({ username, role });
    await newUser.save();

    await new Log({
      userId: username,
      action: 'CREATE_USER',
      details: `New user created: ${username} with role ${role}`
    }).save();

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save user' });
  }
});

// =======================
// CONTENTS ROUTE (FIXED - NO DUPLICATION)
// =======================

app.get('/api/contents', async (req, res) => {
  try {
    const { search, text, category, author } = req.query;

    let filter = {};

    const queryText = search || text;

    if (queryText) {
      filter.$or = [
        { title: { $regex: queryText, $options: 'i' } },
        { author: { $regex: queryText, $options: 'i' } },
        { subCategory: { $regex: queryText, $options: 'i' } }
      ];
    }

    if (category) {
      filter.subCategory = { $regex: category, $options: 'i' };
    }

    if (author) {
      filter.author = { $regex: author, $options: 'i' };
    }

    console.log('FILTER:', filter);

    const contents = await Content.find(filter).sort({ createdAt: -1 });
    res.json(contents || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CREATE CONTENT (FIXED)
// =======================

app.post('/api/contents', async (req, res) => {
  try {
    const {
      title,
      author,
      subCategory,
      file_type,
      image,
      operator,
      fileUrl
    } = req.body;

    const newContent = new Content({
      title: title || 'Untitled',
      author: author || 'Unknown',
      subCategory: subCategory || 'General',
      file_type: file_type || 'PDF',
      image: image || '',
      operator: operator || 'Admin',
      fileUrl: fileUrl || '' // 🔥 مهم
    });

    await newContent.save();

    await new Log({
      userId: operator || 'Admin',
      action: 'CREATE_CONTENT',
      details: `New content added: ${title || 'Document'}`
    }).save();

    res.status(201).json(newContent);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save content' });
  }
});

// =======================
// LOGS
// =======================

app.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// 404
// =======================

app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.url
  });
});

// =======================
// SERVER START
// =======================

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
