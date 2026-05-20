const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// =======================
// FIX
// =======================
global.crypto = require('crypto');

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());

// =======================
// UPLOADS FOLDER FIX (IMPORTANT)
// =======================
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

// =======================
// LOG REQUESTS
// =======================
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

const Content = mongoose.model(
  'Content',
  new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
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
// MULTER CONFIG
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// =======================
// UPLOAD ROUTE (FIXED URL)
// =======================
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;

    res.json({
      fileUrl: `${baseUrl}/uploads/${req.file.filename}`
    });
  } catch (err) {
    console.error(err);
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
// CONTENTS (FIXED SAFE)
// =======================
app.get('/api/contents', async (req, res) => {
  try {
    const queryText = req.query.query || '';

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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// CREATE CONTENT (FIXED 100%)
// =======================
app.post('/api/contents', async (req, res) => {
  try {
    const body = req.body || {};

    const newContent = new Content({
      title: body.title || 'Untitled',
      author: body.author || 'Unknown',
      subCategory: body.subCategory || 'General',
      file_type: body.file_type || 'PDF',
      image: body.image || '',
      fileUrl: body.fileUrl || '',
      operator: body.operator || 'Admin'
    });

    await newContent.save();

    await new Log({
      userId: body.operator || 'Admin',
      action: 'CREATE_CONTENT',
      details: `Added content: ${body.title || 'Untitled'}`
    }).save();

    res.status(201).json(newContent);

  } catch (err) {
    console.error("CREATE CONTENT ERROR:", err);
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
// START
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
