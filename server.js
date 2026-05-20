global.crypto = require('crypto');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());

// مهم جداً
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =======================
// MongoDB
// =======================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/SmartDigitalLibrary')
  .then(() => console.log('DB Connected'))
  .catch(err => console.error(err));

// =======================
// MODELS
// =======================

const User = mongoose.model('User', new mongoose.Schema({
  username: String,
  role: { type: String, default: 'Reader' },
  active: { type: Boolean, default: true }
}), 'Users');

const Content = mongoose.model('Content', new mongoose.Schema({
  title: String,
  author: String,
  subCategory: String,

  fileType: { type: String, enum: ['PDF', 'Image', 'Audio'] },
  fileUrl: String,

  image: String,
  operator: String,
  createdAt: { type: Date, default: Date.now }
}), 'Content');

const Log = mongoose.model('Log', new mongoose.Schema({
  userId: String,
  action: String,
  details: String,
  ipAddress: String,
  timestamp: { type: Date, default: Date.now }
}), 'activity_logs');

// =======================
// ROLE MIDDLEWARE (FIXED)
// =======================
const allowRoles = (roles) => (req, res, next) => {
  const role = req.headers.role || 'Reader';

  if (!roles.includes(role)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  req.userRole = role;
  next();
};

// =======================
// MULTER CONFIG
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
// USERS
// =======================

app.get('/api/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.post('/api/users', allowRoles(['Admin']), async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.json(user);
});

// =======================
// CONTENTS
// =======================

app.get('/api/contents', async (req, res) => {
  const { query } = req.query;

  let filter = {};

  if (query) {
    filter.$or = [
      { title: { $regex: query, $options: 'i' } },
      { author: { $regex: query, $options: 'i' } },
      { subCategory: { $regex: query, $options: 'i' } }
    ];
  }

  const data = await Content.find(filter).sort({ createdAt: -1 });
  res.json(data);
});

// =======================
// UPLOAD CONTENT (FIXED)
// =======================
app.post(
  '/api/contents',
  allowRoles(['Admin', 'Uploader']),
  upload.single('file'),
  async (req, res) => {
    try {
      const {
        title,
        author,
        subCategory,
        file_type,
        image,
        operator
      } = req.body;

      const fileUrl = req.file
        ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
        : "";

      const content = new Content({
        title,
        author,
        subCategory,
        fileType: file_type,
        fileUrl,
        image,
        operator
      });

      await content.save();

      await new Log({
        userId: operator || "system",
        action: "CREATE_CONTENT",
        details: `Uploaded ${file_type}: ${title}`,
        ipAddress: req.ip
      }).save();

      res.json(content);

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =======================
// LOGS
// =======================
app.get('/api/logs', async (req, res) => {
  const logs = await Log.find().sort({ timestamp: -1 });
  res.json(logs);
});

// =======================
app.listen(5000, () => console.log("Server running on 5000"));
