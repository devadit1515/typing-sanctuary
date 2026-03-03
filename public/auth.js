/**
 * Authentication JavaScript
 * Handles login and registration functionality
 */

// Check if user is already logged in
async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();

    if (data.success) {
      // User is logged in, redirect to main page
      window.location.href = '/';
    }
  } catch (error) {
    // Not logged in, stay on auth page
    console.log('Not authenticated');
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.classList.add('show');

  setTimeout(() => {
    errorDiv.classList.remove('show');
  }, 5000);
}

// Hide error message
function hideError() {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.classList.remove('show');
}

// Check username availability (for registration page)
let usernameCheckTimeout;
async function checkUsernameAvailability(username) {
  const availabilityDiv = document.getElementById('usernameAvailability');

  if (!username || username.length < 3) {
    availabilityDiv.textContent = '';
    return;
  }

  availabilityDiv.textContent = 'Checking...';
  availabilityDiv.className = 'availability-message checking';

  clearTimeout(usernameCheckTimeout);
  usernameCheckTimeout = setTimeout(async () => {
    try {
      const response = await fetch(`/api/auth/check-username/${username}`);
      const data = await response.json();

      if (!response.ok) {
        // Server error — don't mislead the user
        availabilityDiv.textContent = '';
      } else if (data.available) {
        availabilityDiv.textContent = '✓ Username available';
        availabilityDiv.className = 'availability-message available';
      } else {
        availabilityDiv.textContent = '✗ Username already taken';
        availabilityDiv.className = 'availability-message taken';
      }
    } catch (error) {
      availabilityDiv.textContent = '';
    }
  }, 500);
}

// Handle Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  // Check if already logged in
  checkAuth();

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    if (!username || !password) {
      showError('Please fill in all fields');
      return;
    }

    // Disable button and show loading
    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    loginBtn.classList.add('loading');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        // Save JWT so session-check.js can authenticate all future requests
        if (data.token) localStorage.setItem('authToken', data.token);
        loginBtn.textContent = 'Success!';
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        // Login failed
        showError(data.message || 'Login failed. Please try again.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
        loginBtn.classList.remove('loading');
      }
    } catch (error) {
      showError('Network error. Please check your connection.');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
      loginBtn.classList.remove('loading');
    }
  });
}

// Handle Registration
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  // Check if already logged in
  checkAuth();

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  // Username availability check
  if (usernameInput) {
    usernameInput.addEventListener('input', (e) => {
      checkUsernameAvailability(e.target.value.trim());
    });
  }

  // Password match validation
  if (confirmPasswordInput) {
    confirmPasswordInput.addEventListener('input', () => {
      if (confirmPasswordInput.value && passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.classList.add('error');
      } else {
        confirmPasswordInput.classList.remove('error');
      }
    });
  }

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const registerBtn = document.getElementById('registerBtn');

    // Validation
    if (!username || !password || !confirmPassword) {
      showError('Please fill in all required fields');
      return;
    }

    if (username.length < 3 || username.length > 20) {
      showError('Username must be between 3 and 20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      showError('Username can only contain letters, numbers, and underscores');
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      confirmPasswordInput.classList.add('error');
      return;
    }

    // Disable button and show loading
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';
    registerBtn.classList.add('loading');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          email: email || undefined,
          password,
          confirmPassword
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save JWT so session-check.js can authenticate all future requests
        if (data.token) localStorage.setItem('authToken', data.token);
        registerBtn.textContent = 'Success!';
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      } else {
        // Registration failed
        showError(data.message || 'Registration failed. Please try again.');
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
        registerBtn.classList.remove('loading');
      }
    } catch (error) {
      showError('Network error. Please check your connection.');
      registerBtn.disabled = false;
      registerBtn.textContent = 'Create Account';
      registerBtn.classList.remove('loading');
    }
  });
}

// Show any error passed back via URL from Google OAuth redirects
(function() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    const messages = {
      oauth_error: 'Google sign-in failed. Please try again.',
      auth_failed: 'Google sign-in was cancelled or denied.',
      session_error: 'Session could not be saved. Please clear cookies and try again.'
    };
    showError(messages[error] || 'Something went wrong. Please try again.');
  }
})();
