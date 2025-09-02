// Simple test to verify authentication state
console.log('Testing authentication...');

fetch('/api/auth/user', { credentials: 'include' })
  .then(response => response.json())
  .then(data => {
    console.log('Auth response:', data);
    if (data.user) {
      console.log('User is authenticated:', data.user.first_name);
    } else {
      console.log('User is not authenticated');
    }
  })
  .catch(error => {
    console.error('Auth error:', error);
  });