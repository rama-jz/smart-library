const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const multer = require('multer');
const path = require('path');

const app = express();

// =======================
// FIX (for some servers)
// =======================
global.crypto = require('crypto');

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// static files (uploads)
app.use('/uploads', express.static('uploads'));

// logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =======================
// MONGO DB
// =======================
const mongoURI =
  process.env.MONGODB_URI ||
  'mongodb://database:27017/SmartDigitalLibrary';

mongoose
  .connect(mongoURI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// =======================
// MODELS
// =======================

const User = mongoose.model(
  'User',
  new mongoose.Schema({
    username: { type: String, required: true },
    role: { type: String, default: 'Reader' },
    active: { type: Boolean, default: true }
  }),
  'Users'
);

// ⚠️ ما غيرنا اسم collection مثل ما طلبت
const Content = mongoose.model(
  'Content',
  new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },

    // ✅ FIX 1: أضف categoryId (مهم لو موجود بالداتابيس)
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },

    subCategory: String,
    file_type: { type: String, default: 'PDF' },
    image: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    operator: String,

    createdAt: { type: Date, default: Date.now }
  }),
  'Content'
);

const Log = mongoose.model(
  'Log',
  new mongoose.Schema({
    userId: { type: String, default: 'System' },
    action: String,
    details: String,
    ipAddress: { type: String, default: '127.0.0.1' },
    timestamp: { type: Date, default: Date.now }
  }),
  'activity_logs'
);

// =======================
// UPLOAD CONFIG
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// =======================
// UPLOAD ROUTE
// =======================
app.post('/api/contents', async (req, res) => {
  try {
    const body = req.body || {}; // 🔥 حماية من undefined

    console.log("📦 BODY RECEIVED:", body);

    const newContent = new Content({
      title: body.title || 'Untitled',
      author: body.author || 'Unknown',
      subCategory: body.subCategory || '',
      file_type: body.file_type || 'PDF',
      image: body.image || '',
      fileUrl: body.fileUrl || '',
      operator: body.operator || 'Admin'
    });

    const saved = await newContent.save();

    res.status(201).json(saved);

  } catch (err) {
    console.error("❌ ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// USERS
// =======================
app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, role } = req.body;

    const newUser = new User({ username, role });
    await newUser.save();

    await new Log({
      userId: username,
      action: 'CREATE_USER',
      details: `User created: ${username}`
    }).save();

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CONTENTS
// =======================
app.get('/api/contents', async (req, res) => {
  try {
    const queryText =
      req.query.query || req.query.search || req.query.text || '';

    let filter = {};

    if (queryText) {
      filter.$or = [
        { title: { $regex: queryText, $options: 'i' } },
        { author: { $regex: queryText, $options: 'i' } },
        { subCategory: { $regex: queryText, $options: 'i' } }
      ];
    }

    const data = await Content.find(filter).sort({ createdAt: -1 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CREATE CONTENT (FIX 2 مهم جداً)
// =======================
app.post('/api/contents', async (req, res) => {
  try {
    console.log("📦 BODY RECEIVED:", req.body);

    const newContent = new Content({
      title: req.body.title || 'Untitled',
      author: req.body.author || 'Unknown',
      subCategory: req.body.subCategory || 'General',
      file_type: req.body.file_type || 'PDF',
      image: req.body.image || '',
      fileUrl: req.body.fileUrl || '',
      operator: req.body.operator || 'Admin'
    });

    await newContent.save();

    await new Log({
      userId: req.body.operator || 'Admin',
      action: 'CREATE_CONTENT',
      details: `Added content: ${req.body.title}`
    }).save();

    res.status(201).json(newContent);

  } catch (err) {
    console.error("❌ CREATE CONTENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// LOGS
// =======================
app.get('/api/logs', async (req, res) => {
  const logs = await Log.find().sort({ timestamp: -1 });
  res.json(logs);
});

// =======================
// 404
// =======================
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.url
  });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
