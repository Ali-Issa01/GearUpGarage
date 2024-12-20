document.addEventListener('DOMContentLoaded', loadCars);

async function loadCars() {
    const carListContainer = document.getElementById('car-list');

    try {
        const response = await fetch('http://localhost:5000/api/cars');
        const cars = await response.json();

        carListContainer.innerHTML = ''; // Clear previous content

        cars.forEach((car) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                
                <div class="card-body">
                    <h5 class="card-title">${car.make} ${car.model}</h5>
                    <p class="card-text">
                        <strong>Year:</strong> ${car.year}<br>
                        <strong>Price:</strong> $${car.price}<br>
                        <strong>Availability:</strong> ${car.is_for_sale ? 'For Sale' : 'For Rent'}
                    </p>
                    <button class="btn btn-primary" onclick="showAppointmentForm('${car.car_id}', '${car.is_for_sale ? 'purchase' : 'rent'}')">
                        ${car.is_for_sale ? 'Purchase' : 'Rent'}
                    </button>
                </div>
            `;
            carListContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading cars:', error);
        carListContainer.innerHTML = '<p>Failed to load cars. Please try again later.</p>';
    }
}

function showAppointmentForm(carId, action) {
    const appointmentForm = document.getElementById('appointment-form');
    appointmentForm.style.display = 'block';
    document.getElementById('car-id-input').value = carId;
    document.getElementById('action-input').value = action;
}

async function submitAppointment(event) {
    event.preventDefault();

    const carId = document.getElementById('car-id-input').value;
    const action = document.getElementById('action-input').value;
    const userName = document.getElementById('user-name').value;
    const appointmentDate = document.getElementById('appointment-date').value;
    const timeSlot = document.getElementById('time-slot').value;

    try {
        const response = await fetch('http://localhost:5000/api/appointments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ carId, action, userName, appointmentDate, timeSlot }),
        });

        if (response.ok) {
            alert('Appointment booked successfully!');
            closeAppointmentForm();
        } else {
            const errorData = await response.json();
            alert(`Failed to book appointment: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Error submitting appointment:', error);
        alert('An error occurred. Please try again.');
    }
}

function closeAppointmentForm() {
    document.getElementById('appointment-form').style.display = 'none';
}
