const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();


// Middleware

app.use(cors());
app.use(express.json()); // Parse incoming JSON requests

// Request logging middleware for debugging and monitoring
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Health check route
app.get('/test', (req, res) => {
  res.send("Neon Server is working perfectly!");
});

// Database connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://database:27017/SmartDigitalLibrary';
mongoose.connect(mongoURI)
  .then(() => console.log('Connected to SmartDigitalLibrary database successfully!'))
  .catch(err => console.error('Database connection failed:', err));

// Models


// User model mapped to Users collection
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true },
  role: { type: String, default: 'Reader' },
  active: { type: Boolean, default: true }
}), 'Users');

// Content model mapped to Content collection
const Content = mongoose.model('Content', new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String, required: true },
  subCategory: String,
  file_type: { type: String, default: 'PDF' },
  image: { type: String, default: '' }, // Cover image URL or path
  operator: String
}), 'Content');

// Activity logs model mapped to activity_logs collection
const Log = mongoose.model('Log', new mongoose.Schema({
  userId: { type: String, default: 'System' },
  action: { type: String, required: true },
  details: { type: String, required: true },
  ipAddress: { type: String, default: '127.0.0.1' },
  timestamp: { type: Date, default: Date.now }
}), 'activity_logs');



// Routes


// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { username, role } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }

    const newUser = new User({ username, role });
    await newUser.save();

    // Log user creation event
    const newLog = new Log({
      userId: username,
      action: "CREATE_USER",
      details: `New user created: ${username} with role ${role}`
    });
    await newLog.save();

    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to save user" });
  }
});


// Get all content items
app.get('/api/contents', async (req, res) => {
  try {
    const contents = await Content.find();
    res.json(contents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new content item
app.post('/api/contents', async (req, res) => {
  try {
    const { title, author, subCategory, file_type, image, operator } = req.body;

    const newContent = new Content({
      title: title || "Untitled",
      author: author || "Unknown",
      subCategory: subCategory || "General",
      file_type: file_type || "PDF",
      image: image || "",
      operator: operator || "Admin"
    });

    await newContent.save();

    // Log content creation event
    const newLog = new Log({
      userId: operator || "Admin",
      action: "CREATE_CONTENT",
      details: `New content added: ${title || "Document"}`
    });
    await newLog.save();

    res.status(201).json(newContent);
  } catch (err) {
    res.status(500).json({ error: "Failed to save content" });
  }
});


// Get activity logs
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 404 handler
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Route not found",
    path: req.url
  });
});


// Server startup
const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
