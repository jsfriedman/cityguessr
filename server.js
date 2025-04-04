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
  // Import and run the CSV loader instead of manual seeding
  try {
    console.log('Attempting to load data from CSV file...');
    require('./csvLoader');
  } catch (err) {
    console.error('Error loading CSV data:', err);
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
    
    // Create cities table with fields matching the CSV
    await client.query(`
      CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        city VARCHAR(100) NOT NULL,
        city_ascii VARCHAR(100) NOT NULL,
        city_alt VARCHAR(100),
        lat DECIMAL(9,6) NOT NULL,
        lng DECIMAL(9,6) NOT NULL,
        country VARCHAR(100) NOT NULL,
        iso2 CHAR(2) NOT NULL,
        iso3 CHAR(3) NOT NULL,
        admin_name VARCHAR(100),
        admin_name_ascii VARCHAR(100),
        admin_code VARCHAR(50),
        admin_type VARCHAR(50),
        capital VARCHAR(50),
        density DECIMAL(15,2),
        population BIGINT,
        population_proper BIGINT,
        ranking INT,
        timezone VARCHAR(50),
        same_name BOOLEAN,
        original_id VARCHAR(50)
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
      SELECT c.id, c.city as name, c.country
      FROM cities c
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
      SELECT c.id, c.city as name, c.lat as latitude, c.lng as longitude, c.country
      FROM cities c
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
      SELECT c.id, c.city as name, c.lat as latitude, c.lng as longitude, c.country
      FROM cities c
      WHERE LOWER(c.city) = LOWER($1) OR LOWER(c.city_ascii) = LOWER($1)
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
      SELECT c.id, c.city as name, c.country
      FROM cities c
      WHERE LOWER(c.city) LIKE LOWER($1) OR LOWER(c.city_ascii) LIKE LOWER($1)
      ORDER BY 
        CASE WHEN LOWER(c.city) = LOWER($2) THEN 0
             WHEN LOWER(c.city) LIKE LOWER($2 || '%') THEN 1
             ELSE 2
        END,
        population DESC NULLS LAST
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
      SELECT c.id, c.city as name, c.lat as latitude, c.lng as longitude, c.country
      FROM cities c
      WHERE 1=1
    `;
    
    const params = [];
    let paramCounter = 1;
    
    // Add population filter if provided
    if (minPopulation) {
      query += ` AND (c.population >= ${paramCounter} OR c.population_proper >= ${paramCounter})`;
      params.push(minPopulation);
      paramCounter++;
    }
    
    // Add country filter if provided
    if (countries && countries.length > 0) {
      query += ` AND c.iso2 IN (${countries.map((_, i) => `${paramCounter + i}`).join(',')})`;
      params.push(...countries);
      paramCounter += countries.length;
    }
    
    // Exclude cities that have already been used
    if (exclude && exclude.length > 0) {
      query += ` AND c.id NOT IN (${exclude.map((_, i) => `${paramCounter + i}`).join(',')})`;
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