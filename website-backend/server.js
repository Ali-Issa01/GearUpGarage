const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors());
app.use(express.json()); 


app.use(express.static(path.join(__dirname, '../'))); 


app.get('/api/test-db', async (req, res) => {
    try {
      console.log("Connected");
        const [rows] = await db.query('SELECT 1 + 1 AS result'); 
        res.json({ message: 'Database connected!', result: rows[0].result });
    } catch (error) {
      console.log("Error");
        res.status(500).json({ error: 'Database connection failed!', details: error.message });
    }
});


app.post('/api/signin', async (req, res) => {
    const { name, email, password, phone_number } = req.body;

    if (!name || !email || !password || !phone_number) {
        return res.status(400).json({ error: 'Please provide all required fields!' });
    }

    try {
        
        const [existingUser] = await db.query('SELECT email FROM user WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email already used' }); 
        }

        
        const [rows] = await db.query('SELECT COUNT(*) AS count FROM user');
        const user_id = rows[0].count + 1;

        
        const [result] = await db.query(
            'INSERT INTO user (name, email, password, phone) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, phone_number]
        );

        res.status(201).json({
            message: 'Signed in successfully!',
            userId: user_id,
        });
    } catch (error) {
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already used' }); 
        }

        
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Database error!', details: error.message });
    }
});



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
      
      const [carResult] = await db.query(
        'INSERT INTO customer_car (user_id, model, year, car_condition) VALUES (?, ?, ?, ?)',
        [userId, carModel, modelYear, carCondition]
      );
  
      const customerCarId = carResult.insertId; 
  
      
      await db.query(
        'INSERT INTO appointments (user_id, customer_car_id, appointment_date, time_slot, garage, service_type) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, customerCarId, appointmentDay, timeSlot, garage, serviceType]
      );
  
      
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
  
      const bookedSlots = rows.map((row) => row.time_slot); 
      res.status(200).json(bookedSlots);
    } catch (error) {
      console.error('Error fetching booked slots:', error);
      res.status(500).json({ error: 'Failed to fetch booked slots' });
    }
  });


app.get('/api/appointments', async (req, res) => {
  try {
      const [rows] = await db.query(
          `SELECT * FROM appointments`
      );

      
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


app.delete('/api/appointments/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;

  if (!appointmentId) {
      return res.status(400).json({ error: 'Appointment ID is required!' });
  }

  try {
      
      const [result] = await db.query('DELETE FROM appointments WHERE appointment_id = ?', [appointmentId]);

      if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'Appointment not found' });
      }

      
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
        res.status(200).json(rows); 
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


//Post 
app.post('/api/carappointment', async (req, res) => {
    const {
        company_car_id,
        appointment_date,
        time_slot,
        type_of_booking,
        employee_first_name,
        employee_last_name
    } = req.body;
    console.log("req");
    console.log(req);
    
    try {
        
        const [result] = await db.query(
            'INSERT INTO carappointment (company_car_id, appointment_date, time_slot, type_of_booking, employee_first_name, employee_last_name) VALUES (?, ?, ?, ?, ?, ?)',
            [
                company_car_id,
                appointment_date,
                time_slot,
                type_of_booking,
                employee_first_name,
                employee_last_name
            ]
        );

        res.status(201).json({
            message: 'Car appointment booked successfully',
            appointmentId: result.insertId 
        });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Failed to book appointment', details: error.message });
    }
});



app.listen(PORT, () => {
    console.log(`Server running on http:
        //localhost:${PORT}`);
});


