require('dotenv').config();
const express = require('express');
const aws = require('aws-sdk');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// AWS S3 setup
aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
const s3 = new aws.S3();

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

// Multer setup for handling file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, uuidv4() + path.extname(file.originalname)); // Generate unique file name
    }
});
const upload = multer({ storage: storage });

// Helper function to upload file to S3
async function uploadFileToS3(filePath, fileName) {
    const fileContent = fs.readFileSync(filePath);
    const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileName,
        Body: fileContent
    };
    return s3.upload(params).promise();
}

// Register user endpoint
app.post('/register', async (req, res) => {

  // Generate a random image number between 1 and 100
  const imageNumber = Math.floor(Math.random() * 100) + 1;
  const paddedNumber = imageNumber.toString().padStart(3, '0');
  const originalImageName = `${paddedNumber}.png`;
  const imagePath = `images/${originalImageName}`; // Assuming images are stored in an 'images' folder

  try {
    const { username } = req.body;

    // Generate a unique name for the image to be saved in S3
    const uniqueImageName = `${username}-${uuidv4()}.png`;

    // Initially insert user info into PostgreSQL database without image_url
    const insertQuery = 'INSERT INTO users(username, image_url) VALUES($1, $2) RETURNING *';
    const values = [username, uniqueImageName];
    const response = await pool.query(insertQuery, values);

    // If user is successfully registered, proceed with image upload
    if (response.rows.length > 0) {
      const user = response.rows[0];

      // Upload random image to S3 with a unique name
      const result = await uploadFileToS3(imagePath, uniqueImageName);

      // Send response with user info including image_url
      res.json({ message: 'User registered successfully', user: user });
    } else {
      res.status(400).send('Failed to register user');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Get all users endpoint
app.get('/users', async (req, res) => {
  try {
    const response = await pool.query('SELECT * FROM users LIMIT 100');
    res.json(response.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Get user by username
app.get('/users/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const response = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (response.rows.length > 0) {
      res.json(response.rows[0]);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
