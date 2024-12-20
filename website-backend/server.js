const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); // Import the database connection
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../'))); // Adjust path to your frontend directory

// Test Database Connection
app.get('/api/test-db', async (req, res) => {
    try {
      console.log("Connected");
        const [rows] = await db.query('SELECT 1 + 1 AS result'); // Simple query to test connection
        res.json({ message: 'Database connected!', result: rows[0].result });
    } catch (error) {
      console.log("Error");
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

        // Insert the new user into the database
        const [result] = await db.query(
            'INSERT INTO user (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, password, phone_number]
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

        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password!' });
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
        'INSERT INTO customer_car (user_id, model, year, car_condition) VALUES (?, ?, ?, ?)',
        [userId, carModel, modelYear, carCondition]
      );
  
      const customerCarId = carResult.insertId; // Get the inserted customer car ID
  
      // Step 2: Insert into the appointment table
      await db.query(
        'INSERT INTO appointments (user_id, customer_car_id, appointment_date, time_slot, garage, service_type) VALUES (?, ?, ?, ?, ?, ?)',
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
        'SELECT time_slot FROM appointments WHERE appointment_date = ? AND garage = ?',
        [appointmentDate, garage]
      );
  
      const bookedSlots = rows.map((row) => row.time_slot); // Extract time slots
      res.status(200).json(bookedSlots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      res.status(500).json({ error: 'Failed to fetch booked slots' });
    }
  });

// Route to fetch all appointments
app.get('/api/appointments', async (req, res) => {
  try {
      const [rows] = await db.query(
          `SELECT * FROM appointments`
      );

      // Return the appointments as a response
      res.status(200).json(rows);
    }
    catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

//To fetch all appointments booked by the user with id = ?
app.get('/api/appointments/user', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
      return res.status(400).json({ error: 'User ID is required!' });
  }

  try {
      // Query to fetch appointments for the user
      const [appointments] = await db.query(
          `SELECT 
              a.appointment_id, 
              a.appointment_date, 
              a.time_slot, 
              a.status, 
              a.garage, 
              a.service_type, 
              c.model, 
              c.year
           FROM 
              appointment a
           JOIN 
              customer_car c 
           ON 
              a.customer_car_id = c.customer_car_id
           WHERE 
              a.user_id = ?`,
          [userId]
      );

      if (appointments.length === 0) {
          return res.status(404).json({ error: 'No appointments found for this user' });
      }

      res.status(200).json(appointments);
  } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Route to cancel an appointment
app.delete('/api/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required!' });
  }

  try {
      // Delete the appointment from the appointment table
      const [result] = await db.query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId]);

      if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Appointment not found' });
      }

      // Success response
      res.status(200).json({ message: 'Appointment canceled successfully!' });
  } catch (error) {
      console.error('Error canceling appointment:', error);
      res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

//get the cars from the database
app.get('/api/cars', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM company_car');
        res.status(200).json(rows); // Send cars data as JSON
    } catch (error) {
        console.error('Error fetching cars:', error);
        res.status(500).json({ error: 'Failed to fetch cars from the database' });
    }
});

//get the car_appointment data

app.get('/api/carappointment', async (req,res) => {
    try {
        console.log("Fetching car appointment");
        
        //Select all rows from the table
        const [rows] = await db.query('SELECT * FROM carappointment');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching car appointment: ', error);
        res.status(500).json({error: 'Failed to fetch car appointments from the database'});
    }
});

app.post('/api/carappointment', async (req, res) => {
    const {
        user_id,
        company_car_id,
        appointment_date,
        time_slot,
        type_of_booking,
        employee_first_name,
        employee_last_name
    } = req.body;

    if (!user_id || !company_car_id || !appointment_date || !time_slot || !type_of_booking || !employee_first_name || !employee_last_name) {
        return res.status(400).json({ error: 'Please provide all required fields!' });
    }

    try {
        // Check if the user_id exists in the USER table
        const [userExists] = await db.query('SELECT user_id FROM USER WHERE user_id = ?', [user_id]);
        if (userExists.length === 0) {
            return res.status(400).json({ error: 'User does not exist!' });
        }

        // Check if the company_car_id exists in the COMPANY_CAR table
        const [carExists] = await db.query('SELECT company_car_id FROM COMPANY_CAR WHERE company_car_id = ?', [company_car_id]);
        if (carExists.length === 0) {
            return res.status(400).json({ error: 'Company car does not exist!' });
        }

        // Insert the data into the CARAPPOINTMENT table
        const [result] = await db.query(
            'INSERT INTO CARAPPOINTMENT (user_id, company_car_id, appointment_date, time_slot, type_of_booking, employee_first_name, employee_last_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                user_id,
                company_car_id,
                appointment_date,
                time_slot,
                type_of_booking,
                employee_first_name,
                employee_last_name
            ]
        );

        // Return a success response
        res.status(201).json({
            message: 'Car appointment booked successfully!',
            appointmentId: result.insertId // Return the appointment ID
        });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Failed to book the car appointment', details: error.message });
    }
});


// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


