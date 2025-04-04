// server.js - Express backend for the City Guessing Game
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Add a data seeding script for development
async function seedDatabaseWithSampleData() {
  const client = await pool.connect();
  try {
    // Check if data already exists
    const countResult = await client.query('SELECT COUNT(*) FROM countries');
    if (parseInt(countResult.rows[0].count) > 0) {
      console.log('Database already has data, skipping seed');
      return;
    }

    await client.query('BEGIN');
    
    // Insert sample countries
    await client.query(`
      INSERT INTO countries (code, name) VALUES
      ('US', 'United States'),
      ('CA', 'Canada'),
      ('GB', 'United Kingdom'),
      ('FR', 'France'),
      ('DE', 'Germany'),
      ('JP', 'Japan'),
      ('AU', 'Australia'),
      ('BR', 'Brazil'),
      ('IN', 'India'),
      ('CN', 'China')
    `);
    
    // Insert sample cities
    await client.query(`
      INSERT INTO cities (name, country_code, latitude, longitude, population) VALUES
      ('New York', 'US', 40.7128, -74.0060, 8400000),
      ('Los Angeles', 'US', 34.0522, -118.2437, 3970000),
      ('Chicago', 'US', 41.8781, -87.6298, 2700000),
      ('Toronto', 'CA', 43.6532, -79.3832, 2800000),
      ('Vancouver', 'CA', 49.2827, -123.1207, 630000),
      ('London', 'GB', 51.5074, -0.1278, 8900000),
      ('Manchester', 'GB', 53.4808, -2.2426, 550000),
      ('Paris', 'FR', 48.8566, 2.3522, 2200000),
      ('Lyon', 'FR', 45.7640, 4.8357, 520000),
      ('Berlin', 'DE', 52.5200, 13.4050, 3700000),
      ('Munich', 'DE', 48.1351, 11.5820, 1500000),
      ('Tokyo', 'JP', 35.6762, 139.6503, 13900000),
      ('Osaka', 'JP', 34.6937, 135.5023, 2700000),
      ('Sydney', 'AU', -33.8688, 151.2093, 5300000),
      ('Melbourne', 'AU', -37.8136, 144.9631, 5000000),
      ('Rio de Janeiro', 'BR', -22.9068, -43.1729, 6700000),
      ('Sao Paulo', 'BR', -23.5505, -46.6333, 12300000),
      ('Mumbai', 'IN', 19.0760, 72.8777, 12500000),
      ('Delhi', 'IN', 28.6139, 77.2090, 11000000),
      ('Beijing', 'CN', 39.9042, 116.4074, 21500000),
      ('Shanghai', 'CN', 31.2304, 121.4737, 26300000)
    `);
    
    await client.query('COMMIT');
    console.log('Sample data seeded successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', e);
  } finally {
    client.release();
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // For development, seed the database with sample data
  if (process.env.NODE_ENV === 'development') {
    seedDatabaseWithSampleData().catch(err => {
      console.error('Error seeding database:', err);
    });
  }
});

// Serve main HTML file for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'city_game',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Create database tables if they don't exist
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create countries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS countries (
        code CHAR(2) PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      )
    `);
    
    // Create cities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        country_code CHAR(2) REFERENCES countries(code),
        latitude DECIMAL(9,6) NOT NULL,
        longitude DECIMAL(9,6) NOT NULL,
        population INTEGER NOT NULL DEFAULT 0
      )
    `);
    
    // Create scores table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        score INTEGER NOT NULL,
        game_mode VARCHAR(20) NOT NULL,
        rounds INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create guesses table to store detailed game history
    await client.query(`
      CREATE TABLE IF NOT EXISTS guesses (
        id SERIAL PRIMARY KEY,
        score_id INTEGER REFERENCES scores(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        actual_city_id INTEGER REFERENCES cities(id),
        guessed_city_id INTEGER REFERENCES cities(id),
        distance DECIMAL(10,2) NOT NULL,
        points INTEGER NOT NULL
      )
    `);
    
    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Database initialization error:', e);
    throw e;
  } finally {
    client.release();
  }
}

// Test database connection and initialize
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
    initializeDatabase().catch(err => console.error('Database initialization error:', err));
  }
});

// API Routes

// Get random cities for dropdown options
app.get('/api/cities/random', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    const excludeId = req.query.exclude;
    
    let query = `
      SELECT c.id, c.name, co.name as country
      FROM cities c
      JOIN countries co ON c.country_code = co.code
      WHERE 1=1
    `;
    
    const params = [];
    
    if (excludeId) {
      query += ` AND c.id != $1`;
      params.push(excludeId);
    }
    
    query += ` ORDER BY RANDOM() LIMIT ${count}`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching random cities:', error);
    res.status(500).json({ error: 'Failed to fetch random cities' });
  }
});

// Get city by ID
app.get('/api/cities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT c.id, c.name, c.latitude, c.longitude, co.name as country
      FROM cities c
      JOIN countries co ON c.country_code = co.code
      WHERE c.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ error: 'Failed to fetch city' });
  }
});

// Search for city by name
app.get('/api/cities/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }
    
    const query = `
      SELECT c.id, c.name, c.latitude, c.longitude, co.name as country
      FROM cities c
      JOIN countries co ON c.country_code = co.code
      WHERE LOWER(c.name) = LOWER($1)
      LIMIT 1
    `;
    
    const result = await pool.query(query, [name]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error searching city:', error);
    res.status(500).json({ error: 'Failed to search city' });
  }
});

// Autocomplete city names
app.get('/api/cities/autocomplete', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }
    
    const sqlQuery = `
      SELECT c.id, c.name, co.name as country
      FROM cities c
      JOIN countries co ON c.country_code = co.code
      WHERE LOWER(c.name) LIKE LOWER($1)
      ORDER BY 
        CASE WHEN LOWER(c.name) = LOWER($2) THEN 0
             WHEN LOWER(c.name) LIKE LOWER($2 || '%') THEN 1
             ELSE 2
        END,
        population DESC
      LIMIT 10
    `;
    
    const result = await pool.query(sqlQuery, [`%${query}%`, query]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch autocomplete suggestions' });
  }
});

// Save score
app.post('/api/scores', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { username, score, gameMode, rounds, guesses } = req.body;
    
    // Insert score
    const scoreResult = await client.query(
      `INSERT INTO scores (username, score, game_mode, rounds) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [username, score, gameMode, rounds]
    );
    
    const scoreId = scoreResult.rows[0].id;
    
    // Insert guesses
    for (const guess of guesses) {
      await client.query(
        `INSERT INTO guesses (score_id, round_number, actual_city_id, guessed_city_id, distance, points)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [scoreId, guess.round, guess.cityId, guess.guessedCityId, guess.distance, guess.points]
      );
    }
    
    await client.query('COMMIT');
    
    res.json({ success: true, id: scoreId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  } finally {
    client.release();
  }
});

// Get high scores
app.get('/api/scores/highscores', async (req, res) => {
  try {
    const { mode, limit } = req.query;
    const scoreLimit = parseInt(limit) || 10;
    
    let query = `
      SELECT username, score, game_mode, rounds, created_at
      FROM scores
      WHERE 1=1
    `;
    
    const params = [];
    
    if (mode) {
      query += ` AND game_mode = $1`;
      params.push(mode);
    }
    
    query += ` ORDER BY score DESC LIMIT ${scoreLimit}`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching high scores:', error);
    res.status(500).json({ error: 'Failed to fetch high scores' });
  }
});

// Get GeoJSON data for country borders
app.get('/api/geojson/countries', (req, res) => {
  // In a real application, you would fetch this from a database
  // or a file, but for simplicity, we'll use a URL to a GeoJSON file
  res.json({
    type: 'FeatureCollection',
    features: [] // This would be populated with actual GeoJSON data
  });
});

// Get GeoJSON data for state/provincial borders
app.get('/api/geojson/states', (req, res) => {
  // Same as above, this would be fetched from a database or file
  res.json({
    type: 'FeatureCollection',
    features: [] // This would be populated with actual GeoJSON data
  });
});

// Get all countries
app.get('/api/countries', async (req, res) => {
  try {
    const result = await pool.query('SELECT code, name FROM countries ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get random city based on filters
app.post('/api/cities/random', async (req, res) => {
  try {
    const { countries, minPopulation, exclude } = req.body;
    
    let query = `
      SELECT c.id, c.name, c.latitude, c.longitude, co.name as country
      FROM cities c
      JOIN countries co ON c.country_code = co.code
      WHERE c.population >= $1
    `;
    
    const params = [minPopulation || 0];
    
    // Add country filter if provided
    if (countries && countries.length > 0) {
      query += ` AND c.country_code IN (${countries.map((_, i) => `${i + 2}`).join(',')})`;
      params.push(...countries);
    }
    
    // Exclude cities that have already been used
    if (exclude && exclude.length > 0) {
      query += ` AND c.id NOT IN (${exclude.map((_, i) => `${params.length + i + 1}`).join(',')})`;
      params.push(...exclude);
    }
    
    // Get random city
    query += ' ORDER BY RANDOM() LIMIT 1';
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No cities found matching criteria' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching random city:', error);
    res.status(500).json({ error: 'Failed to fetch random city' });
  }
});