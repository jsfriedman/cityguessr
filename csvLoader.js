// csvLoader.js - Script to load city data from CSV file into PostgreSQL

const fs = require('fs');
const { Pool } = require('pg');
const { parse } = require('csv-parse');
const path = require('path');

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'city_game',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function loadCitiesFromCSV() {
  try {
    // Check if data is already loaded
    const countResult = await pool.query('SELECT COUNT(*) FROM cities');
    if (parseInt(countResult.rows[0].count) > 0) {
      console.log('Cities table already has data, skipping import.');
      return;
    }

    console.log('Starting CSV import...');
    
    // Path to CSV file
    const csvFilePath = path.join(__dirname, 'cities.csv');
    
    // Read the CSV file
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    
    // Parse the CSV
    parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, async (err, records) => {
      if (err) {
        console.error('Error parsing CSV:', err);
        return;
      }
      
      console.log(`Found ${records.length} cities in the CSV file.`);
      
      // Use a connection from the pool
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Prepare the query
        const query = `
          INSERT INTO cities (
            city, city_ascii, city_alt, lat, lng, country, 
            iso2, iso3, admin_name, admin_name_ascii, admin_code, 
            admin_type, capital, density, population, population_proper, 
            ranking, timezone, same_name, original_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        `;
        
        // Process records in batches
        const batchSize = 1000;
        let count = 0;
        
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          
          // Check if record has required fields
          if (!record.city || !record.lat || !record.lng || !record.country) {
            console.warn(`Skipping record at index ${i}: Missing required fields`);
            continue;
          }
          
          // Parse numeric values
          const lat = parseFloat(record.lat);
          const lng = parseFloat(record.lng);
          const density = record.density ? parseFloat(record.density) : null;
          const population = record.population ? parseInt(record.population, 10) : null;
          const population_proper = record.population_proper ? parseInt(record.population_proper, 10) : null;
          const ranking = record.ranking ? parseInt(record.ranking, 10) : null;
          const same_name = record.same_name === 'true' || record.same_name === '1';
          
          // Insert the record
          await client.query(query, [
            record.city,
            record.city_ascii || record.city,
            record.city_alt || null,
            lat,
            lng,
            record.country,
            record.iso2 || '',
            record.iso3 || '',
            record.admin_name || null,
            record.admin_name_ascii || null,
            record.admin_code || null,
            record.admin_type || null,
            record.capital || null,
            density,
            population,
            population_proper,
            ranking,
            record.timezone || null,
            same_name,
            record.id || null
          ]);
          
          count++;
          
          // Log progress
          if (count % batchSize === 0 || count === records.length) {
            console.log(`Imported ${count}/${records.length} cities...`);
          }
        }
        
        await client.query('COMMIT');
        console.log(`CSV import completed successfully. Imported ${count} cities.`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error importing CSV data:', error);
      } finally {
        client.release();
      }
    });
    
  } catch (error) {
    console.error('Error in CSV load process:', error);
  }
}

// Call the function to load cities
loadCitiesFromCSV().then(() => {
  console.log('CSV loading process completed');
  pool.end();
}).catch(err => {
  console.error('Fatal error in CSV loading process:', err);
  pool.end();
});
