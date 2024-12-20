const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./db'); // Import the database connection
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;



(async () => {
    const plainTextPassword = 'admin'; // Your password
    const saltRounds = 10; // Number of salt rounds
    const hashedPassword = await bcrypt.hash(plainTextPassword, saltRounds);
  
    console.log('Hashed Password:', hashedPassword);
  })();

app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../'))); // Adjust path to your frontend directory

// Test Database Connection
app.get('/api/test-db', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 + 1 AS result'); // Simple query to test connection
        res.json({ message: 'Database connected!', result: rows[0].result });
    } catch (error) {
        res.status(500).json({ error: 'Database connection failed!', details: error.message });
    }
});

// Route to insert a user using the sign in page
app.post('/api/signin', async (req, res) => {
    const { name, email, password, phone_number } = req.body;

    if (!name || !email || !password || !phone_number) {
        return res.status(400).json({ error: 'Please provide all required fields!' });
    }

    try {
        // Check if email already exists
        const [existingUser] = await db.query('SELECT email FROM user WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email already used' }); // Return a user-friendly message
        }



        // Get the current count of users to generate a new user_id
        const [rows] = await db.query('SELECT COUNT(*) AS count FROM user');
        const user_id = rows[0].count + 1;

        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert the new user into the database
        const [result] = await db.query(
            'INSERT INTO user (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, phone_number]
        );

        res.status(201).json({
            message: 'Signed in successfully!',
            userId: user_id,
        });
    } catch (error) {
        // Check if the error is a duplicate entry error
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already used' }); // Return a user-friendly message
        }

        // Log and handle other errors
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Database error!', details: error.message });
    }
});


//Login page

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both email and password!' });
    }

    try {
        const [rows] = await db.query('SELECT * FROM user WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Invalid email or password!' });
        }

        const user = rows[0];

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
        return res.status(401).json({ error: 'Invalid password' });
            }
        // Successful login: Return user details
        res.status(200).json({
            message: 'Login successful!',
            userId: user.user_id,
            username: user.name,
        });
        
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'An error occurred during login!' });
    }
});





// Route to handle appointment bookings
app.post('/api/appointments', async (req, res) => {
    const {
      carModel,
      modelYear,
      carCondition,
      appointmentDay,
      timeSlot,
      garage,
      serviceType,
      userId
    } = req.body;
  
    try {
      // Step 1: Insert into the customer_car table
      const [carResult] = await db.query(
        'INSERT INTO customer_car (user_id, model, model_year, car_condition) VALUES (?, ?, ?, ?)',
        [userId, carModel, modelYear, carCondition]
      );
  
      const customerCarId = carResult.insertId; // Get the inserted customer car ID
  
      // Step 2: Insert into the appointment table
      await db.query(
        'INSERT INTO appointment (user_id, customer_car_id, appointment_date, time_slot, garage, service_type) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, customerCarId, appointmentDay, timeSlot, garage, serviceType]
      );
  
      // Success response
      res.status(201).json({ message: 'Appointment booked successfully!' });
    } catch (error) {
      console.error('Database Error:', error);
      res.status(500).json({ error: 'Failed to book appointment', details: error.message });
    }
  });



//Sending time slots to the service page
app.get('/api/booked-time-slots', async (req, res) => {
    const { appointmentDate, garage } = req.query;
  
    try {
      const [rows] = await db.query(
        'SELECT time_slot FROM appointment WHERE appointment_date = ? AND garage = ?',
        [appointmentDate, garage]
      );
  
      const bookedSlots = rows.map((row) => row.time_slot); // Extract time slots
      res.status(200).json(bookedSlots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      res.status(500).json({ error: 'Failed to fetch booked slots' });
    }
  });


// Sending Informations to the Admin panel

//Send Appointments details to the admin
app.get('/api/appointments-admin', async (req, res) => {
    try {
      const query = `
        SELECT 
          a.appointment_id,
          a.appointment_date,
          a.time_slot,
          a.garage,
          a.service_type,
          u.name AS user_name,
          u.phone AS user_phone,
          cc.model AS car_model,
          cc.model_year AS car_year
        FROM appointment a
        JOIN user u ON a.user_id = u.user_id
        JOIN customer_car cc ON a.customer_car_id = cc.car_id
      `;
  
      const [rows] = await db.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
  });
















// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


