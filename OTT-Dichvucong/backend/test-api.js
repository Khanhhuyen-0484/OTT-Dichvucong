const { default: fetch } = require('node-fetch');

async function testAPI() {
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'tngockhanh123@gmail.com',
        password: '123456h'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);

    if (!loginData.token) {
      console.error('No token received');
      return;
    }

    // Test chat rooms API
    const roomsResponse = await fetch('http://localhost:3000/api/chat/rooms', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    const roomsData = await roomsResponse.json();
    console.log('Rooms response:', roomsData);

    // Test contacts API
    const contactsResponse = await fetch('http://localhost:3000/api/chat/contacts?q=', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.token}`
      }
    });

    const contactsData = await contactsResponse.json();
    console.log('Contacts response:', contactsData);

  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();